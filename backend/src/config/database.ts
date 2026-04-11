// backend/src/config/database.ts
// Req 4.1: Optimized database queries — connection pooling
// Req 4.2: Security — RLS context set per request

import knex, { Knex } from 'knex';
import dotenv from 'dotenv';

// Load .env only in non-production environments
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const POOL_MIN = parseInt(process.env.DB_POOL_MIN || '2');
const POOL_MAX = parseInt(process.env.DB_POOL_MAX || '10');

/**
 * Connection Strategy:
 * - In production (Railway/Neon), use DATABASE_URL with SSL.
 * - In local dev, fall back to discrete host/port/user/password.
 */
const getConnection = () => {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      // Mandatory for Neon/Railway proxy SSL
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };
  }

  return {
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME     || 'marketplace_db',
    user:     process.env.DB_USER     || 'ecom_api',
    password: process.env.DB_PASSWORD || 'QuantumRidgeForgeK74N0',
    ssl:      false,
  };
};

const config: Knex.Config = {
  client: 'pg',
  connection: {
    ...getConnection(),
    // Prevents runaway queries from hanging the app
    options: `-c statement_timeout=15000`, 
  },
  pool: {
    min: POOL_MIN,
    max: POOL_MAX,
    acquireTimeoutMillis: 30000, 
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 500,
  },
  // Top-level timeout for Knex to give up entirely
  acquireConnectionTimeout: 60000, 
  
  debug: process.env.NODE_ENV === 'development' && process.env.DB_DEBUG === 'true',

  /**
   * Data Integrity:
   * Coerce Postgres NUMERIC/DECIMAL strings into JS numbers
   * (but leave integer IDs untouched).
   */
  postProcessResponse: (result: any) => {
    if (!result) return result;

    const coerceNumbers = (obj: any): any => {
      if (Array.isArray(obj)) return obj.map(coerceNumbers);
      if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
          const val = obj[key];
          if (typeof val === 'string' && /^-?\d+\.\d+$/.test(val)) {
            const num = parseFloat(val);
            if (!isNaN(num)) obj[key] = num;
          } else if (typeof val === 'object') {
            obj[key] = coerceNumbers(val);
          }
        }
      }
      return obj;
    };
    return coerceNumbers(result);
  },
};

export const db = knex(config);

/**
 * Verifies database availability on startup.
 * Used by server.ts and /health endpoint.
 */
export const verifyConnection = async (): Promise<void> => {
  await db.raw('SELECT 1');
};

/**
 * Row Level Security (RLS) Helper:
 * Sets the current user ID in the Postgres local session context.
 */
export async function setUserContext(
  trxOrDb: Knex | Knex.Transaction,
  userId: string
): Promise<void> {
  await trxOrDb.raw(`SET LOCAL app.current_user_id = ?`, [userId]);
}

export default db;
