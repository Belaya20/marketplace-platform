// backend/src/server.ts
import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import app from './app';
import { verifyConnection, db } from './config/database';
import logger from './config/logger';
import { startBackgroundJobs } from './jobs/index';

const PORT = parseInt(process.env.PORT || '5000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// ─── Health check ─────────────────────────────────────────────────────────────
// FIX: /health must respond with 200 even when DB is briefly unreachable.
// If the DB check throws, return 503 with a body — Railway retries for 90s.
// Previously verifyConnection() crash cascaded into a 502 (no response at all).
app.get('/health', async (_req, res) => {
  try {
    await verifyConnection();
    res.status(200).json({
      status:      'ok',
      environment: process.env.NODE_ENV || 'development',
      uptime:      Math.floor(process.uptime()),
      timestamp:   new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Healthcheck DB check failed:', err);
    // 503 tells Railway "app is alive but not ready yet, keep retrying"
    // vs a timeout/502 which tells it "app is completely dead"
    res.status(503).json({ status: 'error', message: 'DB not reachable' });
  }
});

const server = http.createServer(app);

async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    logger.info('HTTP server closed');
    try {
      await db.destroy();
      logger.info('Database pool closed');
    } catch (err) {
      logger.error('Error closing database pool', err);
    }
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

async function start() {
  try {
    await verifyConnection();
    logger.info('Database connection verified');

    server.listen(PORT, HOST, () => {
      logger.info(`Server running on http://${HOST}:${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Health:      http://localhost:${PORT}/health`);
    });

    startBackgroundJobs();
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();