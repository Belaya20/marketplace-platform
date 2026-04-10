// src/modules/returns/returns.service.ts
// Req 3.8: Return request submission, approval workflow, status tracking
import { v4 as uuidv4 } from 'uuid';
import db from '../../config/database';
import { AppError } from '../../utils/response';
import { notificationService } from '../notifications/notification.service';

export const returnService = {
  async submitReturn(customerId: string, data: {
    order_item_id: string; reason: string; evidence_urls?: string[];
  }) {
    const item = await db('order_items as oi')
      .join('orders as o', 'o.id', 'oi.order_id')
      .where('oi.id', data.order_item_id)
      .where('o.customer_id', customerId)
      .where('oi.status', 'delivered')
      .select('oi.*', 'o.customer_id')
      .first();

    if (!item) throw AppError.badRequest('Item not found or not eligible for return');

    const existing = await db('returns').where('order_item_id', data.order_item_id).first();
    if (existing) throw AppError.conflict('Return already submitted for this item');

    const [ret] = await db('returns').insert({
      id:            uuidv4(),
      order_item_id: data.order_item_id,
      customer_id:   customerId,
      seller_id:     item.seller_id,
      reason:        data.reason,
      evidence_urls: JSON.stringify(data.evidence_urls || []),
      status:        'requested',
    }).returning('*');

    await notificationService.notifyReturnUpdate(ret.id);
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
      resolved_at:   ['approved','rejected','completed'].includes(status) ? new Date() : null,
    }).returning('*');

    await notificationService.notifyReturnUpdate(returnId);
    return updated;
  },

  async getCustomerReturns(customerId: string) {
    return db('returns').where('customer_id', customerId).orderBy('created_at', 'desc');
  },

  async getSellerReturns(sellerId: string, status?: string) {
    let q = db('returns').where('seller_id', sellerId);
    if (status) q = q.where('status', status);
    return q.orderBy('created_at', 'desc');
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// src/modules/cart/cart.service.ts
// Req 3.2.4: Add to cart, Update quantity, Remove item, View cart summary,
//            Calculate shipping cost
import { db as cartDb } from '../../config/database';
const db2 = cartDb;

export const cartService = {
  async getCart(userId: string) {
    const items = await db2('cart_items as ci')
      .join('product_variants as pv', 'pv.id', 'ci.variant_id')
      .join('products as p',           'p.id', 'pv.product_id')
      .leftJoin('product_images as pi', function() {
        this.on('pi.product_id', 'p.id').andOn('pi.is_primary', db2.raw('true'));
      })
      .join('seller_profiles as sp', 'sp.id', 'p.seller_id')
      .where('ci.user_id', userId)
      .where('p.status', 'active')
      .where('pv.is_active', true)
      .select(
        'ci.id', 'ci.quantity', 'ci.variant_id',
        'pv.sku', 'pv.price', 'pv.discount_price',
        'pv.stock_qty', 'pv.weight_kg',
        'p.id as product_id', 'p.name', 'p.slug',
        'sp.business_name as seller_name',
        'pi.url as image_url'
      );

    const subtotal = items.reduce((sum: number, i: any) => {
      return sum + ((i.discount_price || i.price) * i.quantity);
    }, 0);

    return { items, subtotal, item_count: items.length };
  },

  async addItem(userId: string, variantId: string, quantity: number) {
    const variant = await db2('product_variants as pv')
      .join('products as p', 'p.id', 'pv.product_id')
      .where('pv.id', variantId)
      .where('p.status', 'active')
      .where('pv.is_active', true)
      .select('pv.*')
      .first();

    if (!variant) throw AppError.notFound('Product variant not found or unavailable');
    if (variant.stock_qty < quantity) {
      throw AppError.badRequest(`Only ${variant.stock_qty} units available`);
    }

    const [item] = await db2('cart_items')
      .insert({ id: uuidv4(), user_id: userId, variant_id: variantId, quantity })
      .onConflict(['user_id', 'variant_id'])
      .merge({ quantity: db2.raw('cart_items.quantity + ?', [quantity]) })
      .returning('*');

    return item;
  },

  async updateQty(userId: string, itemId: string, quantity: number) {
    if (quantity <= 0) return this.removeItem(userId, itemId);
    const [item] = await db2('cart_items')
      .where({ id: itemId, user_id: userId })
      .update({ quantity })
      .returning('*');
    if (!item) throw AppError.notFound('Cart item not found');
    return item;
  },

  async removeItem(userId: string, itemId: string) {
    await db2('cart_items').where({ id: itemId, user_id: userId }).delete();
    return { removed: true };
  },

  async clearCart(userId: string) {
    await db2('cart_items').where('user_id', userId).delete();
    return { cleared: true };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// src/modules/wishlist/wishlist.service.ts
// Req 3.2.8: Add product to wishlist, Remove product, Move to cart
export const wishlistService = {
  async getWishlist(userId: string) {
    return db2('wishlists as w')
      .join('products as p', 'p.id', 'w.product_id')
      .join('product_variants as pv', function() {
        this.on('pv.product_id', 'p.id').andOn('pv.is_default', db2.raw('true'));
      })
      .leftJoin('product_images as pi', function() {
        this.on('pi.product_id', 'p.id').andOn('pi.is_primary', db2.raw('true'));
      })
      .where('w.user_id', userId)
      .where('p.status', 'active')
      .select('w.id', 'w.added_at', 'p.id as product_id', 'p.name', 'p.slug',
              'p.avg_rating', 'pv.price', 'pv.discount_price', 'pi.url as image_url');
  },

  async addItem(userId: string, productId: string) {
    const product = await db2('products').where({ id: productId, status: 'active' }).first();
    if (!product) throw AppError.notFound('Product not found');

    const [item] = await db2('wishlists')
      .insert({ id: uuidv4(), user_id: userId, product_id: productId })
      .onConflict(['user_id', 'product_id']).ignore()
      .returning('*');
    return item;
  },

  async removeItem(userId: string, productId: string) {
    await db2('wishlists').where({ user_id: userId, product_id: productId }).delete();
    return { removed: true };
  },

  async moveToCart(userId: string, productId: string) {
    const variant = await db2('product_variants')
      .where({ product_id: productId, is_default: true, is_active: true })
      .first();
    if (!variant) throw AppError.notFound('Default variant not found');
    if (variant.stock_qty < 1) throw AppError.badRequest('Product is out of stock');

    await db2.transaction(async (trx) => {
      await trx('wishlists').where({ user_id: userId, product_id: productId }).delete();
      await trx('cart_items')
        .insert({ id: uuidv4(), user_id: userId, variant_id: variant.id, quantity: 1 })
        .onConflict(['user_id', 'variant_id'])
        .merge({ quantity: db2.raw('cart_items.quantity + 1') });
    });

    return { moved: true };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// src/modules/search/search.service.ts
// Req 3.6: Keyword search, Auto-suggestion, Search by SKU, Advanced filters
export const searchService = {
  async search(q: string, userId?: string, ip?: string) {
    const results = await db2('products as p')
      .join('product_variants as pv', function() {
        this.on('pv.product_id', 'p.id').andOn('pv.is_default', db2.raw('true'));
      })
      .leftJoin('product_images as pi', function() {
        this.on('pi.product_id', 'p.id').andOn('pi.is_primary', db2.raw('true'));
      })
      .where('p.status', 'active')
      .where(function() {
        this.whereRaw(`p.name ILIKE ?`, [`%${q}%`])
            .orWhereRaw(`pv.sku ILIKE ?`, [`%${q}%`])
            .orWhereExists(
              db2('product_tags').whereRaw('product_id = p.id').whereRaw(`tag ILIKE ?`, [`%${q}%`])
            );
      })
      .select('p.id','p.name','p.slug','p.avg_rating','pv.price','pv.discount_price','pv.sku','pi.url as image')
      .limit(30);

    // Log search for autocomplete suggestions
    await db2('search_logs').insert({
      id: uuidv4(), user_id: userId || null,
      query: q, results_count: results.length, ip_address: ip || null,
    }).catch(() => {}); // Fire-and-forget

    return results;
  },

  // Req 3.6: Auto-suggestion (top recent queries matching prefix)
  async suggest(q: string) {
    const suggestions = await db2('search_logs')
      .whereRaw(`query ILIKE ?`, [`${q}%`])
      .where('results_count', '>', 0)
      .groupBy('query')
      .orderByRaw('COUNT(*) DESC')
      .select('query')
      .limit(8);

    return suggestions.map((s: any) => s.query);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// src/modules/wallet/wallet.service.ts
// Req 3.3.5: View earnings, Pending balance, Withdraw request, Withdrawal history
export const walletService = {
  async getWalletSummary(sellerId: string) {
    const profile = await db2('seller_profiles')
      .where('id', sellerId)
      .select('wallet_balance','pending_balance','total_earned')
      .first();

    const transactions = await db2('wallet_transactions')
      .where('seller_id', sellerId)
      .orderBy('created_at', 'desc')
      .limit(20);

    return { ...profile, transactions };
  },

  async requestWithdrawal(sellerId: string, data: {
    amount: number; bank_name: string; account_number: string; account_name: string;
  }) {
    const profile = await db2('seller_profiles').where('id', sellerId).first();
    if (!profile) throw AppError.notFound('Seller not found');
    if (profile.wallet_balance < data.amount) {
      throw AppError.badRequest('Insufficient wallet balance');
    }
    if (data.amount <= 0) throw AppError.badRequest('Withdrawal amount must be positive');

    const [request] = await db2('withdrawal_requests').insert({
      id: uuidv4(), seller_id: sellerId,
      amount:         data.amount,
      bank_name:      data.bank_name,
      account_number: data.account_number,
      account_name:   data.account_name,
      status:         'pending',
    }).returning('*');

    return request;
  },

  async getWithdrawalHistory(sellerId: string) {
    return db2('withdrawal_requests')
      .where('seller_id', sellerId)
      .orderBy('requested_at', 'desc');
  },
};