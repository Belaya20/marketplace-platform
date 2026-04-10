// src/modules/auth/auth.service.ts
// Req 3.1.1: Customer registration, Seller registration, Email/OTP verification, Password reset
// Req 3.1.2: Secure login, Remember me option
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import db from '../../config/database';
import { signAccessToken, signRefreshToken } from '../../config/jwt';
import { AppError } from '../../utils/response';
import { notificationService } from '../notifications/notification.service';
import logger from '../../config/logger';

export const authService = {

  // ── Req 3.1.1: Customer Registration ─────────────────────────────────────
  async registerCustomer(data: {
    email: string; phone?: string; password: string;
    first_name?: string; last_name?: string;
  }) {
    const exists = await db('users').where('email', data.email).first();
    if (exists) throw AppError.conflict('Email already registered');

    const password_hash = await bcrypt.hash(data.password, 12);
    const [user] = await db('users').insert({
      id: uuidv4(), email: data.email, phone: data.phone || null,
      password_hash, role: 'customer',
      first_name: data.first_name, last_name: data.last_name,
    }).returning(['id','email','role','email_verified','first_name','last_name']);

    // Send verification OTP
    await this._sendOtp(user.id, user.email, 'email_verify');
    return user;
  },

  // ── Req 3.1.1: Seller Registration ───────────────────────────────────────
  async registerSeller(data: {
    email: string; phone?: string; password: string;
    first_name?: string; last_name?: string;
    business_name: string; business_registration_no?: string;
    tax_id?: string; business_address?: string;
  }) {
    const exists = await db('users').where('email', data.email).first();
    if (exists) throw AppError.conflict('Email already registered');

    const password_hash = await bcrypt.hash(data.password, 12);

    return db.transaction(async (trx) => {
      const [user] = await trx('users').insert({
        id: uuidv4(), email: data.email, phone: data.phone || null,
        password_hash, role: 'seller',
        first_name: data.first_name, last_name: data.last_name,
      }).returning(['id','email','role']);

      // Create seller profile — status: 'pending' (Req 3.4.2: Admin must approve)
      await trx('seller_profiles').insert({
        id: uuidv4(), user_id: user.id,
        business_name: data.business_name,
        business_registration_no: data.business_registration_no || null,
        tax_id: data.tax_id || null,
        business_address: data.business_address || null,
        status: 'pending',
      });

      await this._sendOtp(user.id, user.email, 'email_verify', trx);

      // Notify admins of new seller registration
      const admins = await trx('users').where('role', 'admin').select('id');
      for (const admin of admins) {
        await trx('notifications').insert({
          id: uuidv4(), user_id: admin.id,
          type: 'seller_approval', channel: 'in_app',
          title: 'New seller registration',
          body: `${data.business_name} has registered and is awaiting approval.`,
          action_url: '/admin/sellers/pending',
        });
      }
      return user;
    });
  },

  // ── Req 3.1.2: Secure Login ───────────────────────────────────────────────
  async login(email: string, password: string, rememberMe = false) {
    const user = await db('users')
      .where('email', email)
      .first();

    if (!user) throw AppError.unauthorized('Invalid email or password');
    if (!user.is_active || user.is_suspended) throw AppError.forbidden('Account is suspended');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw AppError.unauthorized('Invalid email or password');

    if (!user.email_verified) {
      throw AppError.forbidden('Please verify your email before logging in');
    }

    // Get seller profile if seller
    let sellerId: string | undefined;
    if (user.role === 'seller') {
      const sp = await db('seller_profiles').where('user_id', user.id).first();
      logger.info('DEBUG LOGIN: user.id=' + user.id + ' sp=' + JSON.stringify(sp));
      if (sp?.status === 'suspended') throw AppError.forbidden('Seller account suspended');
      sellerId = sp?.id;
      logger.info('DEBUG LOGIN: sellerId set to=' + sellerId);
    }

    // Update last_login_at
    await db('users').where('id', user.id).update({ last_login_at: new Date() });

    const tokenPayload = {
      userId: user.id, email: user.email,
      role: user.role, sellerId,
    };

    return {
      access_token:  signAccessToken(tokenPayload),
      refresh_token: signRefreshToken(tokenPayload, rememberMe),
      user: {
        id: user.id, email: user.email, role: user.role,
        first_name: user.first_name, last_name: user.last_name,
        profile_image_url: user.profile_image_url, email_verified: user.email_verified,
      },
    };
  },

  // ── Req 3.1.2: Token Refresh ──────────────────────────────────────────────
  async refreshToken(refreshToken: string) {
    const { verifyRefreshToken } = await import('../../config/jwt');
    const payload = verifyRefreshToken(refreshToken);

    const user = await db('users').where('id', payload.userId).first();
    if (!user || !user.is_active) throw AppError.unauthorized('User not found');

    let sellerId = payload.sellerId;
    if (user.role === 'seller') {
      const sp = await db('seller_profiles').where('user_id', user.id).first();
      logger.info('DEBUG REFRESH: user.id=' + user.id + ' sp=' + JSON.stringify(sp) + ' old_sellerId=' + payload.sellerId);
      sellerId = sp?.id;
      logger.info('DEBUG REFRESH: new sellerId=' + sellerId);
    }

    const tokenPayload = { userId: user.id, email: user.email, role: user.role, sellerId };
    return {
      access_token:  signAccessToken(tokenPayload),
      refresh_token: signRefreshToken(tokenPayload),
    };
  },

  // ── Req 3.1.1: Verify Email OTP ──────────────────────────────────────────
  async verifyOtp(userId: string, token: string, purpose: string) {
    // DEV BYPASS: if token is '000000', auto-verify without checking DB
    if (process.env.NODE_ENV !== 'production' && token === '000000') {
      logger.info('DEV BYPASS: auto-verifying OTP for user ' + userId);
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
    if (otpRecord.attempts >= 5) throw AppError.badRequest('Too many wrong OTP attempts');

    const hashedInput = crypto.createHash('sha256').update(token).digest('hex');
    if (otpRecord.token !== hashedInput) {
      await db('otp_tokens').where('id', otpRecord.id).increment('attempts', 1);
      throw AppError.badRequest('Invalid OTP code');
    }

    await db.transaction(async (trx) => {
      await trx('otp_tokens').where('id', otpRecord.id).update({ is_used: true });
      if (purpose === 'email_verify') {
        await trx('users').where('id', userId).update({ email_verified: true });
      } else if (purpose === 'phone_verify') {
        await trx('users').where('id', userId).update({ phone_verified: true });
      }
    });

    return { verified: true };
  },

  // ── Req 3.1.1: Resend OTP ─────────────────────────────────────────────────
  async resendOtp(email: string, purpose: 'email_verify' | 'phone_verify') {
    const user = await db('users').where('email', email).first();
    if (!user) throw AppError.notFound('User not found');
    await this._sendOtp(user.id, user.email, purpose);
    return { sent: true };
  },

  // ── Req 3.1.1: Forgot Password ────────────────────────────────────────────
  async forgotPassword(email: string) {
    const user = await db('users').where('email', email).first();
    // Always respond success to prevent user enumeration
    if (!user) return { sent: true };
    await this._sendOtp(user.id, user.email, 'password_reset');
    return { sent: true };
  },

  // ── Req 3.1.1: Reset Password ─────────────────────────────────────────────
  async resetPassword(userId: string, token: string, newPassword: string) {
    await this.verifyOtp(userId, token, 'password_reset');
    const password_hash = await bcrypt.hash(newPassword, 12);
    await db('users').where('id', userId).update({ password_hash });
    return { reset: true };
  },

  // ─── Internal: Generate & store hashed OTP, send email ───────────────────
  async _sendOtp(userId: string, email: string, purpose: string, trxOrDb = db as any) {
    // 6-digit numeric OTP
    const otp    = Math.floor(100000 + Math.random() * 900000).toString();
    const hashed = crypto.createHash('sha256').update(otp).digest('hex');
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate previous unused OTPs for same purpose
    await trxOrDb('otp_tokens')
      .where({ user_id: userId, purpose, is_used: false })
      .update({ is_used: true });

    await trxOrDb('otp_tokens').insert({
      id: uuidv4(), user_id: userId,
      token: hashed, purpose,
      expires_at: expiry,
    });

    // DEV: Always print OTP to terminal so you can test without email config
    if (process.env.NODE_ENV !== 'production') {
      logger.info('='.repeat(50));
      logger.info('OTP CODE for ' + email + ' [' + purpose + ']: ' + otp);
      logger.info('Expires: ' + expiry.toLocaleTimeString());
      logger.info('='.repeat(50));
    }

    // Send email notification
    await notificationService.sendEmail({
      to: email,
      subject: purpose === 'password_reset'
        ? 'Reset your password — Marketplace'
        : 'Verify your email — Marketplace',
      text: `Your verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, please ignore this email.`,
    });
  },
};
