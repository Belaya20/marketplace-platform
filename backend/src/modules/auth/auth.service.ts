import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import db from '../../config/database';
import { signAccessToken, signRefreshToken } from '../../config/jwt';
import { AppError } from '../../utils/response';
import { notificationService } from '../notifications/notification.service';
import logger from '../../config/logger';

// ── Validation helpers ────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: string): void {
  if (!email || !EMAIL_REGEX.test(email.trim())) {
    throw AppError.badRequest('A valid email address is required');
  }
}

function validatePassword(password: string): void {
  if (!password || password.length < 8) {
    throw AppError.badRequest('Password must be at least 8 characters');
  }
}

// ── Service ───────────────────────────────────────────────────────────────────

export const authService = {

  // ── Req 3.1.1: Customer Registration ─────────────────────────────────────
  async registerCustomer(data: {
    email:       string;
    phone?:      string;
    password:    string;
    first_name?: string;
    last_name?:  string;
  }) {
    // Backend validation — never trust client-side only
    validateEmail(data.email);
    validatePassword(data.password);

    const exists = await db('users').where('email', data.email.trim().toLowerCase()).first();
    if (exists) throw AppError.conflict('Email already registered');

    const password_hash = await bcrypt.hash(data.password, 12);

    const [user] = await db('users').insert({
      id:           uuidv4(),
      email:        data.email.trim().toLowerCase(),
      phone:        data.phone || null,
      password_hash,
      role:         'customer',
      first_name:   data.first_name?.trim() || null,
      last_name:    data.last_name?.trim()  || null,
    }).returning(['id', 'email', 'role', 'email_verified', 'first_name', 'last_name']);

    // OTP stored in DB synchronously. Email sent asynchronously.
    // Registration succeeds even if email delivery fails.
    await this._sendOtp(user.id, user.email, 'email_verify');

    return user;
  },

  // ── Req 3.1.1: Seller Registration ───────────────────────────────────────
  async registerSeller(data: {
    email:                    string;
    phone?:                   string;
    password:                 string;
    first_name?:              string;
    last_name?:               string;
    business_name:            string;
    business_registration_no?: string;
    tax_id?:                  string;
    business_address?:        string;
  }) {
    validateEmail(data.email);
    validatePassword(data.password);

    if (!data.business_name?.trim()) {
      throw AppError.badRequest('Business name is required');
    }

    const exists = await db('users').where('email', data.email.trim().toLowerCase()).first();
    if (exists) throw AppError.conflict('Email already registered');

    const password_hash = await bcrypt.hash(data.password, 12);

    return db.transaction(async (trx) => {
      const [user] = await trx('users').insert({
        id:           uuidv4(),
        email:        data.email.trim().toLowerCase(),
        phone:        data.phone || null,
        password_hash,
        role:         'seller',
        first_name:   data.first_name?.trim() || null,
        last_name:    data.last_name?.trim()  || null,
      }).returning(['id', 'email', 'role']);

      // Seller profile starts as 'pending' — admin must approve before login
      await trx('seller_profiles').insert({
        id:                       uuidv4(),
        user_id:                  user.id,
        business_name:            data.business_name.trim(),
        business_registration_no: data.business_registration_no || null,
        tax_id:                   data.tax_id                   || null,
        business_address:         data.business_address         || null,
        status:                   'pending',
      });

      // OTP inserted inside the transaction so it rolls back with the user
      // if the insert fails for any reason.
      await this._sendOtp(user.id, user.email, 'email_verify', trx);

      // Notify all admins via in-app notification
      const admins = await trx('users').where('role', 'admin').select('id');
      for (const admin of admins) {
        await trx('notifications').insert({
          id:         uuidv4(),
          user_id:    admin.id,
          type:       'seller_approval',
          channel:    'in_app',
          title:      'New seller registration',
          body:       `${data.business_name.trim()} has registered and is awaiting approval.`,
          action_url: '/admin/sellers/pending',
        });
      }

      return user;
    });
  },

  // ── Req 3.1.2: Secure Login ───────────────────────────────────────────────
  async login(email: string, password: string, rememberMe = false) {
    validateEmail(email);
    if (!password) throw AppError.badRequest('Password is required');

    // Single DB query — fetch user regardless of existence so timing is consistent
    const user = await db('users').where('email', email.trim().toLowerCase()).first();

    // Constant-time: always compare even if user is null (dummy hash)
    // This prevents timing attacks that reveal whether an email is registered.
    const dummyHash = '$2a$12$invalidhashpaddingtomaketiminguniform000000000000000000';
    const validPassword = user
      ? await bcrypt.compare(password, user.password_hash)
      : await bcrypt.compare(password, dummyHash).then(() => false);

    // Unified error for "no user" and "wrong password" — prevents enumeration
    if (!user || !validPassword) {
      throw AppError.unauthorized('Invalid email or password');
    }

    if (!user.is_active || user.is_suspended) {
      throw AppError.forbidden('Your account has been suspended. Please contact support.');
    }

    if (!user.email_verified) {
      throw AppError.forbidden('Please verify your email before logging in');
    }

    // Fetch seller profile if needed — do NOT log full JSON (security)
    let sellerId: string | undefined;
    if (user.role === 'seller') {
      const sp = await db('seller_profiles').where('user_id', user.id).first();
      if (sp?.status === 'suspended') {
        throw AppError.forbidden('Your seller account has been suspended.');
      }
      sellerId = sp?.id;
    }

    await db('users').where('id', user.id).update({ last_login_at: new Date() });

    const tokenPayload = {
      userId:   user.id,
      email:    user.email,
      role:     user.role,
      sellerId,
    };

    return {
      access_token:  signAccessToken(tokenPayload),
      refresh_token: signRefreshToken(tokenPayload, rememberMe),
      user: {
        id:                user.id,
        email:             user.email,
        role:              user.role,
        first_name:        user.first_name,
        last_name:         user.last_name,
        profile_image_url: user.profile_image_url,
        email_verified:    user.email_verified,
      },
    };
  },

  // ── Req 3.1.2: Token Refresh ──────────────────────────────────────────────
  // Issues a new access + refresh token pair.
  // The new refresh token replaces the old one (rotation).
  async refreshToken(refreshToken: string) {
    const { verifyRefreshToken } = await import('../../config/jwt');
    const payload = verifyRefreshToken(refreshToken);

    const user = await db('users').where('id', payload.userId).first();
    if (!user || !user.is_active) throw AppError.unauthorized('Session expired. Please log in again.');

    // Re-fetch sellerId in case it changed (profile linked after token was issued)
    let sellerId = payload.sellerId;
    if (user.role === 'seller') {
      const sp = await db('seller_profiles').where('user_id', user.id).first();
      sellerId  = sp?.id;
    }

    const tokenPayload = {
      userId:   user.id,
      email:    user.email,
      role:     user.role,
      sellerId,
    };

    return {
      access_token:  signAccessToken(tokenPayload),
      refresh_token: signRefreshToken(tokenPayload),
    };
  },

  // ── Req 3.1.1: Verify OTP ────────────────────────────────────────────────
  async verifyOtp(userId: string, token: string, purpose: string) {
    if (!userId || !token || !purpose) {
      throw AppError.badRequest('user_id, token, and purpose are required');
    }

    // Development shortcut: token '000000' bypasses OTP check.
    // NEVER active in production.
    if (process.env.NODE_ENV !== 'production' && token === '000000') {
      await db('users').where('id', userId).update({ email_verified: true });
      if (purpose === 'email_verify') {
        const user = await db('users').where('id', userId).first();
        return { verified: true, user };
      }
      return { verified: true };
    }

    const otpRecord = await db('otp_tokens')
      .where({ user_id: userId, purpose, is_used: false })
      .where('expires_at', '>', new Date())
      .orderBy('created_at', 'desc')
      .first();

    if (!otpRecord) throw AppError.badRequest('OTP not found or expired');

    // Lock the account after 5 wrong attempts — prevents brute-force
    if (otpRecord.attempts >= 5) {
      throw AppError.badRequest('Too many incorrect attempts. Please request a new code.');
    }

    const hashedInput = crypto.createHash('sha256').update(token).digest('hex');

    if (otpRecord.token !== hashedInput) {
      await db('otp_tokens').where('id', otpRecord.id).increment('attempts', 1);
      const remaining = 4 - otpRecord.attempts;
      throw AppError.badRequest(
        remaining > 0
          ? `Incorrect code. ${remaining} attempt(s) remaining.`
          : 'Too many incorrect attempts. Please request a new code.',
      );
    }

    // Mark used and update user flags atomically
    await db.transaction(async (trx) => {
      await trx('otp_tokens').where('id', otpRecord.id).update({ is_used: true });

      if (purpose === 'email_verify') {
        await trx('users').where('id', userId).update({ email_verified: true });
      } else if (purpose === 'phone_verify') {
        await trx('users').where('id', userId).update({ phone_verified: true });
      }
      // 'password_reset' purpose: no flag update here — resetPassword() does it
    });

    return { verified: true };
  },

  // ── Req 3.1.1: Resend OTP ────────────────────────────────────────────────
  async resendOtp(email: string, purpose: 'email_verify' | 'phone_verify') {
    validateEmail(email);
    const user = await db('users').where('email', email.trim().toLowerCase()).first();
    // Always return success — prevents user enumeration via resend endpoint
    if (!user) return { sent: true };
    await this._sendOtp(user.id, user.email, purpose);
    return { sent: true };
  },

  // ── Req 3.1.1: Forgot Password ───────────────────────────────────────────
  async forgotPassword(email: string) {
    validateEmail(email);
    const user = await db('users').where('email', email.trim().toLowerCase()).first();
    // Always return success — prevents email enumeration
    if (!user) return { sent: true };
    await this._sendOtp(user.id, user.email, 'password_reset');
    return { sent: true };
  },

  // ── Req 3.1.1: Reset Password ─────────────────────────────────────────────
  async resetPassword(userId: string, token: string, newPassword: string) {
    validatePassword(newPassword);
    // verifyOtp validates the reset token, marks it used
    await this.verifyOtp(userId, token, 'password_reset');
    const password_hash = await bcrypt.hash(newPassword, 12);
    await db('users').where('id', userId).update({ password_hash });
    return { reset: true };
  },

  // ── Internal: Generate OTP, store hash, fire email ───────────────────────
  //
  // This method is intentionally marked with underscore prefix — it is
  // internal to the service and should not be called from controllers.
  //
  // Flow:
  //   1. Generate 6-digit OTP with CSPRNG (crypto.randomInt)
  //   2. Invalidate any previous unused OTPs for same user+purpose
  //   3. Store SHA-256 hash of OTP (never plaintext) with 10-min expiry
  //   4. Log OTP to console in development (avoids needing real SMTP in dev)
  //   5. Fire email ASYNCHRONOUSLY — does NOT await, does NOT block caller
  async _sendOtp(
    userId:   string,
    email:    string,
    purpose:  string,
    trxOrDb = db as any,
  ): Promise<void> {
    // crypto.randomInt(min, max) is exclusive of max → range 100000–999999
    const otp    = crypto.randomInt(100_000, 1_000_000).toString();
    const hashed = crypto.createHash('sha256').update(otp).digest('hex');
    const expiry = new Date(Date.now() + 10 * 60 * 1_000); // 10 minutes

    // Invalidate all previous unused OTPs for this user+purpose
    await trxOrDb('otp_tokens')
      .where({ user_id: userId, purpose, is_used: false })
      .update({ is_used: true });

    await trxOrDb('otp_tokens').insert({
      id:         uuidv4(),
      user_id:    userId,
      token:      hashed,
      purpose,
      expires_at: expiry,
    });

    // Development: print plaintext OTP so dev can test without SMTP
    if (process.env.NODE_ENV !== 'production') {
      logger.info('─'.repeat(52));
      logger.info(`  OTP  [${purpose}] for ${email}`);
      logger.info(`  Code : ${otp}`);
      logger.info(`  Expires: ${expiry.toLocaleTimeString()}`);
      logger.info('─'.repeat(52));
    }

    const subject = purpose === 'password_reset'
      ? 'Reset your AddisMarket password'
      : 'Verify your AddisMarket email';

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#7c3aed;margin-bottom:8px">
          ${purpose === 'password_reset' ? 'Reset your password' : 'Verify your email'}
        </h2>
        <p style="color:#374151;margin-bottom:24px">
          ${purpose === 'password_reset'
            ? 'Use the code below to reset your AddisMarket password.'
            : 'Use the code below to verify your AddisMarket email address.'}
        </p>
        <div style="background:#f3f4f6;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
          <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:#111827;font-family:monospace">
            ${otp}
          </span>
        </div>
        <p style="color:#6b7280;font-size:14px">
          This code expires in <strong>10 minutes</strong>.<br>
          If you did not request this, please ignore this email.
        </p>
      </div>
    `;

    // FIRE-AND-FORGET: do not await.
    // The OTP is already in the DB. If email fails, user can resend.
    // Awaiting would block for up to 30s on SMTP timeout → request 503.
    notificationService.sendEmail({
      to:      email,
      subject,
      text:    `Your verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, please ignore this email.`,
      html,
    }).catch((err: any) => {
      // Already caught inside sendEmail, but .catch() here prevents
      // unhandled rejection warnings in case of unexpected throw
      logger.error(`[auth] Unhandled email error for ${email}: ${err?.message}`);
    });
  },
};