// backend/src/server.ts
import dotenv from 'dotenv';
dotenv.config(); // Must be first — loads .env before any other imports

import http   from 'http';
import path   from 'path';
import app    from './app';
import { verifyConnection, db } from './config/database';
import logger from './config/logger';
import { startBackgroundJobs } from './jobs/index';

const PORT = parseInt(process.env.PORT || '5000', 10);
const HOST = '0.0.0.0'; // Railway requires binding to all interfaces

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
  // Force-kill after 10s if connections won't close
  setTimeout(() => {
    logger.error('[server] Forced shutdown — graceful shutdown timed out');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('[server] Unhandled Promise Rejection:', reason);
  // Do NOT exit — log and continue. Exiting on every unhandled rejection
  // causes unnecessary Railway restarts for non-fatal async errors.
});
process.on('uncaughtException', (err) => {
  logger.error('[server] Uncaught Exception:', err);
  process.exit(1); // Fatal — process is in unknown state
});

// ── Migrations ────────────────────────────────────────────────────────────────
// Controlled by MIGRATE_ON_START=true Railway env var.
// Workflow: set var → push → wait for "[migrate] Done ✓" → remove var → push.
//
// Migration directory confirmed from Railway deploy logs:
//   /app contents: dist, knexfile.ts, src, node_modules, ...
//   /app/dist contents: ..., migrations, ...  ← compiled migrations ARE here
//
// __dirname at runtime = /app/dist  (this file compiles to /app/dist/server.js)
// so path.join(__dirname, 'migrations') = /app/dist/migrations  ✓
async function runMigrationsIfNeeded(): Promise<void> {
  if (process.env.MIGRATE_ON_START !== 'true') return;
  logger.info('[migrate] MIGRATE_ON_START=true — starting...');

  const fs   = require('fs');
  const Knex = require('knex');

  // Build direct (unpooled) Neon URL for DDL operations.
  // PgBouncer (pooled endpoint, hostname contains "-pooler") rejects
  // PostgreSQL startup parameters — DDL migrations must use the direct connection.
  const rawUrl    = process.env.DATABASE_URL || '';
  const directUrl = rawUrl
    .replace(/-pooler(\.)/, '$1')                   // ep-xxx-pooler.region → ep-xxx.region
    .replace(/[?&]sslmode=[^&]*/g,        '')       // strip sslmode= param (we set ssl explicitly)
    .replace(/[?&]channel_binding=[^&]*/g, '')      // strip channel_binding= param
    .replace(/[?&]$/, '');                          // clean trailing ? or &

  logger.info(`[migrate] Direct host: ${directUrl.split('@')[1]?.split('/')[0] || 'unknown'}`);

  // ── Find compiled migrations directory ────────────────────────────────────
  // Primary: /app/dist/migrations  (confirmed from deploy log)
  // Fallbacks: other possible paths tried in order
  const candidates = [
    path.join(__dirname, 'migrations'),                           // /app/dist/migrations ← PRIMARY
    path.join(__dirname, '..', 'dist', 'migrations'),            // /app/dist/migrations (alt)
    path.join(__dirname, '..', 'database', 'migrations'),        // /app/database/migrations
    path.join(__dirname, '..', '..', 'database', 'migrations'),  // /database/migrations
  ];

  let migrationsDir = '';
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      migrationsDir = c;
      logger.info(`[migrate] ✓ Found migrations at: ${c}`);
      break;
    }
    logger.info(`[migrate]   Not found: ${c}`);
  }

  if (!migrationsDir) {
    // This block should never run now — but if it does, log everything for debug
    try {
      logger.error(`[migrate] /app contents:      ${fs.readdirSync('/app').join(', ')}`);
      logger.error(`[migrate] /app/dist contents: ${fs.readdirSync('/app/dist').join(', ')}`);
    } catch (e: any) {
      logger.error('[migrate] Cannot list dirs:', e.message);
    }
    logger.error('[migrate] No migrations directory found — aborting');
    return;
  }

  const files = fs.readdirSync(migrationsDir).filter((f: string) => /\.(js|ts)$/.test(f));
  logger.info(`[migrate] ${files.length} migration files found`);

  // ── Connect via direct (unpooled) URL ─────────────────────────────────────
  const migrationDb = Knex({
    client: 'pg',
    connection: {
      connectionString: directUrl,
      ssl: { rejectUnauthorized: false }, // required for Neon TLS
    },
    pool: { min: 1, max: 1 }, // single connection is enough for migrations
  });

  // Test the direct connection before attempting migrations
  try {
    await migrationDb.raw('SELECT 1');
    logger.info('[migrate] Direct connection OK');
  } catch (connErr: any) {
    logger.error(`[migrate] Direct connection FAILED: ${connErr.message}`);
    logger.error(`[migrate] Code: ${connErr.code} | Detail: ${connErr.detail}`);
    await migrationDb.destroy();
    return;
  }

  // ── Run pending migrations ─────────────────────────────────────────────────
  try {
    const [batchNo, log] = await migrationDb.migrate.latest({ directory: migrationsDir });
    if (log.length === 0) {
      logger.info('[migrate] Already up to date — no new migrations needed');
    } else {
      logger.info(`[migrate] Batch ${batchNo} — ${log.length} migration(s) ran:`);
      log.forEach((m: string) => logger.info(`[migrate]   ✓ ${m}`));
    }
    logger.info('[migrate] Done ✓');
  } catch (err: any) {
    logger.error(`[migrate] FAILED: ${err.message}`);
    logger.error(`[migrate] Code: ${err.code} | Detail: ${err.detail} | Hint: ${err.hint}`);
    logger.error(`[migrate] Stack:\n${err.stack}`);
  } finally {
    await migrationDb.destroy();
  }
}

