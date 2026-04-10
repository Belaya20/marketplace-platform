// src/modules/orders/orders.service.ts
import { v4 as uuidv4 } from 'uuid';
import db from '../../config/database';
import { AppError } from '../../utils/response';
import { notificationService } from '../notifications/notification.service';
import PDFDocument from 'pdfkit';

function toCount(result: any): number {
  if (!result) return 0;
  return Number(result.total ?? result.count ?? 0);
}

export const orderService = {

  // ── Place Order ───────────────────────────────────────────────────────────
  async placeOrder(customerId: string, data: {
    shipping_address_id: string;
    shipping_zone_id:    string;
    payment_method:      string;
    discount_code?:      string;
    customer_note?:      string;
  }) {
    const cartItems = await db('cart_items as ci')
      .join('product_variants as pv', 'pv.id', 'ci.variant_id')
      .join('products as p',          'p.id',  'pv.product_id')
      .join('seller_profiles as sp',  'sp.id', 'p.seller_id')
      .where('ci.user_id', customerId)
      .where('p.status', 'active')
      .where('pv.is_active', true)
      .select(
        'ci.id as cart_item_id', 'ci.quantity',
        'pv.id as variant_id', 'pv.sku', 'pv.price', 'pv.discount_price',
        'pv.stock_qty', 'pv.weight_kg',
        'p.id as product_id', 'p.name as product_name', 'p.category_id',
        'sp.id as seller_id', 'sp.commission_rate',
      );

    if (!cartItems.length) throw AppError.badRequest('Cart is empty');

    for (const item of cartItems) {
      if (item.stock_qty < item.quantity) {
        throw AppError.badRequest(
          `Insufficient stock for "${item.product_name}" (available: ${item.stock_qty})`
        );
      }
    }

    // Inject flash sale prices
    const variantIds = cartItems.map((i: any) => i.variant_id);
    const now        = new Date();
    const flashItems = await db('flash_sale_items as fsi')
      .join('flash_sales as fs', 'fs.id', 'fsi.flash_sale_id')
      .whereIn('fsi.variant_id', variantIds)
      .where('fs.is_active', true)
      .where('fs.starts_at', '<=', now)
      .where('fs.ends_at', '>=', now)
      .select('fsi.variant_id', 'fsi.sale_price');

    const flashMap: Record<string, number> = {};
    for (const fi of flashItems) flashMap[fi.variant_id] = Number(fi.sale_price);

    const enrichedItems = cartItems.map((item: any) => {
      const flashPrice     = flashMap[item.variant_id] ?? null;
      const regularPrice   = item.discount_price ? Number(item.discount_price) : Number(item.price);
      const effectivePrice = flashPrice !== null ? flashPrice : regularPrice;
      return { ...item, flash_price: flashPrice, effective_price: effectivePrice };
    });

    const address = await db('user_addresses')
      .where({ id: data.shipping_address_id, user_id: customerId })
      .first();
    if (!address) throw AppError.notFound('Shipping address not found');

    const zone = await db('shipping_zones').where('id', data.shipping_zone_id).first();
    if (!zone) throw AppError.notFound('Shipping zone not found');

    const subtotal    = enrichedItems.reduce((s: number, i: any) => s + i.effective_price * i.quantity, 0);
    const totalWeight = enrichedItems.reduce((s: number, i: any) => s + i.weight_kg * i.quantity, 0);

    let shippingCost = (subtotal >= zone.free_above_amount && zone.free_above_amount > 0)
      ? 0
      : Number(zone.base_rate) + (totalWeight * Number(zone.per_kg_rate));

    let discountAmount  = 0;
    let discountCodeId: string | null = null;

    if (data.discount_code) {
      const code = await db('discount_codes')
        .where('code', data.discount_code.toUpperCase().trim())
        .where('is_active', true)
        .where('starts_at', '<=', now)
        .where('expires_at', '>=', now)
        .first();

      if (!code) throw AppError.badRequest('Invalid or expired discount code');
      if (code.usage_limit !== null && code.usage_count >= code.usage_limit) {
        throw AppError.badRequest('This discount code has reached its usage limit');
      }
      if (subtotal < Number(code.min_order)) {
        throw AppError.badRequest(`This code requires a minimum order of ETB ${Number(code.min_order).toFixed(2)}`);
      }
      if (code.category_id) {
        const cartCategoryIds = [...new Set(enrichedItems.map((i: any) => i.category_id))];
        if (!cartCategoryIds.includes(code.category_id)) {
          const cat = await db('categories').where('id', code.category_id).select('name').first();
          throw AppError.badRequest(`This code only applies to the "${cat?.name ?? 'specific'}" category`);
        }
      }
      if (code.product_id) {
        const cartProductIds = [...new Set(enrichedItems.map((i: any) => i.product_id))];
        if (!cartProductIds.includes(code.product_id)) {
          const prod = await db('products').where('id', code.product_id).select('name').first();
          throw AppError.badRequest(`This code only applies to "${prod?.name ?? 'a specific product'}"`);
        }
      }
      if (code.type === 'percentage')   discountAmount = subtotal * (Number(code.value) / 100);
      else if (code.type === 'fixed_amount') discountAmount = Math.min(Number(code.value), subtotal);
      else if (code.type === 'free_shipping') shippingCost  = 0;
      discountCodeId = code.id;
    }

    const total = Math.max(0, subtotal + shippingCost - discountAmount);

    return db.transaction(async (trx) => {
      const orderId = uuidv4();
      const [order] = await trx('orders').insert({
        id:                        orderId,
        customer_id:               customerId,
        shipping_zone_id:          data.shipping_zone_id,
        discount_rule_id:          null,
        status:                    'pending',
        payment_status:            'unpaid',
        shipping_address_snapshot: address,
        shipping_method:           zone.name,
        subtotal,
        shipping_cost:             shippingCost,
        discount_amount:           discountAmount,
        tax_amount:                0,
        total,
        payment_method:            data.payment_method,
        customer_note:             data.customer_note || null,
      }).returning('*');

      for (const item of enrichedItems) {
        const attrs = await trx('product_attribute_values as pav')
          .join('product_attributes as pa', 'pa.id', 'pav.attribute_id')
          .join('attribute_values as av',   'av.id', 'pav.attribute_value_id')
          .where('pav.variant_id', item.variant_id)
          .select('pa.display_name', 'av.display_value');

        const attrSnapshot: Record<string, string> = {};
        for (const a of attrs) attrSnapshot[a.display_name] = a.display_value;

        const lineTotal  = item.effective_price * item.quantity;
        const commission = lineTotal * (Number(item.commission_rate) / 100);

        await trx('order_items').insert({
          id:                          uuidv4(),
          order_id:                    orderId,
          variant_id:                  item.variant_id,
          seller_id:                   item.seller_id,
          product_name_snapshot:       item.product_name,
          sku_snapshot:                item.sku,
          variant_attributes_snapshot: attrSnapshot,
          unit_price_snapshot:         item.price,
          discount_price_snapshot:     item.flash_price ?? item.discount_price ?? null,
          quantity:                    item.quantity,
          line_total:                  lineTotal,
          commission_rate_snapshot:    item.commission_rate,
          commission_amount:           commission,
          seller_earnings:             lineTotal - commission,
        });
      }

      await trx('order_status_history').insert({
        id: uuidv4(), order_id: orderId,
        from_status: null, to_status: 'pending',
        note: 'Order placed by customer',
      });

      if (discountCodeId) {
        await trx('discount_codes').where('id', discountCodeId).increment('usage_count', 1);
      }

      for (const item of enrichedItems) {
        if (item.flash_price !== null) {
          await trx('flash_sale_items')
            .where('variant_id', item.variant_id)
            .whereIn('flash_sale_id',
              db('flash_sales').where('is_active', true).where('starts_at', '<=', now).where('ends_at', '>=', now).select('id')
            )
            .increment('sold_qty', item.quantity);
        }
      }

      await trx('cart_items').where('user_id', customerId).delete();
      return order;
    });
  },

  async getCustomerOrders(customerId: string, page = 1, limit = 10) {
    const offset      = (page - 1) * limit;
    const countResult = await db('orders').where('customer_id', customerId).count('id as total').first();
    const orders      = await db('orders')
      .where('customer_id', customerId)
      .orderBy('placed_at', 'desc')
      .limit(limit).offset(offset)
      .select('id', 'order_number', 'status', 'payment_status', 'total', 'placed_at');
    return { orders, total: toCount(countResult) };
  },

  async getOrderDetail(orderId: string, customerId: string) {
    const order = await db('orders').where({ id: orderId, customer_id: customerId }).first();
    if (!order) throw AppError.notFound('Order not found');
    const items   = await db('order_items as oi')
      .leftJoin('seller_profiles as sp', 'sp.id', 'oi.seller_id')
      .where('oi.order_id', orderId)
      .select('oi.*', 'sp.business_name as seller_name', 'sp.store_slug');
    const history = await db('order_status_history').where('order_id', orderId).orderBy('changed_at', 'asc');
    return { ...order, items, history };
  },

  async generateInvoice(orderId: string, customerId: string): Promise<Buffer> {
    const order = await db('orders').where({ id: orderId, customer_id: customerId }).first();
    if (!order) throw AppError.notFound('Order not found');
    const items = await db('order_items').where('order_id', orderId);
    const addr  = order.shipping_address_snapshot;

    return new Promise((resolve, reject) => {
      const doc    = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end',  ()  => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).text('INVOICE', 50, 50)
         .fontSize(10)
         .text(`Order: ${order.order_number}`, 50, 80)
         .text(`Date: ${new Date(order.placed_at).toLocaleDateString()}`, 50, 95)
         .text(`Status: ${order.status.toUpperCase()}`, 50, 110);

      doc.moveDown().fontSize(12).text('Ship to:')
         .fontSize(10)
         .text(addr.full_name)
         .text(`${addr.street_address}, ${addr.city}`)
         .text(`${addr.region}, ${addr.country}`)
         .text(`Phone: ${addr.phone}`);

      doc.moveDown().fontSize(12).text('Items:').moveDown();
      let y = doc.y;
      doc.fontSize(10)
         .text('Product', 50, y).text('SKU', 250, y)
         .text('Qty', 340, y).text('Unit Price', 390, y).text('Total', 470, y);
      y += 20;

      for (const item of items) {
        doc.text(item.product_name_snapshot,                           50,  y)
           .text(item.sku_snapshot,                                    250, y)
           .text(String(item.quantity),                                 340, y)
           .text(`ETB ${Number(item.unit_price_snapshot).toFixed(2)}`, 390, y)
           .text(`ETB ${Number(item.line_total).toFixed(2)}`,          470, y);
        y += 18;
      }

      doc.moveDown().moveDown()
         .text(`Subtotal:  ETB ${Number(order.subtotal).toFixed(2)}`,        { align: 'right' })
         .text(`Shipping:  ETB ${Number(order.shipping_cost).toFixed(2)}`,   { align: 'right' })
         .text(`Discount: -ETB ${Number(order.discount_amount).toFixed(2)}`, { align: 'right' })
         .fontSize(12)
         .text(`TOTAL:     ETB ${Number(order.total).toFixed(2)}`,           { align: 'right' });

      doc.end();
    });
  },

  async reorder(orderId: string, customerId: string) {
    const order = await db('orders').where({ id: orderId, customer_id: customerId }).first();
    if (!order) throw AppError.notFound('Order not found');
    const items = await db('order_items as oi')
      .join('product_variants as pv', 'pv.id', 'oi.variant_id')
      .where('oi.order_id', orderId)
      .whereNotNull('oi.variant_id')
      .where('pv.is_active', true)
      .where('pv.stock_qty', '>', 0)
      .select('oi.variant_id', 'oi.quantity');
    if (!items.length) throw AppError.badRequest('No items available to reorder');
    for (const item of items) {
      await db('cart_items')
        .insert({ id: uuidv4(), user_id: customerId, variant_id: item.variant_id, quantity: item.quantity })
        .onConflict(['user_id', 'variant_id']).merge({ quantity: item.quantity });
    }
    return { added: items.length };
  },

  async getSellerOrders(sellerId: string, status: string | null, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    let query = db('order_items as oi')
      .join('orders as o', 'o.id', 'oi.order_id')
      .join('users as u',  'u.id', 'o.customer_id')
      .where('oi.seller_id', sellerId);
    if (status) query = query.where('oi.status', status);
    const countResult = await query.clone().count('oi.id as total').first();
    const items       = await query.clone()
      .select('oi.*', 'o.order_number', 'o.placed_at', 'o.shipping_address_snapshot', 'u.first_name', 'u.last_name', 'u.email')
      .orderBy('o.placed_at', 'desc').limit(limit).offset(offset);
    return { items, total: toCount(countResult) };
  },

  // ── Update item status — THE critical function for wallet flow ────────────
  // =============================================================================
// REPLACE the entire updateItemStatus method in src/modules/orders/orders.service.ts
// =============================================================================

  async updateItemStatus(itemId: string, sellerId: string, newStatus: string, reason?: string) {
    const item = await db('order_items').where({ id: itemId, seller_id: sellerId }).first();
    if (!item) throw AppError.notFound('Order item not found');

    await db('order_items').where('id', itemId).update({
      status:           newStatus,
      rejection_reason: newStatus === 'rejected' ? (reason || null) : null,
    });

    // ── Credit seller wallet when item is delivered ──────────────────────
    // This is the correct moment: goods physically arrived at customer.
    // seller_earnings = line_total - commission_amount (calculated at order placement).
    if (newStatus === 'delivered') {
      const grossAmount      = Number(item.line_total        ?? 0);
      const commissionAmount = Number(item.commission_amount ?? 0);
      const netAmount        = Number(item.seller_earnings   ?? 0);

      if (netAmount > 0) {
        await db.transaction(async (trx) => {
          // 1. Credit wallet_balance and total_earned atomically
          await trx('seller_profiles')
            .where('id', sellerId)
            .update({
              wallet_balance: db.raw('wallet_balance + ?', [netAmount]),
              total_earned:   db.raw('total_earned + ?',   [netAmount]),
            });

          // 2. Insert wallet_transaction using EXACT schema columns:
          //    type: 'commission_credit' (enum value for earnings)
          //    gross_amount: full sale amount before commission deduction
          //    commission_amount: platform commission taken
          //    net_amount: what seller actually receives
          //    order_item_id: links this transaction to the specific item
          //    status: 'completed' (money is available immediately)
          //    note: human-readable description
          //    reference: order_item_id for traceability
          await trx('wallet_transactions').insert({
            id:                uuidv4(),
            seller_id:         sellerId,
            order_item_id:     item.id,
            type:              'commission_credit',
            gross_amount:      grossAmount,
            commission_amount: commissionAmount,
            net_amount:        netAmount,
            status:            'completed',
            reference:         item.id,
            note:              `Sale: ${item.product_name_snapshot} ×${item.quantity}`,
          });
        });
      }
    }

    // ── Sync parent order.status ─────────────────────────────────────────
    // Re-fetch all items AFTER the status update above
    const allItems = await db('order_items').where('order_id', item.order_id);
    const statuses = allItems.map((i: any) => i.status);

    let newOrderStatus: string | null = null;
    if (statuses.every((s: string) => s === 'delivered'))
      newOrderStatus = 'delivered';
    else if (statuses.every((s: string) => ['shipped', 'delivered'].includes(s)))
      newOrderStatus = 'shipped';
    else if (statuses.some((s: string) => s === 'accepted'))
      newOrderStatus = 'processing';

    if (newOrderStatus) {
      await db('orders').where('id', item.order_id).update({ status: newOrderStatus });
      await notificationService.notifyOrderStatusChange(item.order_id, newOrderStatus);
    }

    return { updated: true };
  },

  async getAllOrders(filters: any, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    let query = db('orders as o').join('users as u', 'u.id', 'o.customer_id')
      .select('o.*', 'u.first_name', 'u.last_name', 'u.email');
    if (filters.status)         query = query.where('o.status', filters.status);
    if (filters.payment_status) query = query.where('o.payment_status', filters.payment_status);
    if (filters.date_from)      query = query.where('o.placed_at', '>=', filters.date_from);
    if (filters.date_to)        query = query.where('o.placed_at', '<=', filters.date_to);
    let countQuery = db('orders as o').join('users as u', 'u.id', 'o.customer_id');
    if (filters.status)         countQuery = countQuery.where('o.status', filters.status);
    if (filters.payment_status) countQuery = countQuery.where('o.payment_status', filters.payment_status);
    if (filters.date_from)      countQuery = countQuery.where('o.placed_at', '>=', filters.date_from);
    if (filters.date_to)        countQuery = countQuery.where('o.placed_at', '<=', filters.date_to);
    const countResult = await countQuery.count('o.id as total').first();
    const orders      = await query.clone().orderBy('o.placed_at', 'desc').limit(limit).offset(offset);
    return { orders, total: toCount(countResult) };
  },
};