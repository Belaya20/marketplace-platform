// src/modules/auth/auth.controller.ts
// FIX 2742: Added explicit `import { Router, IRouter }` and typed router
//           as `IRouter` so TypeScript can name the type without the
//           deep pnpm path reference.
import { Response, NextFunction, Router, IRouter } from 'express';
import { authService } from './auth.service';
import { AuthRequest } from '../../types';
import { success, created } from '../../utils/response';
import { authLimiter, otpLimiter } from '../../middleware';

// ─── Controllers ──────────────────────────────────────────────────────────────
export const authController = {

  // POST /api/v1/auth/register/customer
  async registerCustomer(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await authService.registerCustomer(req.body);
      created(res, user, 'Registration successful. Please verify your email with the OTP sent.');
    } catch (err) { next(err); }
  },

  // POST /api/v1/auth/register/seller
  async registerSeller(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await authService.registerSeller(req.body);
      created(res, user, 'Seller registration submitted. Verify your email then await admin approval.');
    } catch (err) { next(err); }
  },

  // POST /api/v1/auth/login
  async login(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, remember_me } = req.body;
      const result = await authService.login(email, password, remember_me === true);
      success(res, result, 'Login successful');
    } catch (err) { next(err); }
  },

  // POST /api/v1/auth/refresh
  async refresh(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refresh_token } = req.body;
      if (!refresh_token) throw new Error('refresh_token is required');
      const tokens = await authService.refreshToken(refresh_token);
      success(res, tokens, 'Token refreshed');
    } catch (err) { next(err); }
  },

  // POST /api/v1/auth/verify-otp
  async verifyOtp(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      let { user_id, token, purpose } = req.body;
      if (user_id && user_id.includes('@')) {
        const { default: db } = await import('../../config/database');
        const user = await db('users').where({ email: user_id }).first();
        if (user) user_id = user.id;
      }
      const result = await authService.verifyOtp(user_id, token, purpose);
      success(res, result, 'Verification successful');
    } catch (err) { next(err); }
  },

  // POST /api/v1/auth/resend-otp
  async resendOtp(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, purpose } = req.body;
      const result = await authService.resendOtp(email, purpose);
      success(res, result, 'OTP sent to your email');
    } catch (err) { next(err); }
  },

  // POST /api/v1/auth/forgot-password
  async forgotPassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.forgotPassword(req.body.email);
      // Always respond success to prevent user enumeration attacks
      success(res, null, 'If this email is registered, a reset code has been sent');
    } catch (err) { next(err); }
  },

  // POST /api/v1/auth/reset-password
  async resetPassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user_id, token, new_password } = req.body;
      await authService.resetPassword(user_id, token, new_password);
      success(res, null, 'Password reset successful. Please log in with your new password.');
    } catch (err) { next(err); }
  },
};

// ─── Router ───────────────────────────────────────────────────────────────────
// FIX 2742: Explicitly type as IRouter — removes the deep pnpm reference error
const router: IRouter = Router();

// Req 3.1.1: Registration
router.post('/register/customer', authLimiter, authController.registerCustomer);
router.post('/register/seller',   authLimiter, authController.registerSeller);

// Req 3.1.2: Login + token rotation
router.post('/login',   authLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout',  (_req: AuthRequest, res: Response) => {
  // Stateless JWT: client deletes the token. Server-side: add jti to blocklist in Redis.
  success(res, null, 'Logged out successfully');
});

// Req 3.1.1: OTP verification & password management
router.post('/verify-otp',      otpLimiter, authController.verifyOtp);
router.post('/resend-otp',      otpLimiter, authController.resendOtp);
router.post('/forgot-password', otpLimiter, authController.forgotPassword);
router.post('/reset-password',  authController.resetPassword);

export default router;
