// src/modules/notifications/notification.service.ts
// Req 3.5: Email notifications, SMS notifications, In-app notifications
// Req 3.5: Order status alerts, Low stock alerts, Promotional notifications
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import db from '../../config/database';
import logger from '../../config/logger';

// ─── Email transport (SMTP / AWS SES) ────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

export const notificationService = {

  // ── Req 3.5: In-app notification ─────────────────────────────────────────
  async createInApp(data: {
    user_id:    string;
    type:       string;
    title:      string;
    body:       string;
    action_url?: string;
  }) {
    const [notif] = await db('notifications').insert({
      id: uuidv4(),
      user_id:    data.user_id,
      type:       data.type,
      channel:    'in_app',
      title:      data.title,
      body:       data.body,
      action_url: data.action_url || null,
    }).returning('*');
    return notif;
  },

  // ── Req 3.5: Email notification ───────────────────────────────────────────
  async sendEmail(data: { to: string; subject: string; text: string; html?: string }) {
    try {
      await transporter.sendMail({
        from:    `"Marketplace" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to:      data.to,
        subject: data.subject,
        text:    data.text,
        html:    data.html,
      });
      logger.info(`Email sent to ${data.to}: ${data.subject}`);
    } catch (err) {
      logger.error(`Failed to send email to ${data.to}`, err);
      // Never throw — email failure must not block the main flow
    }
  },

  // ── Req 3.5: Order status alerts ─────────────────────────────────────────
  async notifyOrderStatusChange(orderId: string, newStatus: string) {
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

    await this.createInApp({
      user_id:    order.customer_id,
      type:       'order_update',
      title:      `Order ${order.order_number} — ${newStatus}`,
      body,
      action_url: `/account/orders/${orderId}`,
    });

    await this.sendEmail({
      to:      order.email,
      subject: `Your order ${order.order_number} is ${newStatus}`,
      text:    `Hello ${order.first_name || ''},\n\n${body}\n\nOrder: ${order.order_number}`,
    });
  },

  // ── Req 3.5: Low stock alerts ─────────────────────────────────────────────
  async notifyLowStock(variantId: string) {
    const variant = await db('product_variants as pv')
      .join('products as p', 'p.id', 'pv.product_id')
      .join('seller_profiles as sp', 'sp.id', 'p.seller_id')
      .join('users as u', 'u.id', 'sp.user_id')
      .where('pv.id', variantId)
      .select('pv.sku', 'pv.stock_qty', 'p.name as product_name',
              'sp.id as seller_id', 'u.id as user_id', 'u.email')
      .first();

    if (!variant) return;

    await this.createInApp({
      user_id:    variant.user_id,
      type:       'low_stock',
      title:      'Low stock alert',
      body:       `"${variant.product_name}" (SKU: ${variant.sku}) has only ${variant.stock_qty} units left.`,
      action_url: `/seller/inventory`,
    });
  },

  // ── Req 3.5: Seller approval notification ────────────────────────────────
  async notifySellerApproval(sellerId: string, approved: boolean, reason?: string) {
    const sp = await db('seller_profiles as sp')
      .join('users as u', 'u.id', 'sp.user_id')
      .where('sp.id', sellerId)
      .select('sp.*', 'u.email', 'u.first_name', 'u.id as user_id')
      .first();

    if (!sp) return;

    const title = approved ? 'Your seller account is approved!' : 'Seller application update';
    const body  = approved
      ? 'Congratulations! Your seller account has been approved. You can now list products.'
      : `Your seller application was not approved. ${reason ? 'Reason: ' + reason : ''}`;

    await this.createInApp({
      user_id: sp.user_id, type: 'seller_approval', title, body,
      action_url: approved ? '/seller/dashboard' : '/seller/profile',
    });

    await this.sendEmail({ to: sp.email, subject: title, text: body });
  },




    async sendSms(data: { to: string; message: string }) {
    const apiKey   = process.env.AT_API_KEY   || '';
    const username = process.env.AT_USERNAME  || 'sandbox';
    if (!apiKey) { logger.warn('SMS not configured — set AT_API_KEY in .env'); return; }
    try {
      const AT = require('africastalking')({ apiKey, username });
      await AT.SMS.send({ to: [data.to], message: data.message, from: process.env.AT_SENDER_ID || '' });
      logger.info(`SMS sent to ${data.to}`);
    } catch (err) {
      logger.error(`SMS failed to ${data.to}`, err);
      // Never throw — SMS failure must not block main flow
    }
  },
  // ── Req 3.5: Return status notification ──────────────────────────────────
  async notifyReturnUpdate(returnId: string) {
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
      action_url: `/account/returns`,
    });
  },
};


