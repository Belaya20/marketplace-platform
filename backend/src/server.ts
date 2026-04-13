import dotenv from 'dotenv';
dotenv.config(); // Must be first — loads .env before any other imports

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
  const isProduction = process.env.NODE_ENV === 'production';

  // Build direct (unpooled) Neon URL
  const rawUrl    = process.env.DATABASE_URL || '';
  const directUrl = rawUrl.replace(/-pooler(\.)/, '$1');

  // ── SUPER CLASS PATH RESOLUTION ────────────────────────────────────────────
  // We use process.cwd() to anchor to the project root.
  const migrationsDir = isProduction 
    ? path.join(process.cwd(), 'dist', 'database', 'migrations')
    : path.join(process.cwd(), 'src', 'database', 'migrations');

  logger.info(`[migrate] Looking for migrations in: ${migrationsDir}`);

  if (!fs.existsSync(migrationsDir)) {
    logger.error('[migrate] Critical: Migrations directory not found. Skipping.');
    return;
  }

  // ── Connect & Execute ──────────────────────────────────────────────────────
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

    const [batchNo, log] = await migrationDb.migrate.latest({ 
      directory: migrationsDir,
      // THE SHIELD: Only run .js files in production, ignore .d.ts files
      loadExtensions: [isProduction ? '.js' : '.ts'] 
    });

    if (log.length === 0) {
      logger.info('[migrate] Already up to date');
    } else {
      logger.info(`[migrate] Batch ${batchNo} — ${log.length} migration(s) ran:`);
      log.forEach((m: string) => logger.info(`  ✓ ${m}`));
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
      logger.info('[seed] Admin user already exists');
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
  // Bind port first for Railway healthcheck
  server.listen(PORT, HOST, () => {
    logger.info(`[server] HTTP server listening on ${HOST}:${PORT}`);
  });

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

  await runMigrationsIfNeeded();
  await createAdminIfNeeded();

  try {
    startBackgroundJobs();
    logger.info('[server] Background jobs operational');
  } catch (err) {
    logger.error('[server] Failed to start background jobs:', err);
  }
}

start();