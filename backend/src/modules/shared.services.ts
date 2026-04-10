// src/modules/shared.services.ts
import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import db from '../config/database';
import { AppError } from '../utils/response';
import { notificationService } from './notifications/notification.service';

// =============================================================================
// RETURNS SERVICE
// =============================================================================
// =============================================================================
// REPLACE the entire returnService export in src/modules/shared.services.ts
// =============================================================================
export const returnService = {

  async submitReturn(customerId: string, data: {
    order_item_id: string;
    reason:        string;
    note?:         string;        // optional customer note — stored in evidence_urls
    evidence_urls?: string[];
  }) {
    // Verify the item is delivered and belongs to this customer
    const item = await db('order_items as oi')
      .join('orders as o', 'o.id', 'oi.order_id')
      .where('oi.id', data.order_item_id)
      .where('o.customer_id', customerId)
      .where('oi.status', 'delivered')
      .select('oi.*', 'o.customer_id')
      .first();
    if (!item) throw AppError.badRequest('Item not found or not eligible for return (must be delivered)');

    const existing = await db('returns').where('order_item_id', data.order_item_id).first();
    if (existing) throw AppError.conflict('A return request has already been submitted for this item');

    // Store customer note inside evidence_urls jsonb since there is no description column
    // evidence_urls schema: array of URLs + optional {note: string} meta object
    const evidencePayload = {
      urls:       data.evidence_urls || [],
      note:       data.note?.trim()  || null,
    };

    const [ret] = await db('returns').insert({
      id:            uuidv4(),
      order_item_id: data.order_item_id,
      customer_id:   customerId,
      seller_id:     item.seller_id,
      reason:        data.reason,
      evidence_urls: JSON.stringify(evidencePayload),
      status:        'requested',   // correct enum value (not 'pending')
    }).returning('*');

    await notificationService.notifyReturnUpdate(ret.id).catch(() => {});
    return ret;
  },

  async updateReturnStatus(returnId: string, sellerId: string, status: string, data: any) {
    const ret = await db('returns').where({ id: returnId, seller_id: sellerId }).first();
    if (!ret) throw AppError.notFound('Return not found');

    const [updated] = await db('returns').where('id', returnId).update({
      status,
      resolution:    data.resolution   || null,
      refund_amount: data.refund_amount || null,
      seller_note:   data.seller_note  || null,
      updated_at:    new Date(),
      resolved_at:   ['approved', 'rejected', 'completed'].includes(status) ? new Date() : null,
    }).returning('*');

    await notificationService.notifyReturnUpdate(returnId).catch(() => {});
    return updated;
  },

  // FIXED: now joins to get all product/order details the frontend needs
  async getCustomerReturns(customerId: string) {
    const returns = await db('returns as r')
      .join('order_items as oi',     'oi.id',  'r.order_item_id')
      .join('orders as o',           'o.id',   'oi.order_id')
      .join('seller_profiles as sp', 'sp.id',  'r.seller_id')
      .leftJoin('product_variants as pv', 'pv.id', 'oi.variant_id')
      .leftJoin('products as p',         'p.id',  'pv.product_id')
      .leftJoin('product_images as pi', function(this: any) {
        this.on('pi.product_id', 'p.id').andOn('pi.is_primary', db.raw('true'));
      })
      .where('r.customer_id', customerId)
      .orderBy('r.created_at', 'desc')
      .select(
        // Return core
        'r.id', 'r.status', 'r.reason', 'r.evidence_urls',
        'r.resolution', 'r.refund_amount', 'r.seller_note',
        'r.admin_note', 'r.created_at', 'r.resolved_at',
        // Product info from order snapshot (most reliable)
        'oi.id as order_item_id',
        'oi.product_name_snapshot as product_name',
        'oi.sku_snapshot as sku',
        'oi.quantity',
        'oi.line_total',
        // Order info
        'o.id as order_id',
        'o.order_number',
        // Seller info
        'sp.business_name as seller_name',
        // Product image (live, from products table)
        'pi.url as image_url',
      );

    // Parse evidence_urls jsonb and extract customer note
    return returns.map((r: any) => {
      let customerNote = null;
      try {
        const parsed = typeof r.evidence_urls === 'string'
          ? JSON.parse(r.evidence_urls)
          : r.evidence_urls;
        customerNote = parsed?.note ?? null;
      } catch { /* ignore */ }
      return { ...r, customer_note: customerNote };
    });
  },

  async getSellerReturns(sellerId: string, status?: string) {
    let q = db('returns as r')
      .join('order_items as oi', 'oi.id', 'r.order_item_id')
      .join('orders as o',       'o.id',  'oi.order_id')
      .join('users as u',        'u.id',  'r.customer_id')
      .leftJoin('product_variants as pv', 'pv.id', 'oi.variant_id')
      .leftJoin('products as p',          'p.id',  'pv.product_id')
      .leftJoin('product_images as pi', function(this: any) {
        this.on('pi.product_id', 'p.id').andOn('pi.is_primary', db.raw('true'));
      })
      .where('r.seller_id', sellerId);

    if (status) q = q.where('r.status', status);

    return q.orderBy('r.created_at', 'desc').select(
      'r.id', 'r.status', 'r.reason', 'r.evidence_urls',
      'r.resolution', 'r.refund_amount', 'r.seller_note', 'r.created_at', 'r.resolved_at',
      'oi.id as order_item_id',
      'oi.product_name_snapshot as product_name',
      'oi.sku_snapshot as sku',
      'oi.quantity', 'oi.line_total',
      'o.id as order_id', 'o.order_number',
      'u.first_name', 'u.last_name', 'u.email',
      'pi.url as image_url',
    );
  },
};

