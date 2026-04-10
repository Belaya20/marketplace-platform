// src/middleware/index.ts
// Req 4.2: Security — HTTPS, RBAC, Protection against XSS, CSRF, SQL Injection
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyAccessToken } from '../config/jwt';
import { AppError } from '../utils/response';
import { AuthRequest, UserRole } from '../types';
import logger from '../config/logger';
import db from '../config/database';

// ─── Auth Middleware ──────────────────────────────────────────────────────────
// Verifies JWT from Authorization: Bearer <token> header
export function authenticate(req: AuthRequest, _res: Response, next: NextFunction): void {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw AppError.unauthorized('No token provided');

    const token   = header.split(' ')[1];
    const payload = verifyAccessToken(token);

    req.user = {
      userId:   payload.userId,
      email:    payload.email,
      role:     payload.role,
      sellerId: payload.sellerId,
    };

    next();
  } catch {
    next(AppError.unauthorized('Invalid or expired token'));
  }
}

// Optional auth — sets req.user if token present, but does not reject guests
export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  try {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      const token   = header.split(' ')[1];
      const payload = verifyAccessToken(token);
      req.user = {
        userId:   payload.userId,
        email:    payload.email,
        role:     payload.role,
        sellerId: payload.sellerId,
      };
    }
  } catch { /* continue as guest */ }
  next();
}

// ─── RBAC Middleware ──────────────────────────────────────────────────────────
// Req 4.2: Role-based access control
export function authorize(...roles: UserRole[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(AppError.forbidden(`Requires role: ${roles.join(' or ')}`));
    }
    next();
  };
}

// Convenience wrappers
export const requireCustomer = authorize('customer', 'seller', 'admin');
export const requireSeller   = authorize('seller', 'admin');
export const requireAdmin    = authorize('admin');
export const requireAuth     = authorize('customer', 'seller', 'admin');

// ─── Rate Limiters ────────────────────────────────────────────────────────────
// Req 4.2: Protection against brute-force
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,                     // 10 login attempts per 15 min
  message: { success: false, message: 'Too many login attempts. Please wait 15 minutes.' },
});

export const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,   // 1 hour
  max: 5,                      // 5 OTP requests per hour
  message: { success: false, message: 'Too many OTP requests. Please try again in 1 hour.' },
});

// ─── Validate Request Seller Ownership ───────────────────────────────────────
// Looks up seller profile LIVE from DB — never relies on JWT payload alone
export async function requireSellerProfile(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user?.userId) {
      return next(AppError.forbidden('Seller profile not found or not approved'));
    }
    // Always fetch fresh from DB — JWT sellerId may be stale
    const sp = await db('seller_profiles')
      .where('user_id', req.user.userId)
      .first();
    if (!sp) {
      return next(AppError.forbidden('Seller profile not found. Please complete seller registration.'));
    }
    if (sp.status === 'pending') {
      return next(AppError.forbidden('Your seller account is pending admin approval. You will be notified by email once approved.'));
    }
    if (sp.status === 'suspended') {
      return next(AppError.forbidden('Your seller account has been suspended. Please contact support.'));
    }
    if (sp.status === 'rejected') {
      return next(AppError.forbidden('Your seller application was rejected. Reason: ' + (sp.rejection_reason || 'Please contact support.')));
    }
    if (sp.status !== 'approved') {
      return next(AppError.forbidden('Seller profile not approved.'));
    }
    // Patch req.user with current sellerId from DB
    req.user.sellerId = sp.id;
    next();
  } catch (e) {
    next(e);
  }
}

// ─── Error Handler ────────────────────────────────────────────────────────────
// Req 4.2: Centralised error handling — never expose stack traces in production
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log every error
  logger.error(`${req.method} ${req.path} — ${err.message}`, { stack: err.stack });

  // Operational errors: known, safe to send to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors:  err.errors,
    });
    return;
  }

  // Knex / PostgreSQL errors
  if (err.code === '23505') {
    res.status(409).json({ success: false, message: 'A record with this value already exists.' });
    return;
  }
  if (err.code === '23503') {
    res.status(409).json({ success: false, message: 'Related record does not exist.' });
    return;
  }
  if (err.code === '23514') {
    res.status(422).json({ success: false, message: 'Value violates a database constraint.' });
    return;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    res.status(401).json({ success: false, message: 'Invalid or expired token.' });
    return;
  }

  // Unknown — never expose internals in production
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}

// ─── Not Found Handler ────────────────────────────────────────────────────────
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound(`Route not found: ${req.method} ${req.path}`));
}

// ─── Request Logger ───────────────────────────────────────────────────────────
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level](`${req.method} ${req.path} ${res.statusCode} — ${ms}ms`);
  });
  next();
}