// ── Admin seed ────────────────────────────────────────────────────────────────
// Only runs when MIGRATE_ON_START=true. Creates the default admin account
// if none exists. Safe to run multiple times (idempotent).
async function createAdminIfNeeded(): Promise<void> {
  if (process.env.MIGRATE_ON_START !== 'true') return;
  try {
    const existing = await db('users').where({ role: 'admin' }).first();
    if (existing) {
      logger.info('[seed] Admin user already exists — skipping');
      return;
    }
    const bcrypt          = require('bcryptjs');
    const { v4: uuidv4 } = require('uuid');
    const hash = await bcrypt.hash('Admin123!', 12);
    await db('users').insert({
      id:            uuidv4(),
      email:         'admin@marketplace.et',
      password_hash: hash,
      first_name:    'Admin',
      last_name:     'User',
      role:          'admin',
      is_active:     true,
      is_verified:   true,
      created_at:    new Date(),
      updated_at:    new Date(),
    });
    logger.info('[seed] ✓ Admin created → admin@marketplace.et / Admin123!');
  } catch (err: any) {
    logger.error(`[seed] Failed to create admin: ${err.message}`);
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  // STEP 1: Bind HTTP port immediately.
  // Railway's healthcheck fires as soon as the container starts.
  // If we wait for DB connection before listening, Railway times out.
  // /health returns 503 while DB connects, 200 once ready.
  server.listen(PORT, HOST, () => {
    logger.info(`[server] HTTP server listening on ${HOST}:${PORT}`);
    logger.info(`[server] Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`[server] Health: http://localhost:${PORT}/health`);
    logger.info(`[server] API:    http://localhost:${PORT}/api/v1`);
  });

  // STEP 2: Connect to DB with exponential backoff retry.
  // Neon cold start can take 1-5s — retry covers this window.
  let dbReady = false;
  for (let i = 1; i <= 5; i++) {
    try {
      await verifyConnection();
      dbReady = true;
      logger.info(`[server] Database connected (attempt ${i}/5)`);
      break;
    } catch {
      const delay = 1_000 * Math.pow(2, i - 1); // 1s, 2s, 4s, 8s, 16s
      logger.warn(`[server] DB attempt ${i}/5 failed — retry in ${delay}ms`);
      if (i < 5) await new Promise(r => setTimeout(r, delay));
    }
  }

  if (!dbReady) {
    logger.error('[server] Database unreachable after all retries — running in degraded mode');
    logger.error('[server] API calls requiring DB will fail until connection is restored');
    // Don't exit — /health returns 503, Railway will restart the service
    return;
  }

  // STEP 3: Run pending migrations (only when MIGRATE_ON_START=true)
  await runMigrationsIfNeeded();

  // STEP 4: Seed default admin user (only when MIGRATE_ON_START=true)
  await createAdminIfNeeded();

  // STEP 5: Start background jobs (cron tasks, cleanup, etc.)
  try {
    startBackgroundJobs();
    logger.info('[server] Background jobs started');
  } catch (err) {
    // Non-fatal — log and continue
    logger.error('[server] Failed to start background jobs:', err);
  }
}

start();