// =============================================================================
// CART SERVICE
// Flash sale prices are injected here so every cart response is accurate.
// The frontend never needs to separately check flash sales — it's done here.
// =============================================================================
export const cartService = {
  async getCart(userId: string) {
    const items = await db('cart_items as ci')
      .join('product_variants as pv', 'pv.id', 'ci.variant_id')
      .join('products as p', 'p.id', 'pv.product_id')
      .leftJoin('product_images as pi', (builder: Knex.JoinClause) => {
        builder.on('pi.product_id', 'p.id').andOn('pi.is_primary', db.raw('true'));
      })
      .join('seller_profiles as sp', 'sp.id', 'p.seller_id')
      .where('ci.user_id', userId)
      .where('p.status', 'active')
      .where('pv.is_active', true)
      .select(
        'ci.id', 'ci.quantity', 'ci.variant_id',
        'pv.sku', 'pv.price', 'pv.discount_price',
        'pv.stock_qty', 'pv.weight_kg',
        'p.id as product_id', 'p.name', 'p.slug', 'p.category_id',
        'sp.business_name as seller_name',
        'pi.url as image_url',
      );

    // ── Inject flash sale prices ──────────────────────────────────────────
    // Fetch all active flash sale items in one query for the variant ids in cart
    const variantIds = items.map((i: any) => i.variant_id);
    let flashMap: Record<string, { sale_price: number; flash_sale_id: string }> = {};

    if (variantIds.length > 0) {
      const now        = new Date();
      const flashItems = await db('flash_sale_items as fsi')
        .join('flash_sales as fs', 'fs.id', 'fsi.flash_sale_id')
        .whereIn('fsi.variant_id', variantIds)
        .where('fs.is_active', true)
        .where('fs.starts_at', '<=', now)
        .where('fs.ends_at', '>=', now)
        .select('fsi.variant_id', 'fsi.sale_price', 'fsi.flash_sale_id');

      for (const fi of flashItems) {
        flashMap[fi.variant_id] = { sale_price: Number(fi.sale_price), flash_sale_id: fi.flash_sale_id };
      }
    }

    // Build enriched items with effective price
    const enrichedItems = items.map((item: any) => {
      const flash          = flashMap[item.variant_id];
      const regular_price  = Number(item.discount_price || item.price);
      const flash_price    = flash?.sale_price ?? null;
      // Flash sale price wins over everything else
      const effective_price = flash_price !== null ? flash_price : regular_price;

      return {
        ...item,
        price:           Number(item.price),
        discount_price:  item.discount_price ? Number(item.discount_price) : null,
        flash_sale_price: flash_price,
        is_flash_sale:   flash_price !== null,
        effective_price,
        line_total:      effective_price * item.quantity,
      };
    });

    const subtotal    = enrichedItems.reduce((s: number, i: any) => s + i.line_total, 0);
    const has_flash   = enrichedItems.some((i: any) => i.is_flash_sale);

    return {
      items:      enrichedItems,
      subtotal,
      item_count: enrichedItems.length,
      has_flash_items: has_flash,
      // Pass category_ids and product_ids for discount code scope validation
      category_ids: [...new Set(enrichedItems.map((i: any) => i.category_id).filter(Boolean))],
      product_ids:  [...new Set(enrichedItems.map((i: any) => i.product_id).filter(Boolean))],
    };
  },

  async addItem(userId: string, variantId: string, quantity: number) {
    const variant = await db('product_variants as pv')
      .join('products as p', 'p.id', 'pv.product_id')
      .where('pv.id', variantId)
      .where('p.status', 'active')
      .where('pv.is_active', true)
      .select('pv.*')
      .first();
    if (!variant) throw AppError.notFound('Product variant not found or unavailable');
    if (variant.stock_qty < quantity) throw AppError.badRequest(`Only ${variant.stock_qty} units available`);

    const [item] = await db('cart_items')
      .insert({ id: uuidv4(), user_id: userId, variant_id: variantId, quantity })
      .onConflict(['user_id', 'variant_id'])
      .merge({ quantity: db.raw('cart_items.quantity + ?', [quantity]) })
      .returning('*');
    return item;
  },

  async updateQty(userId: string, itemId: string, quantity: number) {
    if (quantity <= 0) return this.removeItem(userId, itemId);
    const [item] = await db('cart_items')
      .where({ id: itemId, user_id: userId })
      .update({ quantity })
      .returning('*');
    if (!item) throw AppError.notFound('Cart item not found');
    return item;
  },

  async removeItem(userId: string, itemId: string) {
    await db('cart_items').where({ id: itemId, user_id: userId }).delete();
    return { removed: true };
  },

  async clearCart(userId: string) {
    await db('cart_items').where('user_id', userId).delete();
    return { cleared: true };
  },
};

