import type { Knex } from 'knex';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

/**
 * SUPER CLASS DYNAMIC PATH RESOLUTION:
 * This helper checks multiple locations in the dist folder to ensure
 * migrations are found regardless of how TSC structures the build.
 */
const getProdMigrationDir = () => {
  const possiblePaths = [
    path.join(process.cwd(), 'dist', 'database', 'migrations'),
    path.join(process.cwd(), 'dist', 'migrations'),
    path.join(__dirname, 'database', 'migrations'),
    path.join(__dirname, 'migrations')
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  // Default to the most likely standard path
  return path.join(process.cwd(), 'dist', 'database', 'migrations');
};

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

  production: {
    client: 'postgresql',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    },
    pool: { min: 0, max: 10 },
    migrations: { 
      directory: getProdMigrationDir(),
      loadExtensions: ['.js'] 
    },
    seeds: { 
      directory: path.join(process.cwd(), 'dist', 'database', 'seeds'),
      loadExtensions: ['.js']
    },
  },
};

export default config;