// src/app.ts
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

// ─── 1. COMPRESSION ──────────────────────────────────────────────────────────
// Must be FIRST — compresses all responses before they leave Express.
// JSON product search (50+ items) goes from ~100KB → ~12KB with gzip.
app.use(compression({
  threshold: 1024,  // only compress responses > 1KB
  level:     6,     // balance of speed vs ratio
}));

// ─── 2. SECURITY HEADERS ─────────────────────────────────────────────────────
// Req 4.2: XSS, clickjacking, MIME sniffing protection.
// contentSecurityPolicy is disabled here because the frontend handles its own
// CSP. HSTS enforces HTTPS after first visit (production only).
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow images from CDNs
  contentSecurityPolicy:     false,                      // handled by frontend
  strictTransportSecurity: {
    maxAge:            63_072_000, // 2 years
    includeSubDomains: true,
  },
  crossOriginEmbedderPolicy: false, // allow external image embeds
}));

// ─── 3. CORS ─────────────────────────────────────────────────────────────────
// Req 4.2: Only our own origins allowed.
// MERGED: added ADMIN_URL (port 3001) from the fixed version.
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ||
  `${process.env.FRONTEND_URL || 'http://localhost:3000'},${process.env.ADMIN_URL || 'http://localhost:3001'}`
).split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error(`CORS: ${origin} not allowed`));
  },
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-chapa-signature'],
  exposedHeaders: ['X-Total-Count'],
  maxAge:         86_400, // cache preflight 24 hours
}));

// ─── 4. RATE LIMITING ────────────────────────────────────────────────────────
// Req 4.2: Brute-force and API abuse protection.
// MERGED: added tighter auth + OTP limiters from the fixed version.

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
// IMPORTANT: Chapa webhook MUST receive the raw body for HMAC signature
// verification — it cannot go through JSON.parse() first.
// So we skip JSON parsing for that one path, then register the global parsers.
app.use((req, res, next) => {
  if (req.path === '/api/v1/payments/webhook/chapa') return next();
  express.json({ limit: '2mb' })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ─── 6. REQUEST TIMEOUT ──────────────────────────────────────────────────────
// MERGED from fixed version: kill requests that stall > 30s to prevent
// resource exhaustion under load.
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

// ─── 7. REQUEST LOGGING ───────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  }));
}
app.use(requestLogger);

// ─── 8. HEALTH CHECK ─────────────────────────────────────────────────────────
// No auth, no rate limit — used by load balancers, PM2, UptimeRobot.
app.get('/health', (_req, res) => {
  res.status(200).json({
    status:      'ok',
    environment: process.env.NODE_ENV || 'development',
    uptime:      Math.floor(process.uptime()),
    timestamp:   new Date().toISOString(),
  });
});

app.get('/', (_req, res) => {
  res.json({ message: 'Marketplace Platform API', version: '1.0.0' });
});

// ─── 9. API ROUTES ────────────────────────────────────────────────────────────
app.use('/api/v1', apiRouter);

// ─── 10. ERROR HANDLING ───────────────────────────────────────────────────────
// MERGED: error handler now never exposes stack traces in production.
// The original errorHandler from middleware is kept for structured errors
// (ValidationError, AuthError etc.). The global catch-all below handles
// anything that slips through.
app.use(notFoundHandler);
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status  = err.statusCode || err.status || 500;
  const message = err.message    || 'Internal server error';

  // Always log 5xx errors internally with full stack
  if (status >= 500) {
    logger.error(`[${status}] ${message}`, { stack: err.stack });
  }

  res.status(status).json({
    success: false,
    // Never expose internal error details in production for 500s
    message: process.env.NODE_ENV === 'production' && status === 500
      ? 'Something went wrong on our end. Please try again.'
      : message,
    // Include stack in development only
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

// Delegate to the existing structured errorHandler for known error types
// (this runs AFTER the global catch-all only if re-thrown — see middleware/index.ts)
app.use(errorHandler);

export default app;