// =============================================================================
// WISHLIST SERVICE
// =============================================================================
export const wishlistService = {
  async getWishlist(userId: string) {
    return db('wishlists as w')
      .join('products as p', 'p.id', 'w.product_id')
      .join('product_variants as pv', (builder: Knex.JoinClause) => {
        builder.on('pv.product_id', 'p.id').andOn('pv.is_default', db.raw('true'));
      })
      .leftJoin('product_images as pi', (builder: Knex.JoinClause) => {
        builder.on('pi.product_id', 'p.id').andOn('pi.is_primary', db.raw('true'));
      })
      .where('w.user_id', userId)
      .where('p.status', 'active')
      .select(
        'w.id', 'w.added_at',
        'p.id as product_id', 'p.name', 'p.slug', 'p.avg_rating',
        'pv.price', 'pv.discount_price',
        'pi.url as image_url',
      );
  },

  async addItem(userId: string, productId: string) {
    const product = await db('products').where({ id: productId, status: 'active' }).first();
    if (!product) throw AppError.notFound('Product not found');
    const [item] = await db('wishlists')
      .insert({ id: uuidv4(), user_id: userId, product_id: productId })
      .onConflict(['user_id', 'product_id']).ignore()
      .returning('*');
    return item;
  },

  async removeItem(userId: string, productId: string) {
    await db('wishlists').where({ user_id: userId, product_id: productId }).delete();
    return { removed: true };
  },

  async moveToCart(userId: string, productId: string) {
    const variant = await db('product_variants')
      .where({ product_id: productId, is_default: true, is_active: true })
      .first();
    if (!variant)             throw AppError.notFound('Default variant not found');
    if (variant.stock_qty < 1) throw AppError.badRequest('Product is out of stock');

    await db.transaction(async (trx: Knex.Transaction) => {
      await trx('wishlists').where({ user_id: userId, product_id: productId }).delete();
      await trx('cart_items')
        .insert({ id: uuidv4(), user_id: userId, variant_id: variant.id, quantity: 1 })
        .onConflict(['user_id', 'variant_id'])
        .merge({ quantity: db.raw('cart_items.quantity + 1') });
    });
    return { moved: true };
  },
};

