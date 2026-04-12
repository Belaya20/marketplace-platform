// backend/src/server.ts
import dotenv from 'dotenv';
dotenv.config();

import http   from 'http';
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

// ── Run migrations on startup (controlled by MIGRATE_ON_START env var) ────────
// Usage:
//   1. Set MIGRATE_ON_START=true in Railway Variables
//   2. Redeploy — migrations run automatically on startup
//   3. Remove MIGRATE_ON_START from Railway Variables
//   4. Redeploy again — server starts normally without running migrations
async function runMigrationsIfNeeded(): Promise<void> {
  if (process.env.MIGRATE_ON_START !== 'true') return;

  logger.info('[migrate] MIGRATE_ON_START=true detected — running migrations...');
  try {
    // Use the unpooled connection for migrations
    // PgBouncer (pooled) rejects DDL startup parameters
    const Knex = require('knex');
    const migrationDb = Knex({
      client: 'pg',
      connection: {
        // Strip -pooler from hostname for direct DDL connection
        connectionString: (process.env.DATABASE_URL || '').replace('-pooler', ''),
        ssl: { rejectUnauthorized: false },
      },
    });

    const [batchNo, log] = await migrationDb.migrate.latest({
      directory: require('path').join(__dirname, '../../database/migrations'),
    });

    if (log.length === 0) {
      logger.info('[migrate] Already up to date — no migrations needed');
    } else {
      logger.info(`[migrate] Batch ${batchNo} — ran ${log.length} migrations:`);
      log.forEach((m: string) => logger.info(`[migrate]   ✓ ${m}`));
    }

    await migrationDb.destroy();
    logger.info('[migrate] Migrations complete');
  } catch (err: any) {
    logger.error('[migrate] Migration failed:', err.message);
    // Don't exit — server still starts, but log the failure clearly
    logger.error('[migrate] IMPORTANT: Database tables may be missing. Check logs.');
  }
}

// ── Create default admin user if none exists ──────────────────────────────────
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
      id:           uuidv4(),
      email:        'admin@marketplace.et',
      password_hash: hash,
      first_name:   'Admin',
      last_name:    'User',
      role:         'admin',
      is_active:    true,
      is_verified:  true,
      created_at:   new Date(),
      updated_at:   new Date(),
    });

    logger.info('[seed] Admin user created: admin@marketplace.et / Admin123!');
  } catch (err: any) {
    logger.error('[seed] Failed to create admin user:', err.message);
  }
}

async function start() {
  // STEP 1: Start HTTP server immediately — Railway healthcheck needs this
  server.listen(PORT, HOST, () => {
    logger.info(`[server] HTTP server listening on ${HOST}:${PORT}`);
    logger.info(`[server] Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`[server] Health: http://localhost:${PORT}/health`);
    logger.info(`[server] API:    http://localhost:${PORT}/api/v1`);
  });

  // STEP 2: Connect to DB with retry
  let dbReady = false;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await verifyConnection();
      dbReady = true;
      logger.info(`[server] Database connected (attempt ${attempt}/5)`);
      break;
    } catch (err) {
      const delay = 1000 * Math.pow(2, attempt - 1);
      logger.warn(`[server] DB attempt ${attempt}/5 failed. Retrying in ${delay}ms...`);
      if (attempt < 5) await new Promise(r => setTimeout(r, delay));
    }
  }

  if (!dbReady) {
    logger.error('[server] Database unreachable after all retries. Running in degraded mode.');
    return;
  }

  // STEP 3: Run migrations if MIGRATE_ON_START=true
  await runMigrationsIfNeeded();

  // STEP 4: Create admin user if MIGRATE_ON_START=true
  await createAdminIfNeeded();

  // STEP 5: Start background jobs
  try {
    startBackgroundJobs();
    logger.info('[server] Background jobs started');
  } catch (err) {
    logger.error('[server] Failed to start background jobs:', err);
  }
}

start();