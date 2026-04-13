import type { Knex } from 'knex';
import dotenv from 'dotenv';
dotenv.config();

const config: Record<string, Knex.Config> = {
  development: {
    client: 'postgresql',
    connection: {
      host:     process.env.DB_HOST     || 'localhost',
      port:     Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME     || 'marketplace_db',
      user:     process.env.DB_USER     || 'ecom_api',
      password: process.env.DB_PASSWORD || '',
    },
    pool: { min: 2, max: 10 },
    migrations: { directory: '../database/migrations', extension: 'ts' },
    seeds:      { directory: '../database/seeds',      extension: 'ts' },
  },
  test: {
    client: 'postgresql',
    connection: {
      host:     process.env.DB_HOST      || 'localhost',
      port:     Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_TEST_NAME || 'marketplace_test',
      user:     process.env.DB_USER      || 'ecom_api',
      password: process.env.DB_PASSWORD  || '',
    },
    pool: { min: 2, max: 10 },
    migrations: { directory: '../database/migrations', extension: 'ts' },
  },
  production: {
    client: 'postgresql',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    },
    pool: {
      min: 0,
      max: 10,
      acquireTimeoutMillis: 30_000,
      idleTimeoutMillis:    10_000,
    },
    migrations: { directory: '../database/migrations' },
    seeds:      { directory: '../database/seeds'      },
  },
};

export default config;