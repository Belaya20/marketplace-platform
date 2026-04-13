import type { Knex } from 'knex';
import dotenv from 'dotenv';
import path from 'path';

// Load variables in local development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const isProduction = process.env.NODE_ENV === 'production';

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
      directory: './src/database/migrations', 
      extension: 'ts' 
    },
    seeds: { 
      directory: './src/database/seeds', 
      extension: 'ts' 
    },
  },

  production: {
    client: 'postgresql',
    connection: {
      connectionString: process.env.DATABASE_URL,
      // Critical for Neon/Railway cloud connectivity
      ssl: { rejectUnauthorized: false },
    },
    pool: {
      min: 0, // Critical for Neon free tier to release idle connections
      max: 10,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 10000,
    },
    migrations: { 
      // Points to compiled JS files in dist
      directory: path.join(__dirname, 'dist/database/migrations'),
      // SUPER CLASS FIX: Ignore .d.ts files that cause SyntaxErrors
      loadExtensions: ['.js'] 
    },
    seeds: { 
      directory: path.join(__dirname, 'dist/database/seeds'),
      loadExtensions: ['.js']
    },
  },
};

export default config;