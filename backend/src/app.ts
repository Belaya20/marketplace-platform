// backend/src/app.ts
// Main Express application setup
// Req 4.1: Performance — compression, connection keep-alive
// Req 4.2: Security — Helmet, CORS, rate limiting, body parsing, timeout
// Req 4.3: Scalability — structured error handling, no internal leaks in prod
import 'express-async-errors';
import express, { Application, Request, Response, NextFunction } from 'express';
import helmet      from 'helmet';
import cors        from 'cors';
import compression from 'compression';
import morgan      from 'morgan';
import rateLimit   from 'express-rate-limit';

import { errorHandler, notFoundHandler, requestLogger } from './middleware';
import apiRouter from './routes/index';
import logger    from './config/logger';

const app: Application = express();

// ─── TRUST PROXY ─────────────────────────────────────────────────────────────
// FIX 1: Railway runs behind a reverse proxy (nginx).
// Without this, express-rate-limit throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
// because X-Forwarded-For is set but Express doesn't trust it by default.
// '1' = trust exactly one proxy hop (Railway's edge layer).
// Also makes req.ip return the real client IP for rate limiting accuracy.
app.set('trust proxy', 1);

// ─── 1. COMPRESSION ──────────────────────────────────────────────────────────
// Must be FIRST — compresses all responses before they leave Express.
// JSON product search (50+ items) goes from ~100KB → ~12KB with gzip.
app.use(compression({
  threshold: 1024,  // only compress responses > 1KB
  level:     6,     // balance of speed vs ratio
}));

// ─── 2. SECURITY HEADERS ─────────────────────────────────────────────────────
// contentSecurityPolicy disabled — handled by frontend.
// HSTS enforces HTTPS after first visit (2 years).
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow images from CDNs
  contentSecurityPolicy:     false,
  strictTransportSecurity:   { maxAge: 63_072_000, includeSubDomains: true },
  crossOriginEmbedderPolicy: false,                      // allow external image embeds
}));

// ─── 3. CORS ─────────────────────────────────────────────────────────────────
// FIX 2: Also allow all *.vercel.app subdomains automatically.
// Vercel creates a unique URL per deployment commit, e.g.:
//   addismarket2-9yjan2azh-belayas-projects.vercel.app
// These change with every deploy and cannot be enumerated in ALLOWED_ORIGINS.
// Allowing *.vercel.app covers production + all preview deploys permanently.
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ||
  `${process.env.FRONTEND_URL || 'http://localhost:3000'},${process.env.ADMIN_URL || 'http://localhost:3001'}`
).split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // No origin = Postman, mobile apps, server-to-server — always allow
    if (!origin) return callback(null, true);

    // Exact match against configured origins (production URLs)
    if (allowedOrigins.includes(origin)) return callback(null, true);

    // All Vercel preview and production URLs — *.vercel.app
    if (origin.endsWith('.vercel.app')) return callback(null, true);

    // Local development
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }

    callback(new Error(`CORS: ${origin} not allowed`));
  },
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-chapa-signature'],
  exposedHeaders: ['X-Total-Count'],
  maxAge:         86_400, // cache preflight for 24 hours
}));

// ─── 4. RATE LIMITING ────────────────────────────────────────────────────────
// Brute-force and API abuse protection.
// Works correctly now that trust proxy is set above.

// General API: 200 req / minute / IP
const generalLimiter = rateLimit({
  windowMs:        60_000,
  max:             200,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { success: false, message: 'Too many requests. Please slow down.' },
  skip:            (req) => req.method === 'OPTIONS',
});

// Auth endpoints: 10 attempts / 15 min / IP
const authLimiter = rateLimit({
  windowMs:        15 * 60_000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { success: false, message: 'Too many login attempts. Please wait 15 minutes.' },
});

// OTP / password reset: 5 attempts / hour / IP
const otpLimiter = rateLimit({
  windowMs:        60 * 60_000,
  max:             5,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { success: false, message: 'Too many verification attempts. Try again in 1 hour.' },
});

app.use('/api/',                          generalLimiter);
app.use('/api/v1/auth/login',             authLimiter);
app.use('/api/v1/auth/register',          authLimiter);
app.use('/api/v1/auth/forgot-password',   otpLimiter);
app.use('/api/v1/auth/verify-otp',        otpLimiter);
app.use('/api/v1/auth/resend-otp',        otpLimiter);

// ─── 5. BODY PARSERS ─────────────────────────────────────────────────────────
// Chapa webhook MUST receive the raw body for HMAC signature verification.
// Skip JSON parsing for that path — it is handled by the webhook route itself.
app.use((req, res, next) => {
  if (req.path === '/api/v1/payments/webhook/chapa') return next();
  express.json({ limit: '2mb' })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ─── 6. REQUEST TIMEOUT ──────────────────────────────────────────────────────
// Kill requests that stall > 30s to prevent resource exhaustion.
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setTimeout(30_000, () => {
    if (!res.headersSent) {
      res.status(503).json({
        success: false,
        message: 'Request timeout — server is under load, please retry.',
      });
    }
  });
  next();
});

// ─── 7. REQUEST LOGGING ──────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  }));
}
app.use(requestLogger);

// ─── 8. HEALTH CHECK ─────────────────────────────────────────────────────────
// Single definition — NOT duplicated in server.ts.
// Returns 200 when DB reachable, 503 when not.
// Railway retries for 120s on 503 — covers Neon cold starts (~1-5s).
// Dynamic import avoids circular dependency with database.ts.
app.get('/health', async (_req: Request, res: Response) => {
  try {
    const { verifyConnection } = await import('./config/database');
    await verifyConnection();
    res.status(200).json({
      status:      'ok',
      environment: process.env.NODE_ENV || 'development',
      uptime:      Math.floor(process.uptime()),
      timestamp:   new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[health] DB check failed:', err);
    // 503 = "alive but not ready" — Railway keeps retrying healthcheck
    res.status(503).json({
      status:    'error',
      message:   'Database not reachable',
      timestamp: new Date().toISOString(),
    });
  }
});

app.get('/', (_req, res) => {
  res.json({ message: 'Marketplace Platform API', version: '1.0.0' });
});

// ─── 9. API ROUTES ───────────────────────────────────────────────────────────
app.use('/api/v1', apiRouter);

// ─── 10. ERROR HANDLING ──────────────────────────────────────────────────────
// notFoundHandler catches unmatched routes (404).
// Inline handler below catches everything else — never exposes stack in prod.
// errorHandler from middleware handles structured errors (ValidationError etc.)
app.use(notFoundHandler);
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status  = err.statusCode || err.status || 500;
  const message = err.message    || 'Internal server error';

  if (status >= 500) {
    logger.error(`[${status}] ${message}`, { stack: err.stack });
  }

  res.status(status).json({
    success: false,
    message: process.env.NODE_ENV === 'production' && status === 500
      ? 'Something went wrong on our end. Please try again.'
      : message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});
app.use(errorHandler);

export default app;