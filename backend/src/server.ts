// backend/src/server.ts
// Entry point — starts HTTP server then connects to database.
//
// CRITICAL PATTERN FOR RAILWAY/RENDER:
// Start the HTTP server FIRST so Railway's healthcheck can reach /health immediately.
// The healthcheck returns 503 while DB is connecting, 200 once it's ready.
// Railway retries the healthcheck for the full timeout window (120s) — this
// gives the DB time to wake up (Neon cold start ~1-3s, PgBouncer ~1-5s).
//
// OLD (broken) pattern:  verifyConnection → listen → healthcheck
//   → If DB takes >3s to connect, Railway times out the deploy as failed
//
// NEW (correct) pattern: listen → verifyConnection → healthcheck returns 200
//   → Railway sees HTTP server running, keeps retrying healthcheck until 200
import dotenv from 'dotenv';
dotenv.config(); // Must be before any other imports that read process.env

import http   from 'http';
import app    from './app';
import { verifyConnection, db } from './config/database';
import logger from './config/logger';
import { startBackgroundJobs } from './jobs/index';

const PORT = parseInt(process.env.PORT || '5000', 10);
// Railway doesn't inject HOST — 0.0.0.0 binds to all interfaces (required)
const HOST = '0.0.0.0';

const server = http.createServer(app);

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function gracefulShutdown(signal: string) {
  logger.info(`[server] ${signal} received — shutting down gracefully`);

  server.close(async () => {
    logger.info('[server] HTTP server closed');
    try {
      await db.destroy();
      logger.info('[server] Database pool closed');
    } catch (err) {
      logger.error('[server] Error closing database pool:', err);
    }
    process.exit(0);
  });

  // Force-kill if graceful shutdown takes > 10s (stuck connections etc.)
  setTimeout(() => {
    logger.error('[server] Forced shutdown — graceful shutdown timed out');
    process.exit(1);
  }, 10_000).unref(); // .unref() so this timer doesn't prevent the clean exit
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// ── Global error handlers ─────────────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  logger.error('[server] Unhandled Promise Rejection:', reason);
  // Don't exit — log and continue. Exiting on every unhandled rejection
  // is too aggressive for production and can cause unnecessary restarts.
});
process.on('uncaughtException', (err) => {
  logger.error('[server] Uncaught Exception:', err);
  process.exit(1); // This IS fatal — the process is in an unknown state
});

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  // STEP 1: Start HTTP server immediately so Railway healthcheck can reach it.
  // /health returns 503 until DB is ready — Railway retries for 120s.
  server.listen(PORT, HOST, () => {
    logger.info(`[server] HTTP server listening on ${HOST}:${PORT}`);
    logger.info(`[server] Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`[server] Health: http://localhost:${PORT}/health`);
    logger.info(`[server] API:    http://localhost:${PORT}/api/v1`);
  });

  // STEP 2: Connect to database with retry — Neon cold start can take 1-5s.
  // We retry up to 5 times with exponential backoff before giving up.
  let dbReady = false;
  const MAX_RETRIES    = 5;
  const INITIAL_DELAY  = 1_000; // 1s

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await verifyConnection();
      dbReady = true;
      logger.info(`[server] Database connected (attempt ${attempt}/${MAX_RETRIES})`);
      break;
    } catch (err) {
      const delay = INITIAL_DELAY * Math.pow(2, attempt - 1); // 1s, 2s, 4s, 8s, 16s
      logger.warn(`[server] DB connection attempt ${attempt}/${MAX_RETRIES} failed. Retrying in ${delay}ms...`);
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  if (!dbReady) {
    // DB is completely unreachable after all retries.
    // Don't exit — keep HTTP server running so healthcheck can still
    // return 503. Railway will keep retrying. The next deploy attempt
    // may succeed once the DB is reachable.
    logger.error('[server] Database unreachable after all retries. Server running in degraded mode.');
    logger.error('[server] Healthcheck will return 503 until DB connection is restored.');
    return; // Don't start background jobs without DB
  }

  // STEP 3: Start background jobs only after DB is confirmed reachable.
  try {
    startBackgroundJobs();
    logger.info('[server] Background jobs started');
  } catch (err) {
    // Non-fatal — background jobs failing shouldn't crash the server
    logger.error('[server] Failed to start background jobs:', err);
  }
}

start();