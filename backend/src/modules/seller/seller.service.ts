// src/modules/seller/seller.service.ts
// Req 3.3.1: Seller Dashboard — overview statistics, sales graph, product performance
// Req 3.3.2: Product management (handled in products.service.ts)
// Req 3.3.4: Inventory Management — stock alerts, low stock notifications, stock history
import db from '../../config/database';
import { AppError } from '../../utils/response';

export const sellerService = {

  // ── Req 3.1.3: Seller profile management ─────────────────────────────────
  async getProfile(sellerId: string) {
    const profile = await db('seller_profiles as sp')
      .join('users as u', 'u.id', 'sp.user_id')
      .where('sp.id', sellerId)
      .select(
        'sp.*',
        'u.email', 'u.first_name', 'u.last_name',
        'u.profile_image_url', 'u.phone'
      )
      .first();

    if (!profile) throw AppError.notFound('Seller profile not found');
    return profile;
  },

  async updateProfile(sellerId: string, data: any) {
    const allowed = [
      'business_name', 'business_registration_no', 'tax_id',
      'business_address', 'bank_name', 'bank_account_no',
      'bank_account_name', 'store_slug', 'return_policy',
      'business_description',
    ];
    const updates: any = {};
    for (const key of allowed) {
      if (data[key] !== undefined) updates[key] = data[key];
    }

    const [updated] = await db('seller_profiles')
      .where('id', sellerId)
      .update(updates)
      .returning('*');

    return updated;
  },

  // ── Req 3.3.4: Inventory Management ──────────────────────────────────────
  async getInventory(sellerId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    type CountRow = { total: string | number };

    const [countRow, variants] = await Promise.all([
      db('product_variants as pv')
        .join('products as p', 'p.id', 'pv.product_id')
        .where('p.seller_id', sellerId)
        .where('p.status', 'active')
        .count<CountRow>('pv.id as total')
        .first(),

      db('product_variants as pv')
        .join('products as p', 'p.id', 'pv.product_id')
        .where('p.seller_id', sellerId)
        .where('p.status', 'active')
        .select(
          'pv.id', 'pv.sku', 'pv.stock_qty',
          'pv.low_stock_threshold', 'pv.price',
          'p.id as product_id', 'p.name as product_name', 'p.slug'
        )
        .orderBy('pv.stock_qty', 'asc')   // lowest stock first
        .limit(limit)
        .offset(offset),
    ]);

    const total = Number((countRow?.total ?? 0) as string | number);

    // Mark each variant with stock status
    const data = (variants as any[]).map((v: any) => ({
      ...v,
      stock_status:
        v.stock_qty === 0
          ? 'out_of_stock'
          : v.stock_qty <= v.low_stock_threshold
          ? 'low_stock'
          : 'in_stock',
    }));

    return { data, total };
  },

  // ── Req 3.3.4: Stock history ──────────────────────────────────────────────
  async getStockHistory(sellerId: string, variantId: string) {
    // Verify variant belongs to this seller
    const variant = await db('product_variants as pv')
      .join('products as p', 'p.id', 'pv.product_id')
      .where('pv.id', variantId)
      .where('p.seller_id', sellerId)
      .select('pv.id', 'pv.sku', 'p.name')
      .first();

    if (!variant) throw AppError.notFound('Variant not found');

    const history = await db('stock_history as sh')
      .leftJoin('users as u', 'u.id', 'sh.changed_by')
      .where('sh.variant_id', variantId)
      .orderBy('sh.created_at', 'desc')
      .limit(50)
      .select(
        'sh.*',
        'u.first_name', 'u.last_name', 'u.email'
      );

    return { variant, history };
  },

  // ── Req 3.3.1: Sales graph data ───────────────────────────────────────────
 // ── Req 3.3.1: Sales graph data ───────────────────────────────────────────
  // REPLACE this method in src/modules/seller/seller.service.ts
  //
  // ROOT FIX: was filtering WHERE o.payment_status = 'paid'
  // All COD orders have payment_status = 'unpaid' (paid on delivery)
  // so zero rows were returned → empty chart.
  // Fix: filter by o.status IN ('confirmed','processing','shipped','delivered')
  // which is exactly what "total_revenue" in the dashboard uses.
  async getSalesGraph(
    sellerId: string,
    period: 'daily' | 'weekly' | 'monthly' = 'daily'
  ) {
    const intervals: Record<string, string> = {
      daily:   '30 days',
      weekly:  '12 weeks',
      monthly: '12 months',
    };

    const groupFormats: Record<string, string> = {
      daily:   `DATE(o.placed_at)`,
      weekly:  `DATE_TRUNC('week', o.placed_at)`,
      monthly: `DATE_TRUNC('month', o.placed_at)`,
    };

    const interval = intervals[period];
    const groupBy  = groupFormats[period];

    return db('order_items as oi')
      .join('orders as o', 'o.id', 'oi.order_id')
      .where('oi.seller_id', sellerId)
      // FIX: was o.payment_status = 'paid' — excluded ALL COD orders
      // Now includes any order that is confirmed and progressing
      .whereIn('o.status', ['confirmed', 'processing', 'shipped', 'delivered'])
      .where('o.placed_at', '>=', db.raw(`NOW() - INTERVAL '${interval}'`))
      .groupByRaw(groupBy)
      .select(
        db.raw(`${groupBy} as period`),
        db.raw('SUM(oi.line_total) as revenue'),
        db.raw('COUNT(DISTINCT oi.order_id) as orders'),
        db.raw('SUM(oi.quantity) as units_sold')
      )
      .orderByRaw(groupBy);
  },
  // ── Req 3.3.1: Product performance ───────────────────────────────────────
  async getProductPerformance(sellerId: string) {
    // Join products -> product_variants -> order_items
    return db('products as p')
      .leftJoin('product_variants as pv', 'pv.product_id', 'p.id')
      .leftJoin('order_items as oi', 'oi.variant_id', 'pv.id')
      .where('p.seller_id', sellerId)
      .where('p.status', 'active')
      .select(
        'p.id',
        'p.name',
        'p.slug',
        'p.total_sold',
        'p.avg_rating',
        'p.review_count'
      )
      .groupBy('p.id', 'p.name', 'p.slug', 'p.total_sold', 'p.avg_rating', 'p.review_count')
      .orderBy('p.total_sold', 'desc')
      .limit(20);
  },
};

