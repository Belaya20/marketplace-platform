// backend/src/config/database.ts
// Req 4.1: Optimized database queries — connection pooling
// Req 4.2: Security — RLS context set per request
import knex, { Knex } from 'knex';
import dotenv from 'dotenv';

// Only load .env in non-production environments. 
// Railway injects variables directly into the process environment.
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const POOL_MIN = parseInt(process.env.DB_POOL_MIN || '2');
const POOL_MAX = parseInt(process.env.DB_POOL_MAX || '10');

/**
 * Super Class Connection Strategy:
 * Automatically switches between Neon Connection String (Production)
 * and Standard Object (Local Development) without manual code changes.
 */
const getConnection = () => {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      // Mandatory for Neon/Railway: Proxy SSL requires rejectUnauthorized: false
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
    // Prevents one heavy query from locking the DB under heavy marketplace load.
    // 15s is generous; most production queries should run in < 100ms.
    options: `-c statement_timeout=15000`,
  },
  pool: {
    min: POOL_MIN,
    max: POOL_MAX,
    // Time to wait for a connection before throwing (ms)
    acquireTimeoutMillis: 30000, 
    // How long an idle connection stays in the pool before being destroyed
    idleTimeoutMillis:    30000,
    // Checks for timed-out idle connections every second
    reapIntervalMillis:   1000,
    // Short delay on failed connection attempts to handle network blips
    createRetryIntervalMillis: 500,
  },
  // High-level timeout for the pool to wake up (crucial for Neon cold-starts)
  acquireConnectionTimeout: 60000, 
  
  debug: process.env.NODE_ENV === 'development' && process.env.DB_DEBUG === 'true',

  /**
   * Data Integrity: Coerces numeric Postgres strings to JS numbers.
   * Postgres returns NUMERIC/DECIMAL as strings. This regex ensures prices 
   * are numbers while keeping IDs and phone numbers as safe strings.
   */
  postProcessResponse: (result: any) => {
    if (!result) return result;

    const coerceNumbers = (obj: any): any => {
      if (Array.isArray(obj)) return obj.map(coerceNumbers);
      if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
          const val = obj[key];
          // Matches values with a decimal point (prices, percentages)
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
 * Called by server.ts to ensure system health.
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