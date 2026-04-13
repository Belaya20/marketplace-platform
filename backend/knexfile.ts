import type { Knex } from 'knex';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Helper to find the best migration path in production
const getProdMigrationDir = () => {
  const possiblePaths = [
    path.join(process.cwd(), 'dist', 'database', 'migrations'),
    path.join(process.cwd(), 'dist', 'migrations') // Fallback if tsc flattens the folder
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return possiblePaths[0]; // Default back
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