// =============================================================================
// SEARCH SERVICE
// =============================================================================
export const searchService = {
  async search(q: string, userId?: string, ip?: string) {
    const results = await db('products as p')
      .join('product_variants as pv', (builder: Knex.JoinClause) => {
        builder.on('pv.product_id', 'p.id').andOn('pv.is_default', db.raw('true'));
      })
      .leftJoin('product_images as pi', (builder: Knex.JoinClause) => {
        builder.on('pi.product_id', 'p.id').andOn('pi.is_primary', db.raw('true'));
      })
      .where('p.status', 'active')
      .where((builder: Knex.QueryBuilder) => {
        builder
          .whereRaw('p.name ILIKE ?', [`%${q}%`])
          .orWhereRaw('pv.sku ILIKE ?', [`%${q}%`])
          .orWhereExists(
            db('product_tags').whereRaw('product_id = p.id').whereRaw('tag ILIKE ?', [`%${q}%`])
          );
      })
      .select('p.id', 'p.name', 'p.slug', 'p.avg_rating', 'pv.price', 'pv.discount_price', 'pv.sku', 'pi.url as image')
      .limit(30);

    db('search_logs').insert({
      id: uuidv4(), user_id: userId || null, query: q, results_count: results.length, ip_address: ip || null,
    }).catch(() => { });

    return results;
  },

  async suggest(q: string) {
    const rows = await db('search_logs')
      .whereRaw('query ILIKE ?', [`${q}%`])
      .where('results_count', '>', 0)
      .groupBy('query')
      .orderByRaw('COUNT(*) DESC')
      .select('query')
      .limit(8);
    return rows.map((r: any) => r.query);
  },
};

// =============================================================================
// WALLET SERVICE
// =============================================================================
// =============================================================================
// WALLET SERVICE — replace the entire walletService export in shared.services.ts
// =============================================================================
// =============================================================================
// WALLET SERVICE — replace the entire walletService export in shared.services.ts
// =============================================================================
// =============================================================================
// REPLACE the entire walletService export in src/modules/shared.services.ts
// =============================================================================
export const walletService = {

  async getWalletSummary(sellerId: string) {
    const profile = await db('seller_profiles')
      .where('id', sellerId)
      .select('wallet_balance', 'pending_balance', 'total_earned')
      .first();

    // wallet_transactions.created_at EXISTS ✓ — safe to order by it
    const transactions = await db('wallet_transactions')
      .where('seller_id', sellerId)
      .orderBy('created_at', 'desc')
      .limit(30);

    // withdrawal_requests has 'requested_at' NOT 'created_at'
    const pendingWithdrawals = await db('withdrawal_requests')
      .where({ seller_id: sellerId, status: 'pending' })
      .orderBy('requested_at', 'desc');

    return {
      wallet_balance:      Number(profile?.wallet_balance  ?? 0),
      pending_balance:     Number(profile?.pending_balance ?? 0),
      total_earned:        Number(profile?.total_earned    ?? 0),
      transactions,
      pending_withdrawals: pendingWithdrawals,
    };
  },

  async requestWithdrawal(sellerId: string, data: {
    amount:         number;
    bank_name:      string;
    account_number: string;
    account_name:   string;
  }) {
    const profile = await db('seller_profiles').where('id', sellerId).first();
    if (!profile) throw AppError.notFound('Seller not found');

    const amount = Number(data.amount);
    if (amount <= 0)                              throw AppError.badRequest('Withdrawal amount must be positive');
    if (amount < 100)                             throw AppError.badRequest('Minimum withdrawal amount is ETB 100');
    if (Number(profile.wallet_balance) < amount)  throw AppError.badRequest(
      `Insufficient balance. Available: ETB ${Number(profile.wallet_balance).toFixed(2)}`
    );
    if (!data.bank_name || !data.account_number || !data.account_name) {
      throw AppError.badRequest('Bank name, account number and account name are required');
    }

    // Block if a pending withdrawal already exists
    const existing = await db('withdrawal_requests')
      .where({ seller_id: sellerId, status: 'pending' })
      .first();
    if (existing) {
      throw AppError.badRequest(
        'You already have a pending withdrawal request. Please wait for it to be processed.'
      );
    }

    return db.transaction(async (trx) => {
      // 1. Move money: wallet_balance → pending_balance atomically
      await trx('seller_profiles').where('id', sellerId).update({
        wallet_balance:  db.raw('wallet_balance - ?',  [amount]),
        pending_balance: db.raw('pending_balance + ?', [amount]),
      });

      // 2. Create withdrawal request
      // NOTE: withdrawal_requests has NO 'created_at' — uses 'requested_at' (has DB default)
      const [request] = await trx('withdrawal_requests').insert({
        id:             uuidv4(),
        seller_id:      sellerId,
        amount,
        bank_name:      data.bank_name.trim(),
        account_number: data.account_number.trim(),
        account_name:   data.account_name.trim(),
        status:         'pending',
        // requested_at has a DB default — do NOT insert it manually
      }).returning('*');

      return request;
    });
  },

  async getWithdrawalHistory(sellerId: string) {
    // withdrawal_requests uses 'requested_at' NOT 'created_at'
    return db('withdrawal_requests')
      .where('seller_id', sellerId)
      .orderBy('requested_at', 'desc');
  },
};