import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import app from './app';
import { verifyConnection, db } from './config/database';
import logger from './config/logger';
import { startBackgroundJobs } from './jobs/index';

const PORT = parseInt(process.env.PORT || '5000', 10);
const HOST = '0.0.0.0';

/**
 * Health Check Endpoint
 * Returns 200 if DB is connected, 503 if the service is starting or DB is unreachable.
 */
app.get('/health', async (_req, res) => {
  try {
    await verifyConnection();
    res.status(200).json({
      status: 'ok',
      environment: process.env.NODE_ENV || 'development',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Healthcheck database verification failed:', err);
    res.status(503).json({ 
      status: 'error', 
      message: 'Service is starting or database is unreachable' 
    });
  }
});

const server = http.createServer(app);

/**
 * Graceful Shutdown Logic
 */
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Starting graceful shutdown.`);
  server.close(async () => {
    logger.info('HTTP server closed.');
    try {
      await db.destroy();
      logger.info('Database pool successfully closed.');
    } catch (err) {
      logger.error('Error during database pool destruction:', err);
    }
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Shutdown timed out. Forced exit.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

/**
 * Main Application Bootstrap
 */
async function start() {
  try {
    // Stage 1: Bind to port immediately to satisfy Railway health checks
    server.listen(PORT, HOST, () => {
      logger.info(`Server listening on http://${HOST}:${PORT}`);
      logger.info(`Mode: ${process.env.NODE_ENV || 'development'}`);
    });

    // Stage 2: Establish database connectivity in the background
    logger.info('Initiating database connection...');
    await verifyConnection();
    logger.info('Database connection successfully established.');

    // Stage 3: Start background orchestration
    startBackgroundJobs();
  } catch (err) {
    logger.error('Critical failure during startup sequence:', err);
    // Note: We keep the server listening so logs remain accessible via dashboard
  }
}

start();