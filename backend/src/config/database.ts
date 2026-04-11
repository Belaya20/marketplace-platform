// backend/src/config/database.ts
// Req 4.1: Optimized database queries — connection pooling
// Req 4.2: Security — RLS context set per request
import knex, { Knex } from 'knex';
import dotenv from 'dotenv';
dotenv.config();

// ── Connection pool sizing ────────────────────────────────────────────────────
const POOL_MIN = parseInt(process.env.DB_POOL_MIN || '2');
const POOL_MAX = parseInt(process.env.DB_POOL_MAX || '10');

// ── Connection Strategy ───────────────────────────────────────────────────────
const connectionConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    }
  : {
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME     || 'marketplace_db',
      user:     process.env.DB_USER     || 'ecom_api',
      password: process.env.DB_PASSWORD || 'QuantumRidgeForgeK74N0',
      ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };

const config: Knex.Config = {
  client: 'pg',
  connection: {
    ...connectionConfig,
    options: `-c statement_timeout=15000`,
  },
  pool: {
    min: POOL_MIN,
    max: POOL_MAX,
    acquireTimeoutMillis: 15_000,
    idleTimeoutMillis:    300_000, 
    reapIntervalMillis:   1_000,
    createRetryIntervalMillis: 200,
  },
  acquireConnectionTimeout: 15_000,
  debug: process.env.NODE_ENV === 'development' && process.env.DB_DEBUG === 'true',

  // FIX: Explicitly typed coerceNumbers to solve TS7023 error
  postProcessResponse: (result: any) => {
    if (!result) return result;
    
    const coerceNumbers = (obj: any): any => {
      if (Array.isArray(obj)) return obj.map(coerceNumbers);
      if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
          // If value is a numeric string (like prices from Postgres)
          if (typeof obj[key] === 'string' && /^\d+(\.\d+)?$/.test(obj[key])) {
             const num = parseFloat(obj[key]);
             if (!isNaN(num)) obj[key] = num;
          } else if (typeof obj[key] === 'object') {
             obj[key] = coerceNumbers(obj[key]);
          }
        }
      }
      return obj;
    };

    return coerceNumbers(result);
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