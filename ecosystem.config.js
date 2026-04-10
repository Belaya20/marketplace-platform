// ecosystem.config.js — place in marketplace-platform/ root
// Req 4.3: Scalability — cluster mode uses all CPU cores
// Req 4.4: Backup & Recovery — PM2 auto-restarts on crash
//
// Usage:
//   pm2 start ecosystem.config.js
//   pm2 save
//   pm2 startup   (then run the command it outputs)

module.exports = {
  apps: [
    // ── Backend API ────────────────────────────────────────────────────────────
    {
      name:      'marketplace-api',
      cwd:       './backend',
      script:    'dist/server.js',
      // FIX: cluster mode — spawns one worker per CPU core.
      // On a 2-core VPS this gives you 2 Node processes = 2x throughput.
      // Each worker shares the same port via Node.js cluster module.
      instances: 'max',          // 'max' = one per CPU core; or set to 2, 4, etc.
      exec_mode: 'cluster',
      // ── Environment ───────────────────────────────────────────────────────
      env: {
        NODE_ENV: 'production',
        PORT:     '5000',
      },
      // ── Restart policy ───────────────────────────────────────────────────
      // Restart if process crashes
      autorestart: true,
      // Don't restart more than 10 times in 1 minute (prevents crash loops)
      max_restarts: 10,
      min_uptime:   '30s',
      // ── Memory limit ─────────────────────────────────────────────────────
      // FIX: Restart if memory exceeds 500MB per worker — prevents memory leaks
      // from slowly degrading production
      max_memory_restart: '500M',
      // ── Logging ──────────────────────────────────────────────────────────
      out_file:   './logs/api-out.log',
      error_file: './logs/api-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      // FIX: Merge logs from all cluster workers into one file
      merge_logs: true,
    },

    // ── Frontend (customer + seller) ──────────────────────────────────────────
    {
      name:      'marketplace-frontend',
      cwd:       './frontend',
      script:    '.next/standalone/server.js',
      instances: 1,              // Next.js handles concurrency internally
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT:     '3000',
        HOSTNAME: '0.0.0.0',
      },
      autorestart:        true,
      max_restarts:       10,
      min_uptime:         '30s',
      max_memory_restart: '400M',
      out_file:    './logs/frontend-out.log',
      error_file:  './logs/frontend-error.log',
      merge_logs:  true,
    },

    // ── Admin panel ───────────────────────────────────────────────────────────
    {
      name:      'marketplace-admin',
      cwd:       './admin',
      script:    '.next/standalone/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT:     '3001',
        HOSTNAME: '0.0.0.0',
      },
      autorestart:        true,
      max_restarts:       10,
      min_uptime:         '30s',
      max_memory_restart: '300M',
      out_file:    './logs/admin-out.log',
      error_file:  './logs/admin-error.log',
      merge_logs:  true,
    },
  ],
};

// =============================================================================
// DEPLOYMENT COMMANDS
// =============================================================================
//
// Build everything:
//   cd backend  && npm run build
//   cd frontend && npm run build
//   cd admin    && npm run build
//
// Start all three with PM2:
//   pm2 start ecosystem.config.js
//
// Reload without downtime (rolling restart):
//   pm2 reload marketplace-api       ← zero-downtime reload
//   pm2 reload marketplace-frontend
//
// Check status:
//   pm2 status
//   pm2 logs marketplace-api --lines 100
//
// Set PM2 to start on server reboot:
//   pm2 save
//   pm2 startup   ← run the command it gives you as root