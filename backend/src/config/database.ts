// backend/src/config/database.ts
import knex, { Knex } from 'knex';
import dotenv from 'dotenv';

// Load .env only outside production — Railway injects vars directly
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// ── Detect pooled/proxied connections (Neon, PgBouncer) ──────────────────────
// These proxies REJECT PostgreSQL startup parameters entirely.
// statement_timeout sent as a startup param → "unsupported startup parameter" crash.
// We detect them by URL content so we never send startup params to them.
const isPooledConnection = (): boolean => {
  const url = process.env.DATABASE_URL || '';
  return (
    url.includes('neon.tech')  ||
    url.includes('-pooler.')   ||   // Neon pooler hostnames contain "-pooler."
    url.includes('pgbouncer')  ||
    url.includes('pooler')
  );
};

// ── Pool sizes ────────────────────────────────────────────────────────────────
// Production with Neon free tier: ALWAYS use min:0.
// Neon free tier = max 10 simultaneous connections total.
// min:0 means idle connections are released — critical for free tier.
// min:2 keeps 2 connections open permanently and burns your quota.
// Set DB_POOL_MIN=0 in Railway environment variables.
const isProduction = process.env.NODE_ENV === 'production';
const POOL_MIN = parseInt(process.env.DB_POOL_MIN || (isProduction ? '0' : '2'), 10);
const POOL_MAX = parseInt(process.env.DB_POOL_MAX || '10', 10);

// ── Connection config ─────────────────────────────────────────────────────────
const getConnection = (): Knex.PgConnectionConfig => {
  if (process.env.DATABASE_URL) {
    // Strip ?sslmode=... from URL so pg-connection-string doesn't parse it
    // and emit the "SSL modes treated as aliases" security warning.
    // We set ssl explicitly below instead — this is the correct approach.
    const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, '').replace(/\?$/, '');
    return {
      connectionString: url,
      // Required for Neon and most cloud Postgres — they use TLS proxy certs
      // that don't match the hostname, so rejectUnauthorized must be false.
      ssl: { rejectUnauthorized: false },
    };
  }

  // Local development — plain connection, no SSL
  return {
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME     || 'marketplace_db',
    user:     process.env.DB_USER     || 'ecom_api',
    password: process.env.DB_PASSWORD || '',
    ssl:      false,
  } as any;
};

// ── Pool afterCreate ──────────────────────────────────────────────────────────
// NEVER use `options: '-c statement_timeout=...'` in the connection object.
// That is a PostgreSQL STARTUP PARAMETER — Neon/PgBouncer rejects it on connect.
//
// Instead, use afterCreate to SET statement_timeout on each new connection
// via a regular SQL command. PgBouncer handles SET fine because it's a session
// command, not a startup parameter.
//
// For Neon pooled connections, even SET can be problematic in transaction mode.
// So we skip it entirely for pooled connections — the DB server's own default
// timeout protects us there.
type AfterCreateCb = (err: Error | null, connection: any) => void;

const poolAfterCreate = isPooledConnection()
  ? undefined  // Skip for Neon pooled — no startup params, no SET in pool mode
  : (conn: any, done: AfterCreateCb) => {
      conn.query('SET statement_timeout = 15000', (err: Error | null) => {
        done(err, conn);
      });
    };

// ── Knex config ───────────────────────────────────────────────────────────────
const poolConfig: Knex.PoolConfig = {
  min:                       POOL_MIN,
  max:                       POOL_MAX,
  acquireTimeoutMillis:      30_000,
  idleTimeoutMillis:         30_000,
  reapIntervalMillis:        1_000,
  createRetryIntervalMillis: 500,
};

// Only attach afterCreate when it's defined — knex throws if it's explicitly undefined
if (poolAfterCreate) {
  poolConfig.afterCreate = poolAfterCreate;
}

const config: Knex.Config = {
  client:     'pg',
  connection: getConnection(),
  pool:       poolConfig,
  acquireConnectionTimeout: 60_000,
  debug: process.env.NODE_ENV === 'development' && process.env.DB_DEBUG === 'true',

  // Coerce PostgreSQL numeric strings (e.g. "12.50") to JS numbers.
  // PostgreSQL returns NUMERIC/DECIMAL columns as strings — this fixes it.
  postProcessResponse: (result: any) => {
    if (!result) return result;
    const coerce = (obj: any): any => {
      if (Array.isArray(obj)) return obj.map(coerce);
      if (obj && typeof obj === 'object') {
        for (const key in obj) {
          const val = obj[key];
          if (typeof val === 'string' && /^-?\d+\.\d+$/.test(val)) {
            const n = parseFloat(val);
            if (!isNaN(n)) obj[key] = n;
          } else if (val && typeof val === 'object') {
            obj[key] = coerce(val);
          }
        }
      }
      return obj;
    };
    return coerce(result);
  },
};

export const db = knex(config);

export const verifyConnection = async (): Promise<void> => {
  await db.raw('SELECT 1');
};

export default db;