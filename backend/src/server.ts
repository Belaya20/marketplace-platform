import dotenv from 'dotenv';
dotenv.config();

import http   from 'http';
import path   from 'path';
import fs     from 'fs';
import app    from './app';
import { verifyConnection, db } from './config/database';
import logger from './config/logger';
import { startBackgroundJobs } from './jobs/index';

const PORT = parseInt(process.env.PORT || '5000', 10);
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
  setTimeout(() => {
    logger.error('[server] Forced shutdown — graceful shutdown timed out');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('[server] Unhandled Promise Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  logger.error('[server] Uncaught Exception:', err);
  process.exit(1);
});

// ── Migrations ────────────────────────────────────────────────────────────────
async function runMigrationsIfNeeded(): Promise<void> {
  if (process.env.MIGRATE_ON_START !== 'true') return;
  logger.info('[migrate] MIGRATE_ON_START=true — starting...');

  const Knex = require('knex');

  // Build direct (unpooled) Neon URL — PgBouncer (-pooler) rejects DDL (CREATE TABLE)
  const rawUrl    = process.env.DATABASE_URL || '';
  const directUrl = rawUrl
    .replace(/-pooler(\.)/, '$1')
    .replace(/[?&]sslmode=[^&]*/g, '')
    .replace(/[?&]channel_binding=[^&]*/g, '')
    .replace(/[?&]$/, '');

  logger.info(`[migrate] Direct host: ${directUrl.split('@')[1]?.split('/')[0] || 'unknown'}`);

  // ── Find migrations directory (Super Class Path Resolution) ────────────────
  // In production, everything is in /app/dist/
  const isProduction = process.env.NODE_ENV === 'production';
  const migrationsDir = isProduction 
    ? path.join(__dirname, 'database', 'migrations') // /app/dist/database/migrations
    : path.join(process.cwd(), 'src', 'database', 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    logger.error(`[migrate] Migrations directory not found at: ${migrationsDir}`);
    // Fallback search for structural safety
    const fallback = path.join(__dirname, 'migrations');
    if (fs.existsSync(fallback)) {
      logger.info(`[migrate] Using fallback migrations path: ${fallback}`);
    } else {
      logger.error('[migrate] Critical: No migrations found. Skipping.');
      return;
    }
  } else {
    logger.info(`[migrate] ✓ Found migrations at: ${migrationsDir}`);
  }

  // ── Filter for runnable files ─────────────────────────────────────────────
  const files = fs.readdirSync(migrationsDir).filter(
    (f: string) => f.endsWith('.js') && !f.endsWith('.d.ts')
  );
  
  if (isProduction && files.length === 0) {
    logger.warn('[migrate] No .js migration files found in dist. Check build output.');
    return;
  }

  // ── Connect via direct (unpooled) URL ─────────────────────────────────────
  const migrationDb = Knex({
    client: 'pg',
    connection: {
      connectionString: directUrl,
      ssl: { rejectUnauthorized: false },
    },
    pool: { min: 1, max: 1 },
  });

  try {
    await migrationDb.raw('SELECT 1');
    logger.info('[migrate] Direct connection OK');

    // ── Run pending migrations ────────────────────────────────────────────────
    const [batchNo, log] = await migrationDb.migrate.latest({
      directory: migrationsDir,
      // MANDATORY: This stops Knex from trying to load .d.ts files
      loadExtensions: [isProduction ? '.js' : '.ts'],
    });

    if (log.length === 0) {
      logger.info('[migrate] Already up to date');
    } else {
      logger.info(`[migrate] Batch ${batchNo} — ${log.length} migration(s) ran successfully`);
    }
    logger.info('[migrate] Done ✓');
  } catch (err: any) {
    logger.error(`[migrate] FAILED: ${err.message}`);
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
    if (existing) {
      logger.info('[seed] Admin user already exists — skipping');
      return;
    }
    const bcrypt = require('bcryptjs');
    const { v4: uuidv4 } = require('uuid');
    const hash = await bcrypt.hash('Admin123!', 12);
    await db('users').insert({
      id: uuidv4(),
      email: 'admin@marketplace.et',
      password_hash: hash,
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin',
      is_active: true,
      is_verified: true,
      created_at: new Date(),
      updated_at: new Date(),
    });
    logger.info('[seed] ✓ Admin created → admin@marketplace.et / Admin123!');
  } catch (err: any) {
    logger.error(`[seed] Failed to create admin: ${err.message}`);
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  // 1. Listen immediately (Railway requirement)
  server.listen(PORT, HOST, () => {
    logger.info(`[server] HTTP server listening on ${HOST}:${PORT}`);
  });

  // 2. Database Connection with Retry logic
  let dbReady = false;
  for (let i = 1; i <= 5; i++) {
    try {
      await verifyConnection();
      dbReady = true;
      logger.info(`[server] Database connected (attempt ${i}/5)`);
      break;
    } catch {
      const delay = 1_000 * Math.pow(2, i - 1);
      logger.warn(`[server] DB attempt ${i}/5 failed — retry in ${delay}ms`);
      if (i < 5) await new Promise(r => setTimeout(r, delay));
    }
  }

  if (!dbReady) {
    logger.error('[server] Database unreachable — running in degraded mode');
    return;
  }

  // 3. System Tasks
  await runMigrationsIfNeeded();
  await createAdminIfNeeded();

  try {
    startBackgroundJobs();
    logger.info('[server] Background jobs started');
  } catch (err) {
    logger.error('[server] Failed to start background jobs:', err);
  }
}

start();