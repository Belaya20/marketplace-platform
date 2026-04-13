import type { Knex } from 'knex';
import dotenv from 'dotenv';
import path from 'path';

// Load variables in local development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

/**
 * SUPER CLASS ARCHITECTURE:
 * We use path.join(process.cwd(), ...) to ensure paths are absolute.
 * This prevents "Directory not found" errors when moving between 
 * development (TS) and production (JS in dist).
 */

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
    migrations: { 
      directory: path.join(process.cwd(), 'src', 'database', 'migrations'), 
      extension: 'ts' 
    },
    seeds: { 
      directory: path.join(process.cwd(), 'src', 'database', 'seeds'), 
      extension: 'ts' 
    },
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
    migrations: { 
      directory: path.join(process.cwd(), 'src', 'database', 'migrations'), 
      extension: 'ts' 
    },
  },

  production: {
    client: 'postgresql',
    connection: {
      connectionString: process.env.DATABASE_URL,
      // Essential for Neon/Railway cloud databases
      ssl: { rejectUnauthorized: false },
    },
    pool: {
      min: 0, // Critical: Releases connections in serverless/cloud environments
      max: 10,
      acquireTimeoutMillis: 30_000,
      idleTimeoutMillis:    10_000,
    },
    migrations: { 
      // Pointing to the compiled JS files in the dist folder
      directory: path.join(process.cwd(), 'dist', 'database', 'migrations'),
      // THE SHIELD: Tells Knex to only run JS and ignore the crashing .d.ts files
      loadExtensions: ['.js'] 
    },
    seeds: { 
      directory: path.join(process.cwd(), 'dist', 'database', 'seeds'),
      loadExtensions: ['.js']
    },
  },
};

export default config;