// backend/knexfile.ts
// Knex configuration for all environments.
// Production uses Neon PostgreSQL — requires SSL with rejectUnauthorized: false
// because Neon uses a self-signed cert in their connection proxy.
import type { Knex } from 'knex';
import dotenv from 'dotenv';

dotenv.config();

const config: Record<string, Knex.Config> = {

  development: {
    client:     'postgresql',
    connection: {
      host:     process.env.DB_HOST     || 'localhost',
      port:     Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME     || 'marketplace_db',
      user:     process.env.DB_USER     || 'ecom_api',
      password: process.env.DB_PASSWORD || '',
    },
    pool:    { min: 2, max: 10 },
    migrations: { directory: './migrations', extension: 'ts' },
    seeds:      { directory: './seeds',      extension: 'ts' },
  },

  test: {
    client:     'postgresql',
    connection: {
      host:     process.env.DB_HOST     || 'localhost',
      port:     Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_TEST_NAME || 'marketplace_test',
      user:     process.env.DB_USER     || 'ecom_api',
      password: process.env.DB_PASSWORD || '',
    },
    pool:    { min: 2, max: 10 },
    migrations: { directory: './migrations', extension: 'ts' },
  },

  production: {
    client: 'postgresql',
    connection: {
      // Neon provides a full connection string — use it directly
      connectionString: process.env.DATABASE_URL,
      // Required for Neon (and most cloud Postgres) — they use proxy SSL
      ssl: process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: false }
        : false,
    },
    // Neon serverless has connection limits — keep pool small
    pool: {
      min: 0,    // allow pool to drain fully when idle
      max: 10,
      // Release connections quickly to stay within Neon free tier limits
      acquireTimeoutMillis: 30_000,
      idleTimeoutMillis:    10_000,
    },
    migrations: { directory: './migrations' },
    seeds:      { directory: './seeds'      },
  },
};

export default config;