 import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import db from '../../config/database';
import logger from '../../config/logger';

// ── Email helpers ─────────────────────────────────────────────────────────────

/**
 * Creates a fresh nodemailer transporter on every call.
 * This guarantees we always read the current SMTP_* env vars,
 * even if they were injected after module initialisation (e.g. Railway).
 */
function createTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST   || 'smtp.resend.com',
    port:   parseInt(process.env.SMTP_PORT || '587', 10),
    // SMTP_SECURE=true → port 465 implicit TLS
    // SMTP_SECURE=false (default) → port 587 STARTTLS
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || 'resend',
      pass: process.env.SMTP_PASS || '',
    },
  });
}

/**
 * Canonical "from" address for outgoing email.
 * Priority: SMTP_FROM env var → onboarding@resend.dev (Resend's shared domain).
 * Never falls back to SMTP_USER which is 'resend' — not a valid email address.
 */
function getFromAddress(): string {
  const from = process.env.SMTP_FROM || 'onboarding@resend.dev';
  return `"AddisMarket" <${from}>`;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const notificationService = {

  // ── In-app notification ───────────────────────────────────────────────────
  // Inserts a row into the notifications table.
  // Used by every event that needs a bell icon in the UI.
  async createInApp(data: {
    user_id:     string;
    type:        string;
    title:       string;
    body:        string;
    action_url?: string;
  }) {
    const [notif] = await db('notifications').insert({
      id:         uuidv4(),
      user_id:    data.user_id,
      type:       data.type,
      channel:    'in_app',
      title:      data.title,
      body:       data.body,
      action_url: data.action_url || null,
    }).returning('*');
    return notif;
  },

  // ── Email notification ────────────────────────────────────────────────────
  // Fire-and-forget from the caller's perspective.
  // Internally catches all SMTP errors so they never propagate.
  async sendEmail(data: {
    to:       string;
    subject:  string;
    text:     string;
    html?:    string;
  }): Promise<void> {
    // Validate required SMTP config before attempting connection.
    // Prevents cryptic nodemailer errors when env vars are missing.
    if (!process.env.SMTP_PASS) {
      logger.warn('[email] SMTP_PASS not set — skipping email delivery');
      return;
    }

    try {
      const transporter = createTransporter();
      await transporter.sendMail({
        from:    getFromAddress(),
        to:      data.to,
        subject: data.subject,
        text:    data.text,
        html:    data.html,
      });
      logger.info(`[email] Sent to ${data.to}: "${data.subject}"`);
    } catch (err: any) {
      // Log the full error for debugging but never throw.
      // The OTP is already stored in the DB — user can resend if email fails.
      logger.error(`[email] Failed to send to ${data.to}: ${err.message}`);
    }
  },

  // ── Order status change notification ─────────────────────────────────────
  // Called by orders.service when an order moves to a new status.
  // Creates an in-app notification AND sends an email.
  async notifyOrderStatusChange(orderId: string, newStatus: string): Promise<void> {
    const order = await db('orders as o')
      .join('users as u', 'u.id', 'o.customer_id')
      .where('o.id', orderId)
      .select('o.*', 'u.email', 'u.first_name')
      .first();

    if (!order) return;

    const messages: Record<string, string> = {
      confirmed:  'Your order has been confirmed and is being prepared.',
      processing: 'Your order is being processed by the seller.',
      shipped:    `Your order is on its way! Tracking: ${order.tracking_number || 'Pending'}`,
      delivered:  'Your order has been delivered. We hope you enjoy your purchase!',
      cancelled:  'Your order has been cancelled.',
      returned:   'Your return request has been processed.',
    };

    const body = messages[newStatus] || `Your order status is now: ${newStatus}`;

    // In-app first (always works, no network dependency)
    await this.createInApp({
      user_id:    order.customer_id,
      type:       'order_update',
      title:      `Order ${order.order_number} — ${newStatus}`,
      body,
      action_url: `/account/orders/${orderId}`,
    });

    // Email fire-and-forget — failure doesn't affect order processing
    this.sendEmail({
      to:      order.email,
      subject: `Your order ${order.order_number} is ${newStatus}`,
      text:    `Hello ${order.first_name || 'there'},\n\n${body}\n\nOrder: ${order.order_number}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#7c3aed">Order Update</h2>
          <p>Hello ${order.first_name || 'there'},</p>
          <p>${body}</p>
          <p style="color:#6b7280;font-size:13px">Order number: <strong>${order.order_number}</strong></p>
        </div>
      `,
    }).catch(() => { /* already logged inside sendEmail */ });
  },

  // ── Low stock alert ───────────────────────────────────────────────────────
  // Triggered by the background job that checks stock levels every 30 min.
  async notifyLowStock(variantId: string): Promise<void> {
    const variant = await db('product_variants as pv')
      .join('products as p',       'p.id',  'pv.product_id')
      .join('seller_profiles as sp', 'sp.id', 'p.seller_id')
      .join('users as u',          'u.id',  'sp.user_id')
      .where('pv.id', variantId)
      .select(
        'pv.sku', 'pv.stock_qty', 'p.name as product_name',
        'u.id as user_id', 'u.email',
      )
      .first();

    if (!variant) return;

    await this.createInApp({
      user_id:    variant.user_id,
      type:       'low_stock',
      title:      'Low stock alert',
      body:       `"${variant.product_name}" (SKU: ${variant.sku}) has only ${variant.stock_qty} unit(s) left.`,
      action_url: '/seller/inventory',
    });
  },

  // ── Seller approval notification ──────────────────────────────────────────
  // Called by admin.service when approving or rejecting a seller application.
  async notifySellerApproval(
    sellerId: string,
    approved: boolean,
    reason?:  string,
  ): Promise<void> {
    const sp = await db('seller_profiles as sp')
      .join('users as u', 'u.id', 'sp.user_id')
      .where('sp.id', sellerId)
      .select('sp.*', 'u.email', 'u.first_name', 'u.id as user_id')
      .first();

    if (!sp) return;

    const title = approved
      ? 'Your seller account is approved!'
      : 'Seller application update';

    const body = approved
      ? 'Congratulations! Your seller account has been approved. You can now list products.'
      : `Your seller application was not approved.${reason ? ` Reason: ${reason}` : ''}`;

    await this.createInApp({
      user_id:    sp.user_id,
      type:       'seller_approval',
      title,
      body,
      action_url: approved ? '/seller/dashboard' : '/seller/profile',
    });

    this.sendEmail({
      to:      sp.email,
      subject: title,
      text:    body,
    }).catch(() => {});
  },

  // ── Return status notification ────────────────────────────────────────────
  // Called by returns.service when a return request status changes.
  async notifyReturnUpdate(returnId: string): Promise<void> {
    const ret = await db('returns as r')
      .join('users as u', 'u.id', 'r.customer_id')
      .where('r.id', returnId)
      .select('r.*', 'u.email', 'u.first_name', 'u.id as user_id')
      .first();

    if (!ret) return;

    await this.createInApp({
      user_id:    ret.user_id,
      type:       'return_update',
      title:      `Return request ${ret.status}`,
      body:       `Your return request is now: ${ret.status}.`,
      action_url: '/account/returns',
    });
  },

  // ── SMS notification ──────────────────────────────────────────────────────
  // Uses Africa's Talking SMS gateway.
  // Only fires if AT_API_KEY is set — silently skips otherwise.
  async sendSms(data: { to: string; message: string }): Promise<void> {
    const apiKey   = process.env.AT_API_KEY  || '';
    const username = process.env.AT_USERNAME || 'sandbox';

    if (!apiKey) {
      logger.warn('[sms] AT_API_KEY not set — skipping SMS delivery');
      return;
    }

    try {
      const AT = require('africastalking')({ apiKey, username });
      await AT.SMS.send({
        to:      [data.to],
        message: data.message,
        from:    process.env.AT_SENDER_ID || '',
      });
      logger.info(`[sms] Sent to ${data.to}`);
    } catch (err: any) {
      logger.error(`[sms] Failed to send to ${data.to}: ${err.message}`);
      // Never throw — SMS failure must not block the main flow
    }
  },
};