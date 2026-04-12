// backend/src/server.ts
import dotenv from 'dotenv';
dotenv.config();

import http   from 'http';
import path   from 'path';
import app    from './app';
import { verifyConnection, db } from './config/database';
import logger from './config/logger';
import { startBackgroundJobs } from './jobs/index';

const PORT = parseInt(process.env.PORT || '5000', 10);
const HOST = '0.0.0.0';

const server = http.createServer(app);

async function gracefulShutdown(signal: string) {
  logger.info(`[server] ${signal} received — shutting down gracefully`);
  server.close(async () => {
    logger.info('[server] HTTP server closed');
    try { await db.destroy(); logger.info('[server] Database pool closed'); }
    catch (err) { logger.error('[server] Error closing database pool:', err); }
    process.exit(0);
  });
  setTimeout(() => { logger.error('[server] Forced shutdown'); process.exit(1); }, 10_000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason) => { logger.error('[server] Unhandled Rejection:', reason); });
process.on('uncaughtException',  (err)    => { logger.error('[server] Uncaught Exception:', err); process.exit(1); });

// ── Migrations ────────────────────────────────────────────────────────────────
async function runMigrationsIfNeeded(): Promise<void> {
  if (process.env.MIGRATE_ON_START !== 'true') return;
  logger.info('[migrate] Starting...');

  const fs   = require('fs');
  const Knex = require('knex');

  // Build direct (unpooled) URL — PgBouncer rejects DDL startup params
  const rawUrl    = process.env.DATABASE_URL || '';
  const directUrl = rawUrl
    .replace(/-pooler(\.)/, '$1')                  // ep-xxx-pooler.region → ep-xxx.region
    .replace(/[?&]sslmode=[^&]*/g,        '')      // remove sslmode param
    .replace(/[?&]channel_binding=[^&]*/g, '')     // remove channel_binding param
    .replace(/[?&]$/, '');                         // clean trailing ? or &

  const hostPart = directUrl.split('@')[1]?.split('/')[0] || 'unknown';
  logger.info(`[migrate] Direct host: ${hostPart}`);

  // ── Find migrations directory ──────────────────────────────────────────────
  // Compiled structure: /app/dist/src/server.js
  // __dirname = /app/dist/src
  // Migrations at: /app/database/migrations  (top-level database/ folder)
  const candidates = [
    path.join(__dirname, '..', '..', 'database', 'migrations'),   // /app/database/migrations
    path.join(__dirname, '..', 'database', 'migrations'),          // /app/dist/database/migrations
    path.join('/app', 'database', 'migrations'),                    // absolute fallback
  ];

  let migrationsDir = '';
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      migrationsDir = candidate;
      logger.info(`[migrate] Found migrations at: ${candidate}`);
      break;
    }
    logger.info(`[migrate] Not found: ${candidate}`);
  }

  if (!migrationsDir) {
    // Log the actual /app directory to understand what's there
    try {
      const appRoot = '/app';
      const appContents = fs.readdirSync(appRoot);
      logger.error(`[migrate] /app contents: ${appContents.join(', ')}`);
      if (fs.existsSync(path.join(appRoot, 'dist'))) {
        logger.error(`[migrate] /app/dist contents: ${fs.readdirSync(path.join(appRoot, 'dist')).join(', ')}`);
      }
    } catch (e: any) {
      logger.error('[migrate] Could not list /app:', e.message);
    }
    logger.error('[migrate] No migrations directory found — skipping');
    return;
  }

  const files = fs.readdirSync(migrationsDir).filter((f: string) => f.match(/\.(js|ts)$/));
  logger.info(`[migrate] Found ${files.length} migration files`);

  // ── Connect with direct URL ────────────────────────────────────────────────
  const migrationDb = Knex({
    client: 'pg',
    connection: { connectionString: directUrl, ssl: { rejectUnauthorized: false } },
    pool: { min: 1, max: 1 },
  });

  try {
    await migrationDb.raw('SELECT 1');
    logger.info('[migrate] Direct connection OK');
  } catch (connErr: any) {
    logger.error(`[migrate] Direct connection FAILED: ${connErr.message}`);
    logger.error(`[migrate] Code: ${connErr.code} | Detail: ${connErr.detail}`);
    await migrationDb.destroy();
    return;
  }

  // ── Run migrations ─────────────────────────────────────────────────────────
  try {
    const [batchNo, log] = await migrationDb.migrate.latest({ directory: migrationsDir });
    if (log.length === 0) {
      logger.info('[migrate] Already up to date');
    } else {
      logger.info(`[migrate] Batch ${batchNo} — ${log.length} migrations ran:`);
      log.forEach((m: string) => logger.info(`[migrate]   ✓ ${m}`));
    }
  } catch (err: any) {
    logger.error(`[migrate] FAILED: ${err.message}`);
    logger.error(`[migrate] Code: ${err.code} | Detail: ${err.detail} | Hint: ${err.hint}`);
    logger.error(`[migrate] Stack: ${err.stack}`);
  } finally {
    await migrationDb.destroy();
  }
}

// ── Admin seed ────────────────────────────────────────────────────────────────
async function createAdminIfNeeded(): Promise<void> {
  if (process.env.MIGRATE_ON_START !== 'true') return;
  try {
    const existing = await db('users').where({ role: 'admin' }).first();
    if (existing) { logger.info('[seed] Admin already exists — skipping'); return; }
    const bcrypt   = require('bcryptjs');
    const { v4: uuidv4 } = require('uuid');
    const hash = await bcrypt.hash('Admin123!', 12);
    await db('users').insert({
      id: uuidv4(), email: 'admin@marketplace.et', password_hash: hash,
      first_name: 'Admin', last_name: 'User', role: 'admin',
      is_active: true, is_verified: true, created_at: new Date(), updated_at: new Date(),
    });
    logger.info('[seed] Admin created: admin@marketplace.et / Admin123!');
  } catch (err: any) {
    logger.error(`[seed] Failed: ${err.message}`);
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  // HTTP server starts first — Railway healthcheck needs immediate response
  server.listen(PORT, HOST, () => {
    logger.info(`[server] HTTP server listening on ${HOST}:${PORT}`);
    logger.info(`[server] Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`[server] Health: http://localhost:${PORT}/health`);
    logger.info(`[server] API:    http://localhost:${PORT}/api/v1`);
  });

  // DB connect with retry
  let dbReady = false;
  for (let i = 1; i <= 5; i++) {
    try {
      await verifyConnection();
      dbReady = true;
      logger.info(`[server] Database connected (attempt ${i}/5)`);
      break;
    } catch {
      const delay = 1000 * Math.pow(2, i - 1);
      logger.warn(`[server] DB attempt ${i}/5 failed. Retry in ${delay}ms...`);
      if (i < 5) await new Promise(r => setTimeout(r, delay));
    }
  }

  if (!dbReady) { logger.error('[server] DB unreachable. Degraded mode.'); return; }

  await runMigrationsIfNeeded();
  await createAdminIfNeeded();

  try { startBackgroundJobs(); logger.info('[server] Background jobs started'); }
  catch (err) { logger.error('[server] Background jobs failed:', err); }
}

start();