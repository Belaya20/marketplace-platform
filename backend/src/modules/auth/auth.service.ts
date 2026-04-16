// backend/src/modules/auth/auth.service.ts
//
// Req 3.1.1: Registration, Email/OTP verification, Password reset
// Req 3.1.2: Secure login, Remember Me, JWT rotation
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OTP SECURITY MODEL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
//  Generation:   crypto.randomInt(100000, 1000000) — OS CSPRNG, not Math.random()
//  Storage:      SHA-256 hash only — plaintext never touches the DB
//  Expiry:       10 minutes
//  Attempts:     Max 5 wrong attempts per token, then invalidated
//  Resend:       60-second per-user cooldown (independent of IP rate limiter)
//  Cleanup:      Old expired/used tokens pruned on every new OTP generation
//  Delivery:     Fire-and-forget email (OTP already in DB before email attempt)
//                → Works without email: Railway logs always show the code
//                → Works with SKIP_EMAIL_VERIFY=true Railway var (testing)
//                → Works fully once SMTP vars are set in Railway
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SELLER APPROVAL GATE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
//  Register → status='pending' → email verify → still pending
//  Admin approves → status='approved' → seller can now log in
//
//  Login is blocked for: pending, rejected, suspended sellers.
//  Only 'approved' sellers reach a JWT token.
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ENVIRONMENT VARIABLES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
//  SKIP_EMAIL_VERIFY=true   Bypass OTP check (production testing, remove after)
//  SMTP_HOST/PORT/USER/PASS  Email delivery — OTP works without these via logs

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import db from '../../config/database';
import { signAccessToken, signRefreshToken } from '../../config/jwt';
import { AppError } from '../../utils/response';
import { notificationService } from '../notifications/notification.service';
import logger from '../../config/logger';

// ── Constants ─────────────────────────────────────────────────────────────────

