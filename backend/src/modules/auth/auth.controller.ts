

import { Response, NextFunction, Router, IRouter } from 'express';
import { authService } from './auth.service';
import { AuthRequest } from '../../types';
import { success, created, AppError } from '../../utils/response';
import { authLimiter, otpLimiter } from '../../middleware';
import db from '../../config/database';

// ── Controllers ───────────────────────────────────────────────────────────────

export const authController = {

  // POST /api/v1/auth/register/customer
  async registerCustomer(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, first_name, last_name, phone } = req.body;
      if (!email || !password) {
        throw AppError.badRequest('Email and password are required');
      }
      const user = await authService.registerCustomer({
        email, password, first_name, last_name, phone,
      });
      created(res, user, 'Registration successful. Please verify your email with the OTP sent.');
    } catch (err) { next(err); }
  },

  // POST /api/v1/auth/register/seller
  async registerSeller(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, business_name } = req.body;
      if (!email || !password) {
        throw AppError.badRequest('Email and password are required');
      }
      if (!business_name) {
        throw AppError.badRequest('Business name is required');
      }
      const user = await authService.registerSeller(req.body);
      created(res, user, 'Seller registration submitted. Verify your email then await admin approval.');
    } catch (err) { next(err); }
  },

  // POST /api/v1/auth/login
  async login(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, remember_me } = req.body;
      if (!email || !password) {
        throw AppError.badRequest('Email and password are required');
      }
      const result = await authService.login(email, password, remember_me === true);
      success(res, result, 'Login successful');
    } catch (err) { next(err); }
  },

  // POST /api/v1/auth/refresh
  async refresh(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refresh_token } = req.body;
      if (!refresh_token) {
        throw AppError.badRequest('refresh_token is required');
      }
      const tokens = await authService.refreshToken(refresh_token);
      success(res, tokens, 'Token refreshed');
    } catch (err) { next(err); }
  },

  // POST /api/v1/auth/verify-otp
  async verifyOtp(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      let { user_id, token, purpose } = req.body;

      if (!token || !purpose) {
        throw AppError.badRequest('token and purpose are required');
      }
      if (!user_id) {
        throw AppError.badRequest('user_id is required');
      }

      // Support passing email as user_id (frontend redirects without user_id sometimes)
      // Look up the actual UUID from the email address.
      if (user_id.includes('@')) {
        const user = await db('users').where({ email: user_id.trim().toLowerCase() }).first();
        if (!user) {
          throw AppError.badRequest('No account found for that email address');
        }
        user_id = user.id;
      }

      const result = await authService.verifyOtp(user_id, token, purpose);
      success(res, result, 'Verification successful');
    } catch (err) { next(err); }
  },

  // POST /api/v1/auth/resend-otp
  async resendOtp(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, purpose } = req.body;
      if (!email) throw AppError.badRequest('email is required');
      if (!purpose) throw AppError.badRequest('purpose is required');
      const result = await authService.resendOtp(email, purpose);
      success(res, result, 'OTP sent to your email');
    } catch (err) { next(err); }
  },

  // POST /api/v1/auth/forgot-password
  async forgotPassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      if (!email) throw AppError.badRequest('email is required');
      await authService.forgotPassword(email);
      // Always respond success — never reveal whether the email is registered
      success(res, null, 'If this email is registered, a reset code has been sent');
    } catch (err) { next(err); }
  },

  // POST /api/v1/auth/reset-password
  async resetPassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user_id, token, new_password } = req.body;
      if (!user_id || !token || !new_password) {
        throw AppError.badRequest('user_id, token, and new_password are required');
      }
      await authService.resetPassword(user_id, token, new_password);
      success(res, null, 'Password reset successful. Please log in with your new password.');
    } catch (err) { next(err); }
  },
};

// ── Router ────────────────────────────────────────────────────────────────────
// Typed as IRouter — removes the deep pnpm DefinitelyTyped path error.
const router: IRouter = Router();

// Req 3.1.1: Registration
router.post('/register/customer', authLimiter, authController.registerCustomer);
router.post('/register/seller',   authLimiter, authController.registerSeller);

// Req 3.1.2: Login + stateless logout + token rotation
router.post('/login',   authLimiter, authController.login);
router.post('/refresh',             authController.refresh);
router.post('/logout',  (_req: AuthRequest, res: Response) => {
  // JWT is stateless — logout is handled client-side by discarding the token.
  // For a blacklist implementation, store jti in Redis here.
  success(res, null, 'Logged out successfully');
});

// Req 3.1.1: OTP lifecycle + password management
router.post('/verify-otp',      otpLimiter, authController.verifyOtp);
router.post('/resend-otp',      otpLimiter, authController.resendOtp);
router.post('/forgot-password', otpLimiter, authController.forgotPassword);
router.post('/reset-password',              authController.resetPassword);

export default router;