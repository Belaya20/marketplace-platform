// src/modules/payments/chapa.service.ts
// Req 3.2.6: Chapa Payment Gateway Integration
import axios from 'axios';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import db from '../../config/database';
import { AppError } from '../../utils/response';
import { ChapaInitRequest, ChapaInitResponse, ChapaVerifyResponse } from '../../types';
import logger from '../../config/logger';

const CHAPA_BASE     = 'https://api.chapa.co/v1';
const CHAPA_SECRET   = process.env.CHAPA_SECRET_KEY   || '';
const WEBHOOK_SECRET = process.env.CHAPA_WEBHOOK_SECRET || '';

function resolveCallbackUrl(path: string): string {
  const base = process.env.API_BASE_URL || '';
  if (!base || base.includes('localhost') || base.includes('127.0.0.1')) {
    return `https://webhook.site/placeholder${path}`;
  }
  return `${base}${path}`;
}

function resolveReturnUrl(path: string): string {
  const base = process.env.FRONTEND_URL || 'http://localhost:3000';
  // Strip trailing slash to avoid double slashes
  return `${base.replace(/\/$/, '')}${path}`;
}

export const chapaService = {

  // ── Req 3.2.6: Initiate Chapa payment ────────────────────────────────────
  async initiatePayment(orderId: string, customerId: string) {
    if (!CHAPA_SECRET || CHAPA_SECRET === 'your_chapa_secret_key_here') {
      throw AppError.internal(
        'Chapa is not configured. Set CHAPA_SECRET_KEY in backend/.env'
      );
    }

    const order = await db('orders')
      .where({ id: orderId, customer_id: customerId })
      .first();
    if (!order) throw AppError.notFound('Order not found');
    if (order.payment_status === 'paid') throw AppError.conflict('Order already paid');

    const user = await db('users').where('id', customerId).first();

    const txRef = `MKT-${order.order_number}-${Date.now()}`;

    const chapaPayload: ChapaInitRequest = {
      amount:     Number(order.total),
      currency:   'ETB',
      email:      user.email,
      first_name: user.first_name || 'Customer',
      last_name:  user.last_name  || 'User',
      tx_ref:     txRef,
      callback_url: resolveCallbackUrl('/api/v1/payments/webhook/chapa'),
      return_url:   resolveReturnUrl(`/checkout/success?order=${order.order_number}`),
      customization: {
        // ── FIX: Chapa max 16 characters for title ──
        title:       'AddisMarket',        // 11 chars ✓
        description: `Order ${order.order_number}`.slice(0, 100),
      },
    };

    if (process.env.NODE_ENV !== 'production') {
      logger.info(`Chapa payload: ${JSON.stringify(chapaPayload)}`);
    }

    let response: any;
    try {
      response = await axios.post<ChapaInitResponse>(
        `${CHAPA_BASE}/transaction/initialize`,
        chapaPayload,
        {
          headers: {
            Authorization:  `Bearer ${CHAPA_SECRET}`,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (err: any) {
      const chapaError = err.response?.data;
      logger.error(`Chapa 400 detail: ${JSON.stringify(chapaError)}`);
      // ── FIX: serialize the error object properly instead of [object Object] ──
      const msg = typeof chapaError?.message === 'object'
        ? Object.entries(chapaError.message)
            .map(([field, errors]) => `${field}: ${(errors as string[]).join(', ')}`)
            .join(' | ')
        : chapaError?.message || err.message || 'Unknown Chapa error';
      throw AppError.internal(`Chapa error: ${msg}`);
    }

    if (response.data.status !== 'success') {
      throw AppError.internal('Failed to initialize Chapa payment');
    }

    await db('payments').insert({
      id:                 uuidv4(),
      order_id:           orderId,
      chapa_tx_ref:       txRef,
      chapa_checkout_url: response.data.data.checkout_url,
      amount:             order.total,
      currency:           'ETB',
      status:             'initiated',
    });

    await db('orders').where('id', orderId).update({ chapa_tx_ref: txRef });

    return {
      checkout_url: response.data.data.checkout_url,
      tx_ref: txRef,
    };
  },

  // ── Req 3.2.6: Verify payment status ─────────────────────────────────────
  async verifyPayment(txRef: string, customerId: string) {
    const payment = await db('payments').where('chapa_tx_ref', txRef).first();
    if (!payment) throw AppError.notFound('Payment record not found');

    const order = await db('orders')
      .where({ id: payment.order_id, customer_id: customerId })
      .first();
    if (!order) throw AppError.forbidden('Not your order');

    const response = await axios.get<ChapaVerifyResponse>(
      `${CHAPA_BASE}/transaction/verify/${txRef}`,
      { headers: { Authorization: `Bearer ${CHAPA_SECRET}` } }
    );

    const chapaData = response.data.data;
    const isSuccess = chapaData.status === 'success';

    await db('payments').where('id', payment.id).update({
      chapa_verify_payload: chapaData,
      status:      isSuccess ? 'success' : 'failed',
      verified_at: isSuccess ? new Date() : null,
    });

    if (isSuccess) {
      await db('orders').where('id', order.id).update({
        status:         'confirmed',
        payment_status: 'paid',
      });
    }

    return { verified: isSuccess, status: chapaData.status };
  },

  // ── Req 3.2.6: Webhook handler ────────────────────────────────────────────
  async handleWebhook(rawBody: string, signature: string) {
    const webhookSecretIsSet = WEBHOOK_SECRET &&
      WEBHOOK_SECRET !== 'your_chapa_webhook_secret_here' &&
      WEBHOOK_SECRET.length > 10;

    if (webhookSecretIsSet) {
      const expected = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');
      if (expected !== signature) {
        logger.warn('Chapa webhook signature mismatch');
        throw AppError.unauthorized('Invalid webhook signature');
      }
    } else {
      logger.warn('Chapa webhook secret not configured — skipping signature check');
    }

    const payload = JSON.parse(rawBody);
    const txRef   = payload.tx_ref || payload.trx_ref;

    if (!txRef) { logger.warn('Chapa webhook missing tx_ref'); return { received: true }; }

    const payment = await db('payments').where('chapa_tx_ref', txRef).first();
    if (!payment) { logger.warn(`Chapa webhook unknown tx_ref: ${txRef}`); return { received: true }; }
    if (payment.status === 'success') return { received: true, note: 'already processed' };

    await db('payments').where('id', payment.id).update({
      chapa_webhook_payload: payload,
      status:      payload.status === 'success' ? 'success' : 'failed',
      verified_at: payload.status === 'success' ? new Date() : null,
    });

    if (payload.status === 'success') {
      await db.transaction(async (trx) => {
        await trx('orders').where('id', payment.order_id).update({
          payment_status: 'paid',
          status:         'confirmed',
        });
        await trx('order_status_history').insert({
          id: uuidv4(), order_id: payment.order_id,
          from_status: 'pending', to_status: 'confirmed',
          note: `Payment confirmed via Chapa. tx_ref: ${txRef}`,
        });
      });
      const { notificationService } = await import('../notifications/notification.service');
      await notificationService.notifyOrderStatusChange(payment.order_id, 'confirmed');
    }

    return { received: true };
  },

  // ── COD confirmation ──────────────────────────────────────────────────────
  async confirmCOD(orderId: string) {
    const order = await db('orders')
      .where({ id: orderId, payment_method: 'cod' })
      .first();
    if (!order) throw AppError.notFound('COD order not found');

    await db('orders').where('id', orderId).update({ status: 'confirmed' });

    await db('order_status_history').insert({
      id: uuidv4(), order_id: orderId,
      from_status: 'pending', to_status: 'confirmed',
      note: 'Cash on delivery order confirmed',
    });

    return { confirmed: true };
  },
};