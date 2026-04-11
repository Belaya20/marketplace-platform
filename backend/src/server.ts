// src/server.ts
// Server entry point — starts HTTP server and initialises background jobs
import dotenv from 'dotenv';
dotenv.config();   // Must be first — loads .env before anything else

import http from 'http';
import app from './app';
import { verifyConnection, db } from './config/database';
import logger from './config/logger';
import { startBackgroundJobs } from './jobs/index';

// ─── Healthcheck route ────────────────────────────────────────────────────────
// Railway expects /health to return 200 OK if the app is alive.
// We mount it directly on the app before creating the server.
app.get('/health', async (req, res) => {
  try {
    await verifyConnection(); // quick DB check
    res.status(200).send('OK');
  } catch (err) {
    logger.error('Healthcheck failed:', err);
    res.status(500).send('DB not reachable');
  }
});

const PORT = parseInt(process.env.PORT || '5000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// ─── Create HTTP server ───────────────────────────────────────────────────────
const server = http.createServer(app);

// ─── Graceful shutdown ────────────────────────────────────────────────────────
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

  // Force-kill if graceful shutdown takes too long
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// ─── Unhandled errors ─────────────────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

// ─── Start ────────────────────────────────────────────────────────────────────
async function start() {
  try {
    // Test database connection
    await verifyConnection();
    logger.info('Database connection verified');

    // Start HTTP server
    server.listen(PORT, HOST, () => {
      logger.info(`Server running on http://${HOST}:${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`API Base:    http://localhost:${PORT}/api/v1`);
      logger.info(`Health:      http://localhost:${PORT}/health`);
    });

    // Start background jobs (low-stock alerts, report exports, etc.)
    startBackgroundJobs();

  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
