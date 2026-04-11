import knex, { Knex } from 'knex';
import dotenv from 'dotenv';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const POOL_MIN = parseInt(process.env.DB_POOL_MIN || '2');
const POOL_MAX = parseInt(process.env.DB_POOL_MAX || '10');

/**
 * Detects if the connection is routed through a proxy or pooler.
 */
const isPooledConnection = (): boolean => {
  const url = process.env.DATABASE_URL || '';
  return url.includes('neon.tech') || url.includes('pooler') || url.includes('pgbouncer');
};

const getConnection = () => {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    };
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'marketplace_db',
    user: process.env.DB_USER || 'ecom_api',
    password: process.env.DB_PASSWORD || '',
    ssl: false,
  };
};

const config: Knex.Config = {
  client: 'pg',
  connection: {
    ...getConnection(),
    // Note: startup parameters like 'statement_timeout' are omitted here 
    // to ensure compatibility with Neon/PgBouncer.
  },
  pool: {
    min: POOL_MIN,
    max: POOL_MAX,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 500,
    
    // Sets session-level timeouts only for direct (non-pooled) connections.
    afterCreate: isPooledConnection()
      ? undefined
      : (conn: any, done: Function) => {
          conn.query('SET statement_timeout = 15000', (err: any) => done(err, conn));
        },
  },
  acquireConnectionTimeout: 60000,
  debug: process.env.NODE_ENV === 'development' && process.env.DB_DEBUG === 'true',

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