// src/jobs/index.ts
// Background jobs running on schedule
// Req 3.3.4: Low stock notifications (auto-sent when stock hits threshold)
// Req 3.4.8: Export reports (PDF/Excel) — async generation worker
// Req 4.4:   Backup & Recovery — cleanup old tokens/logs
import cron from 'node-cron';
import db from '../config/database';
import { notificationService } from '../modules/notifications/notification.service';
import { adminService } from '../modules/admin/admin.service';
import logger from '../config/logger';

export function startBackgroundJobs() {
  logger.info('Starting background jobs...');

  // ── Req 3.3.4: Low stock check — runs every 30 minutes ───────────────────
  cron.schedule('*/30 * * * *', async () => {
    try {
      // Find all variants where stock_qty <= low_stock_threshold
      const lowStockVariants = await db('product_variants as pv')
        .join('products as p', 'p.id', 'pv.product_id')
        .whereRaw('pv.stock_qty <= pv.low_stock_threshold')
        .where('pv.stock_qty', '>', 0)       // not yet zero — just low
        .where('pv.is_active', true)
        .where('p.status', 'active')
        .select('pv.id', 'pv.sku', 'pv.stock_qty', 'pv.low_stock_threshold', 'p.name', 'p.seller_id');

      for (const variant of lowStockVariants) {
        // Check: was a low-stock notification already sent in the last 24 hours?
        const recentNotif = await db('notifications as n')
          .join('seller_profiles as sp', 'sp.user_id', 'n.user_id')
          .where('sp.id', variant.seller_id)
          .where('n.type', 'low_stock')
          .where('n.created_at', '>=', db.raw(`NOW() - INTERVAL '24 hours'`))
          .whereRaw(`n.body ILIKE ?`, [`%${variant.sku}%`])
          .first();

        if (!recentNotif) {
          await notificationService.notifyLowStock(variant.id);
          logger.info(`Low stock alert sent: ${variant.sku} (${variant.stock_qty} left)`);
        }
      }
    } catch (err) {
      logger.error('Low stock job failed:', err);
    }
  });

  // ── Req 3.4.8: Report export worker — runs every 2 minutes ────────────────
  // Picks up queued export requests and generates files
  cron.schedule('*/2 * * * *', async () => {
    try {
      const queued = await db('report_exports')
        .where('status', 'queued')
        .orderBy('requested_at', 'asc')
        .limit(3);   // Process max 3 at a time

      for (const job of queued) {
        // Mark as processing
        await db('report_exports')
          .where('id', job.id)
          .update({ status: 'processing', started_at: new Date() });

        try {
          let fileBuffer: Buffer;
          let filename: string;
          let mimeType: string;

          const filters = job.filters as any;

          if (job.format === 'excel') {
            fileBuffer = await adminService.exportSalesReportExcel(filters);
            filename   = `sales-report-${Date.now()}.xlsx`;
            mimeType   = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          } else {
            fileBuffer = await adminService.exportSalesReportPDF(filters);
            filename   = `sales-report-${Date.now()}.pdf`;
            mimeType   = 'application/pdf';
          }

          // In production: upload to S3 and store URL
          // For development: store as base64 data URL
          const fileUrl = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;

          await db('report_exports').where('id', job.id).update({
            status:    'ready',
            file_url:  fileUrl,
            row_count: (job.filters as any).row_count || 0,
            ready_at:  new Date(),
          });

          logger.info(`Report export completed: ${job.id} (${job.format})`);

        } catch (exportErr) {
          await db('report_exports').where('id', job.id).update({
            status:        'failed',
            error_message: String(exportErr),
          });
          logger.error(`Report export failed: ${job.id}`, exportErr);
        }
      }
    } catch (err) {
      logger.error('Report export job failed:', err);
    }
  });

  // ── Cleanup expired OTP tokens — runs daily at 2am ─────────────────────────
  // Req 4.4: Backup & Recovery — keep database clean
  cron.schedule('0 2 * * *', async () => {
    try {
      const deleted = await db('otp_tokens')
        .where('expires_at', '<', new Date())
        .where('is_used', true)
        .delete();
      logger.info(`Cleaned up ${deleted} expired OTP tokens`);
    } catch (err) {
      logger.error('OTP cleanup job failed:', err);
    }
  });

  // ── Cleanup old search logs — keep only last 30 days ─────────────────────
  cron.schedule('0 3 * * *', async () => {
    try {
      const deleted = await db('search_logs')
        .where('searched_at', '<', db.raw(`NOW() - INTERVAL '30 days'`))
        .delete();
      logger.info(`Cleaned up ${deleted} old search logs`);
    } catch (err) {
      logger.error('Search log cleanup failed:', err);
    }
  });

  // ── Flash sale auto-deactivation — runs every 5 minutes ──────────────────
  cron.schedule('*/5 * * * *', async () => {
    try {
      await db('flash_sales')
        .where('is_active', true)
        .where('ends_at', '<', new Date())
        .update({ is_active: false });
    } catch (err) {
      logger.error('Flash sale deactivation job failed:', err);
    }
  });

  logger.info('Background jobs started: low-stock(30min), report-export(2min), cleanup(daily)');
}