const OTP_EXPIRY_MS      = 10 * 60 * 1_000;  // 10 minutes
const OTP_RESEND_COOLDOWN = 60;              // seconds between resend requests per user
const OTP_MAX_ATTEMPTS   = 5;               // wrong guesses before token is voided
const EMAIL_REGEX        = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Helpers ───────────────────────────────────────────────────────────────────

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

  // ── Customer Registration ─────────────────────────────────────────────────
  async registerCustomer(data: {
    email:       string;
    phone?:      string;
    password:    string;
    first_name?: string;
    last_name?:  string;
  }) {
    validateEmail(data.email);
    validatePassword(data.password);

    const normalEmail = data.email.trim().toLowerCase();
    const exists      = await db('users').where('email', normalEmail).first();
    if (exists) throw AppError.conflict('Email already registered');

    const password_hash = await bcrypt.hash(data.password, 12);
    const [user]        = await db('users').insert({
      id:           uuidv4(),
      email:        normalEmail,
      phone:        data.phone || null,
      password_hash,
      role:         'customer',
      first_name:   data.first_name?.trim() || null,
      last_name:    data.last_name?.trim()  || null,
    }).returning(['id', 'email', 'role', 'email_verified', 'first_name', 'last_name']);

    await this._sendOtp(user.id, user.email, 'email_verify');
    return user;
  },

  // ── Seller Registration ───────────────────────────────────────────────────
  async registerSeller(data: {
    email:                     string;
    phone?:                    string;
    password:                  string;
    first_name?:               string;
    last_name?:                string;
    business_name:             string;
    business_registration_no?: string;
    tax_id?:                   string;
    business_address?:         string;
  }) {
    validateEmail(data.email);
    validatePassword(data.password);
    if (!data.business_name?.trim()) throw AppError.badRequest('Business name is required');

    const normalEmail = data.email.trim().toLowerCase();
    const exists      = await db('users').where('email', normalEmail).first();
    if (exists) throw AppError.conflict('Email already registered');

    const password_hash = await bcrypt.hash(data.password, 12);

    return db.transaction(async (trx) => {
      const [user] = await trx('users').insert({
        id:           uuidv4(),
        email:        normalEmail,
        phone:        data.phone || null,
        password_hash,
        role:         'seller',
        first_name:   data.first_name?.trim() || null,
        last_name:    data.last_name?.trim()  || null,
      }).returning(['id', 'email', 'role']);

      // status='pending' — seller cannot log in until admin approves
      await trx('seller_profiles').insert({
        id:                       uuidv4(),
        user_id:                  user.id,
        business_name:            data.business_name.trim(),
        business_registration_no: data.business_registration_no || null,
        tax_id:                   data.tax_id           || null,
        business_address:         data.business_address || null,
        status:                   'pending',
      });

      // OTP inside transaction so it rolls back if anything fails
      await this._sendOtp(user.id, user.email, 'email_verify', trx);

      // Notify all admins in-app
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

  // ── Login ─────────────────────────────────────────────────────────────────
  //
  // Seller approval gate:
  //   pending   → blocked (cannot login even after email verification)
  //   rejected  → blocked
  //   suspended → blocked
  //   approved  → allowed
  //
  // Constant-time password check prevents email enumeration via timing.
  async login(email: string, password: string, rememberMe = false) {
    validateEmail(email);
    if (!password) throw AppError.badRequest('Password is required');

    const normalEmail = email.trim().toLowerCase();
    const user        = await db('users').where('email', normalEmail).first();

    // Always run bcrypt even for missing users — prevents timing attacks
    const dummyHash  = '$2a$12$invalidhashpaddingtomaketiminguniform000000000000000000';
    const validPass  = user
      ? await bcrypt.compare(password, user.password_hash)
      : await bcrypt.compare(password, dummyHash).then(() => false);

    if (!user || !validPass) throw AppError.unauthorized('Invalid email or password');

    if (!user.is_active || user.is_suspended) {
      throw AppError.forbidden('Your account has been suspended. Please contact support.');
    }
    if (!user.email_verified) {
      throw AppError.forbidden('Please verify your email before logging in');
    }

    // ── Seller approval gate ──────────────────────────────────────────────
    let sellerId: string | undefined;
    if (user.role === 'seller') {
      const sp = await db('seller_profiles').where('user_id', user.id).first();

      if (!sp) {
        throw AppError.forbidden('Seller profile not found. Please contact support.');
      }

      switch (sp.status) {
        case 'approved':
          sellerId = sp.id;
          break;

        case 'pending':
          throw AppError.forbidden(
            'Your seller account is pending admin approval. ' +
            'You will receive an email notification once your account is reviewed.'
          );

        case 'rejected':
          throw AppError.forbidden(
            `Your seller application was not approved.` +
            (sp.rejection_reason ? ` Reason: ${sp.rejection_reason}` : ' Please contact support.')
          );

        case 'suspended':
          throw AppError.forbidden('Your seller account has been suspended. Please contact support.');

        default:
          throw AppError.forbidden('Your seller account status is invalid. Please contact support.');
      }
    }

    await db('users').where('id', user.id).update({ last_login_at: new Date() });

    const payload = { userId: user.id, email: user.email, role: user.role, sellerId };
    return {
      access_token:  signAccessToken(payload),
      refresh_token: signRefreshToken(payload, rememberMe),
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

  // ── Token Refresh ─────────────────────────────────────────────────────────
  async refreshToken(refreshToken: string) {
    const { verifyRefreshToken } = await import('../../config/jwt');
    const payload = verifyRefreshToken(refreshToken);

    const user = await db('users').where('id', payload.userId).first();
    if (!user || !user.is_active) {
      throw AppError.unauthorized('Session expired. Please log in again.');
    }

    let sellerId = payload.sellerId;
    if (user.role === 'seller') {
      const sp = await db('seller_profiles').where('user_id', user.id).first();
      sellerId  = sp?.id;
    }

    const newPayload = { userId: user.id, email: user.email, role: user.role, sellerId };
    return {
      access_token:  signAccessToken(newPayload),
      refresh_token: signRefreshToken(newPayload),
    };
  },

  // ── Verify OTP ────────────────────────────────────────────────────────────
  //
  // Three modes (checked in order):
  //   1. SKIP_EMAIL_VERIFY=true (Railway var) — bypass for production testing
  //   2. NODE_ENV !== 'production' + token='000000' — dev convenience bypass
  //   3. Normal DB lookup + SHA-256 comparison
  //
  // Also returns isSeller flag so the frontend can show the correct
  // post-verification message ("wait for approval" vs "you can log in").
  async verifyOtp(userId: string, token: string, purpose: string) {
    if (!userId || !token || !purpose) {
      throw AppError.badRequest('user_id, token, and purpose are required');
    }

    // ── Mode 1: Production testing bypass ────────────────────────────────
    // Set SKIP_EMAIL_VERIFY=true in Railway Variables to bypass OTP check.
    // Any 6-digit code is accepted. Remove this var once SMTP is working.
    if (process.env.SKIP_EMAIL_VERIFY === 'true') {
      logger.warn(`[otp] SKIP_EMAIL_VERIFY bypass used for ${userId} — remove this env var`);
      return await this._completeVerification(userId, purpose);
    }

    // ── Mode 2: Development bypass ───────────────────────────────────────
    // Works only in non-production. Enter '000000' as the code.
    if (process.env.NODE_ENV !== 'production' && token === '000000') {
      logger.info(`[otp] Dev bypass used for ${userId}`);
      return await this._completeVerification(userId, purpose);
    }

    // ── Mode 3: Normal OTP verification ──────────────────────────────────
    const otpRecord = await db('otp_tokens')
      .where({ user_id: userId, purpose, is_used: false })
      .where('expires_at', '>', new Date())
      .orderBy('created_at', 'desc')
      .first();

    if (!otpRecord) throw AppError.badRequest('Verification code not found or expired. Please request a new one.');

    if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
      throw AppError.badRequest('Too many incorrect attempts. Please request a new code.');
    }

    const hashedInput = crypto.createHash('sha256').update(token).digest('hex');
    if (otpRecord.token !== hashedInput) {
      await db('otp_tokens').where('id', otpRecord.id).increment('attempts', 1);
      const left = OTP_MAX_ATTEMPTS - otpRecord.attempts - 1;
      throw AppError.badRequest(
        left > 0 ? `Incorrect code. ${left} attempt(s) remaining.`
                 : 'Too many incorrect attempts. Please request a new code.'
      );
    }

    // Mark used before completing so concurrent requests can't double-verify
    await db('otp_tokens').where('id', otpRecord.id).update({ is_used: true });
    return await this._completeVerification(userId, purpose);
  },

  // ── Resend OTP ────────────────────────────────────────────────────────────
  //
  // Per-user cooldown: checks if a non-expired OTP was created in the last
  // 60 seconds for this user+purpose. If yes, returns the remaining wait time
  // instead of generating a new OTP. This prevents OTP spam regardless of IP.
  async resendOtp(email: string, purpose: 'email_verify' | 'phone_verify') {
    validateEmail(email);
    const user = await db('users').where('email', email.trim().toLowerCase()).first();
    // Always return success to prevent email enumeration
    if (!user) return { sent: true, cooldown: false };

    // Check per-user cooldown
    const recent = await db('otp_tokens')
      .where({ user_id: user.id, purpose })
      .where('created_at', '>', new Date(Date.now() - OTP_RESEND_COOLDOWN * 1_000))
      .orderBy('created_at', 'desc')
      .first();

    if (recent) {
      const elapsed = Math.floor((Date.now() - new Date(recent.created_at).getTime()) / 1_000);
      const remaining = OTP_RESEND_COOLDOWN - elapsed;
      if (remaining > 0) {
        throw AppError.badRequest(
          `Please wait ${remaining} second(s) before requesting a new code.`
        );
      }
    }

    await this._sendOtp(user.id, user.email, purpose);
    return { sent: true, cooldown: false };
  },

  // ── Forgot Password ───────────────────────────────────────────────────────
  async forgotPassword(email: string) {
    validateEmail(email);
    const user = await db('users').where('email', email.trim().toLowerCase()).first();
    if (!user) return { sent: true }; // prevent enumeration
    await this._sendOtp(user.id, user.email, 'password_reset');
    return { sent: true };
  },

  // ── Reset Password ────────────────────────────────────────────────────────
  async resetPassword(userId: string, token: string, newPassword: string) {
    validatePassword(newPassword);
    await this.verifyOtp(userId, token, 'password_reset');
    const password_hash = await bcrypt.hash(newPassword, 12);
    await db('users').where('id', userId).update({ password_hash });
    return { reset: true };
  },

  // ── Internal: Complete verification ──────────────────────────────────────
  // Shared by all three OTP modes. Updates DB flags and returns user info
  // including isSeller so the frontend can branch the success message.
  async _completeVerification(userId: string, purpose: string) {
    await db.transaction(async (trx) => {
      if (purpose === 'email_verify') {
        await trx('users').where('id', userId).update({ email_verified: true });
      } else if (purpose === 'phone_verify') {
        await trx('users').where('id', userId).update({ phone_verified: true });
      }
      // 'password_reset': no flag update — resetPassword() handles it
    });

    const user = await db('users').where('id', userId).first();
    const sp   = user?.role === 'seller'
      ? await db('seller_profiles').where('user_id', userId).select('status').first()
      : null;

    return {
      verified:     true,
      isSeller:     user?.role === 'seller',
      sellerStatus: sp?.status ?? null,  // 'pending' | 'approved' | 'rejected' | null
    };
  },

  // ── Internal: Generate OTP, store hash, fire email ───────────────────────
  //
  // Steps:
  //  1. Generate 6-digit CSPRNG OTP
  //  2. SHA-256 hash it before DB insert (plaintext never stored)
  //  3. Invalidate all previous unused OTPs for this user+purpose
  //  4. Insert new OTP record with 10-min expiry
  //  5. Cleanup: delete expired/used tokens older than 24h (housekeeping)
  //  6. Log plaintext OTP to server console (visible in Railway logs — no email needed)
  //  7. Fire email asynchronously — failure never blocks the request
  async _sendOtp(
    userId:   string,
    email:    string,
    purpose:  string,
    trxOrDb = db as any,
  ): Promise<void> {
    const otp    = crypto.randomInt(100_000, 1_000_000).toString();
    const hashed = crypto.createHash('sha256').update(otp).digest('hex');
    const expiry = new Date(Date.now() + OTP_EXPIRY_MS);

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

    // Cleanup expired/used tokens older than 24h to keep otp_tokens table lean.
    // Fire-and-forget: failure should never block OTP generation.
    db('otp_tokens')
      .where('expires_at', '<', new Date(Date.now() - 24 * 60 * 60 * 1_000))
      .delete()
      .catch((e: any) => logger.warn('[otp] Cleanup failed:', e.message));

    // ── Log OTP to server console ─────────────────────────────────────────
    // This is the PRIMARY delivery mechanism when email is not configured.
    // In Railway: open Deploy Logs to see the code.
    // Works in ALL environments — no external service needed.
    logger.info('━'.repeat(54));
    logger.info(`  OTP VERIFICATION CODE`);
    logger.info(`  Purpose : ${purpose}`);
    logger.info(`  Email   : ${email}`);
    logger.info(`  Code    : ${otp}`);
    logger.info(`  Expires : ${expiry.toISOString()}`);
    logger.info('━'.repeat(54));

    // ── Email (fire-and-forget) ───────────────────────────────────────────
    // OTP is already in DB above. Email is best-effort.
    // If SMTP fails: user checks Railway logs OR sets SKIP_EMAIL_VERIFY=true.
    const subject = purpose === 'password_reset'
      ? 'Reset your AddisMarket password'
      : 'Verify your AddisMarket account';

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff">
        <div style="text-align:center;margin-bottom:24px">
          <div style="display:inline-block;background:#7c3aed;color:white;font-weight:900;font-size:20px;padding:8px 20px;border-radius:10px;letter-spacing:1px">
            AddisMarket
          </div>
        </div>
        <h2 style="color:#111827;font-size:22px;font-weight:700;margin-bottom:8px;text-align:center">
          ${purpose === 'password_reset' ? 'Reset your password' : 'Verify your account'}
        </h2>
        <p style="color:#6b7280;font-size:15px;text-align:center;margin-bottom:28px">
          ${purpose === 'password_reset'
            ? 'Enter this code to set a new password for your AddisMarket account.'
            : 'Enter this code to activate your AddisMarket account.'}
        </p>
        <div style="background:#f3f4f6;border-radius:16px;padding:28px;text-align:center;margin-bottom:24px">
          <span style="font-size:42px;font-weight:900;letter-spacing:10px;color:#7c3aed;font-family:monospace">
            ${otp}
          </span>
          <p style="color:#9ca3af;font-size:13px;margin-top:12px;margin-bottom:0">
            Valid for 10 minutes
          </p>
        </div>
        <p style="color:#9ca3af;font-size:13px;text-align:center">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `;

    notificationService.sendEmail({
      to:      email,
      subject,
      text:    `Your AddisMarket verification code is: ${otp}\n\nValid for 10 minutes.\n\nIf you didn't request this, ignore this email.`,
      html,
    }).catch((err: any) => {
      logger.error(`[otp] Email delivery failed for ${email}: ${err?.message}`);
    });
  },
};