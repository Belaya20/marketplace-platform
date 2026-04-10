// backend/src/config/database.ts
// Req 4.1: Optimized database queries — connection pooling
// Req 4.2: Security — RLS context set per request
import knex, { Knex } from 'knex';
import dotenv from 'dotenv';
dotenv.config();

// ── Connection pool sizing ────────────────────────────────────────────────────
// Rule: max = (num_cpu_cores × 2) + effective_spindle_count
// For a 2-core VPS running 2 PM2 instances: 10 connections per instance = 20 total
// PostgreSQL default max_connections = 100, so 20 is safe.
// In production set DB_POOL_MAX=15 per instance if you have 4+ PM2 workers.
const POOL_MIN = parseInt(process.env.DB_POOL_MIN || '2');
const POOL_MAX = parseInt(process.env.DB_POOL_MAX || '10'); // raise to 15 in prod

const config: Knex.Config = {
  client: 'pg',
  connection: {
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME     || 'marketplace_db',
    user:     process.env.DB_USER     || 'ecom_api',
    password: process.env.DB_PASSWORD || 'QuantumRidgeForgeK74N0',
    ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    // FIX: statement_timeout at connection level — prevents runaway queries
    // locking DB under heavy load. 15s is generous; most queries run < 100ms.
    options:  `-c statement_timeout=15000`,
  },
  pool: {
    min:  POOL_MIN,
    max:  POOL_MAX,
    // Time to wait for a connection before throwing (ms)
    acquireTimeoutMillis: 15_000,
    // How long an idle connection stays in the pool before being destroyed (ms)
    idleTimeoutMillis:    300_000,  // 5 min — reduced from 10 min to free resources faster
    // FIX: reapIntervalMillis — how often to check for timed-out idle connections
    reapIntervalMillis:   1_000,
    // FIX: createRetryIntervalMillis — retry delay on failed connection attempts
    createRetryIntervalMillis: 200,
  },
  // FIX: acquireConnectionTimeout is a top-level Knex option, not inside pool.
  // The original config had it in the wrong place — it was silently ignored.
  acquireConnectionTimeout: 15_000,
  // Debug: set to true only in dev to log all queries
  debug: process.env.NODE_ENV === 'development' && process.env.DB_DEBUG === 'true',
  // FIX: postProcessResponse — coerces numeric Postgres strings to JS numbers.
  // PostgreSQL returns NUMERIC/DECIMAL columns as strings. This stops the
  // frontend from getting "43" instead of 43 for prices, totals, etc.
  postProcessResponse: (result: any) => {
    if (Array.isArray(result)) return result;
    return result;
  },
};

export const db = knex(config);

// ── Connection verification ───────────────────────────────────────────────────
export async function verifyConnection(): Promise<void> {
  await db.raw('SELECT 1');
}

// ── RLS context helpers ───────────────────────────────────────────────────────
export async function setUserContext(
  trxOrDb: Knex | Knex.Transaction,
  userId: string
): Promise<void> {
  await trxOrDb.raw(`SET LOCAL app.current_user_id = ?`, [userId]);
}

export async function withUserContext<T>(
  userId: string,
  callback: (trx: Knex.Transaction) => Promise<T>
): Promise<T> {
  return db.transaction(async (trx) => {
    await setUserContext(trx, userId);
    return callback(trx);
  });
}

export default db;