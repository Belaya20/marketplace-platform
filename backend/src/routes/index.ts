// backend/src/routes/index.ts
import express, { Router, IRouter, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/database';
import {
  authenticate, requireCustomer, requireSeller,
  requireAdmin, requireSellerProfile,
} from '../middleware';
import { success, created, paginated, AppError } from '../utils/response';

import authRouter              from '../modules/auth/auth.controller';
import sellerRouter            from './seller.routes';
import { productService }      from '../modules/products/products.service';
import { orderService }        from '../modules/orders/orders.service';
import { chapaService }        from '../modules/payments/chapa.service';
import { adminService }        from '../modules/admin/admin.service';
import { notificationService } from '../modules/notifications/notification.service';
import {
  cartService, wishlistService, returnService,
  searchService, walletService,
} from '../modules/shared.services';

const router: IRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────
function toCount(r: any): number { return Number(r?.total ?? r?.count ?? 0); }
function parsePage(v: any): number { return Math.max(1, Number(String(v || '1')) || 1); }
function fmtETB(amount: number): string {
  return new Intl.NumberFormat('en-ET', {
    style: 'currency', currency: 'ETB',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(amount);
}

 // AUTH
 router.use('/auth', authRouter);

// ═══════════════════════════════════════════════════════════════════════════
// SELLER (profile, inventory, wallet, dashboard, discounts, flash-sale join)
// ═══════════════════════════════════════════════════════════════════════════
router.use('/seller', sellerRouter);

// ═══════════════════════════════════════════════════════════════════════════
// USER PROFILE
// ═══════════════════════════════════════════════════════════════════════════
router.get('/users/me', authenticate, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const u = await db('users').where('id', req.user.userId)
      .select('id', 'email', 'phone', 'role', 'first_name', 'last_name',
        'profile_image_url', 'email_verified', 'created_at').first();
    if (!u) throw AppError.notFound('User not found');
    success(res, u);
  } catch (e) { next(e); }
});

router.put('/users/me', authenticate, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const allowed = ['first_name', 'last_name', 'phone', 'profile_image_url'];
    const data: any = {};
    for (const k of allowed) if (req.body[k] !== undefined) data[k] = req.body[k];
    const [u] = await db('users').where('id', req.user.userId).update(data)
      .returning(['id', 'email', 'first_name', 'last_name', 'phone', 'profile_image_url']);
    success(res, u, 'Profile updated');
  } catch (e) { next(e); }
});

router.put('/users/me/password', authenticate, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const bcrypt = await import('bcryptjs');
    const user   = await db('users').where('id', req.user.userId).first();
    const ok     = await bcrypt.default.compare(req.body.current_password, user.password_hash);
    if (!ok) throw AppError.badRequest('Current password is incorrect');
    const hash = await bcrypt.default.hash(req.body.new_password, 12);
    await db('users').where('id', req.user.userId).update({ password_hash: hash });
    success(res, null, 'Password changed');
  } catch (e) { next(e); }
});

router.get('/users/me/addresses', authenticate, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    success(res, await db('user_addresses').where('user_id', req.user.userId).orderBy('is_default', 'desc'));
  } catch (e) { next(e); }
});

router.post('/users/me/addresses', authenticate, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
     const allowed = [
      'full_name', 'phone', 'street_address', 'city',
      'region', 'country', 'postal_code', 'is_default',
    ];
    const data: any = { id: uuidv4(), user_id: req.user.userId };
    for (const k of allowed) if (req.body[k] !== undefined) data[k] = req.body[k];

     if (data.is_default) {
      await db('user_addresses').where('user_id', req.user.userId).update({ is_default: false });
    }
    const [a] = await db('user_addresses').insert(data).returning('*');
    created(res, a, 'Address added');
  } catch (e) { next(e); }
});

router.put('/users/me/addresses/:id', authenticate, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const allowed = ['full_name', 'phone', 'street_address', 'city', 'region', 'country', 'postal_code', 'is_default'];
    const data: any = {};
    for (const k of allowed) if (req.body[k] !== undefined) data[k] = req.body[k];
    if (data.is_default) {
      await db('user_addresses').where('user_id', req.user.userId).update({ is_default: false });
    }
    const [a] = await db('user_addresses').where({ id: req.params.id, user_id: req.user.userId }).update(data).returning('*');
    if (!a) throw AppError.notFound('Address not found');
    success(res, a);
  } catch (e) { next(e); }
});

router.delete('/users/me/addresses/:id', authenticate, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    await db('user_addresses').where({ id: req.params.id, user_id: req.user.userId }).delete();
    success(res, null, 'Address removed');
  } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════
router.get('/categories', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    const cats = await db('categories').where('is_active', true).orderBy('sort_order');
    const map: any = {};
    cats.forEach((c: any) => { map[c.id] = { ...c, children: [] }; });
    const tree: any[] = [];
    cats.forEach((c: any) => {
      if (c.parent_id && map[c.parent_id]) map[c.parent_id].children.push(map[c.id]);
      else tree.push(map[c.id]);
    });
    success(res, tree);
  } catch (e) { next(e); }
});

router.get('/categories/:slug', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    const cat = await db('categories').where('slug', req.params.slug).first();
    if (!cat) throw AppError.notFound('Category not found');
    const children = await db('categories').where({ parent_id: cat.id, is_active: true });
    success(res, { ...cat, children });
  } catch (e) { next(e); }
});

router.post('/admin/categories', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.body.name) throw AppError.badRequest('name is required');
    const slug = req.body.slug || req.body.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const [c]  = await db('categories').insert({ id: uuidv4(), ...req.body, slug }).returning('*');
    created(res, c);
  } catch (e) { next(e); }
});

router.put('/admin/categories/:id', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [c] = await db('categories').where('id', req.params.id).update(req.body).returning('*');
    if (!c) throw AppError.notFound('Category not found');
    success(res, c);
  } catch (e) { next(e); }
});

router.delete('/admin/categories/:id', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    await db('categories').where('id', req.params.id).update({ is_active: false });
    success(res, null, 'Category deactivated');
  } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════════════════
// BRANDS
// ═══════════════════════════════════════════════════════════════════════════
router.get('/brands', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    success(res, await db('brands').where('is_active', true).orderBy('name'));
  } catch (e) { next(e); }
});

router.post('/admin/brands', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.body.name) throw AppError.badRequest('name is required');
    const [b] = await db('brands').insert({ id: uuidv4(), ...req.body }).returning('*');
    created(res, b);
  } catch (e) { next(e); }
});

router.put('/admin/brands/:id', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [b] = await db('brands').where('id', req.params.id).update(req.body).returning('*');
    if (!b) throw AppError.notFound('Brand not found');
    success(res, b);
  } catch (e) { next(e); }
});

router.delete('/admin/brands/:id', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    await db('brands').where('id', req.params.id).update({ is_active: false });
    success(res, null, 'Brand deactivated');
  } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════════════════
// ATTRIBUTES
// ═══════════════════════════════════════════════════════════════════════════
router.get('/attributes', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.set('Cache-Control', 'public, max-age=300, s-maxage=600');

    // Single JOIN instead of N+1 loop
    const rows = await db('product_attributes as pa')
      .leftJoin('attribute_values as av', function(this: any) {
        this.on('av.attribute_id', 'pa.id').andOn('av.is_active', db.raw('true'));
      })
      .where('pa.is_active', true)
      .orderBy(['pa.sort_order', 'av.sort_order'])
      .select(
        'pa.id as attr_id', 'pa.name', 'pa.display_name', 'pa.sort_order as attr_sort',
        'av.id as val_id', 'av.value', 'av.display_value', 'av.color_hex', 'av.sort_order as val_sort',
      );

    const attrMap = new Map<string, any>();
    for (const row of rows) {
      if (!attrMap.has(row.attr_id)) {
        attrMap.set(row.attr_id, {
          id: row.attr_id, name: row.name, display_name: row.display_name,
          sort_order: row.attr_sort, is_active: true, values: [],
        });
      }
      if (row.val_id) {
        attrMap.get(row.attr_id).values.push({
          id: row.val_id, attribute_id: row.attr_id, value: row.value,
          display_value: row.display_value, color_hex: row.color_hex,
          sort_order: row.val_sort, is_active: true,
        });
      }
    }
    success(res, Array.from(attrMap.values()));
  } catch (e) { next(e); }
});

router.post('/admin/attributes', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, display_name, sort_order = 0 } = req.body;
    if (!name || !display_name) throw AppError.badRequest('name and display_name are required');
    const [attr] = await db('product_attributes').insert({
      id: uuidv4(), name: name.toLowerCase().trim(),
      display_name: display_name.trim(), sort_order: Number(sort_order), is_active: true,
    }).returning('*');
    attr.values = [];
    created(res, attr, 'Attribute created');
  } catch (e) { next(e); }
});

router.put('/admin/attributes/:id', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const allowed = ['display_name', 'sort_order', 'is_active'];
    const data: any = {};
    for (const k of allowed) if (req.body[k] !== undefined) data[k] = req.body[k];
    const [attr] = await db('product_attributes').where('id', req.params.id).update(data).returning('*');
    if (!attr) throw AppError.notFound('Attribute not found');
    success(res, attr);
  } catch (e) { next(e); }
});

router.delete('/admin/attributes/:id', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    await db('product_attributes').where('id', req.params.id).update({ is_active: false });
    success(res, null, 'Attribute deactivated');
  } catch (e) { next(e); }
});

router.post('/admin/attributes/:id/values', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { value, display_value, color_hex, sort_order = 0 } = req.body;
    if (!value || !display_value) throw AppError.badRequest('value and display_value are required');
    const [val] = await db('attribute_values').insert({
      id: uuidv4(), attribute_id: req.params.id,
      value: value.toLowerCase().trim(), display_value: display_value.trim(),
      color_hex: color_hex || null, sort_order: Number(sort_order), is_active: true,
    }).returning('*');
    created(res, val, 'Attribute value added');
  } catch (e) { next(e); }
});

router.put('/admin/attributes/:id/values/:valueId', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [val] = await db('attribute_values')
      .where({ id: req.params.valueId, attribute_id: req.params.id })
      .update({
        display_value: req.body.display_value,
        color_hex:     req.body.color_hex ?? null,
        sort_order:    req.body.sort_order ?? 0,
      }).returning('*');
    if (!val) throw AppError.notFound('Value not found');
    success(res, val);
  } catch (e) { next(e); }
});

router.delete('/admin/attributes/:id/values/:valueId', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    await db('attribute_values')
      .where({ id: req.params.valueId, attribute_id: req.params.id })
      .update({ is_active: false });
    success(res, null, 'Value removed');
  } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCTS
// ═══════════════════════════════════════════════════════════════════════════
router.get('/products', async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page  = parsePage(req.query.page);
    const limit = Number(String(req.query.limit || '20')) || 20;
    const { page: _p, limit: _l, ...rest } = req.query;
    const result = await productService.searchProducts({ ...rest, page, limit });
    paginated(res, result.data, result.total, page, limit);
  } catch (e) { next(e); }
});

router.get('/products/:slug', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try { success(res, await productService.getProductBySlug(req.params.slug)); } catch (e) { next(e); }
});

 router.get('/admin/products', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page   = parsePage(req.query.page);
    const limit  = 20;
    const status = req.query.status ? String(req.query.status) : null;
    const q      = req.query.q      ? String(req.query.q)      : null;
    const seller = req.query.seller ? String(req.query.seller) : null;

    let query = db('products as p')
      .leftJoin('seller_profiles as sp', 'sp.id', 'p.seller_id')
      .leftJoin('categories as c',       'c.id',  'p.category_id')
      .leftJoin('brands as b',           'b.id',  'p.brand_id');

    if (status) query = query.where('p.status', status);
    if (seller) query = query.where('p.seller_id', seller);
    if (q)      query = query.whereILike('p.name', `%${q}%`);

    const [cntResult, products] = await Promise.all([
      query.clone().count('p.id as total').first(),
      query.clone()
        .orderBy('p.created_at', 'desc')
        .limit(limit).offset((page - 1) * limit)
        .select(
          'p.id', 'p.name', 'p.slug', 'p.status', 'p.is_featured',
          'p.avg_rating', 'p.review_count', 'p.total_sold',
          'p.created_at', 'p.updated_at',
          'sp.business_name as seller_name', 'sp.id as seller_id',
          'c.name as category_name',
          'b.name as brand_name',
        ),
    ]);

    paginated(res, products, toCount(cntResult), page, limit);
  } catch (e) { next(e); }
});

router.get('/seller/products', authenticate, requireSeller, requireSellerProfile, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page   = parsePage(req.query.page);
    const limit  = Number(String(req.query.limit || '20')) || 20;
    const status = req.query.status ? String(req.query.status) : null;

    let q = db('products').where('seller_id', req.user.sellerId);
    if (status) q = q.where('status', status);

    const [cntResult, products] = await Promise.all([
      q.clone().count('id as total').first(),
      q.clone().orderBy('created_at', 'desc').limit(limit).offset((page - 1) * limit),
    ]);
    paginated(res, products, toCount(cntResult), page, limit);
  } catch (e) { next(e); }
});

router.post('/seller/products', authenticate, requireSeller, requireSellerProfile, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    created(res, await productService.createProduct(req.user.sellerId!, req.body), 'Product submitted for review');
  } catch (e) { next(e); }
});

router.put('/seller/products/:id', authenticate, requireSeller, requireSellerProfile, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try { success(res, await productService.updateProduct(req.params.id, req.user.sellerId!, req.body)); } catch (e) { next(e); }
});

router.delete('/seller/products/:id', authenticate, requireSeller, requireSellerProfile, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try { success(res, await productService.deleteProduct(req.params.id, req.user.sellerId!)); } catch (e) { next(e); }
});

router.patch('/seller/products/:variantId/stock', authenticate, requireSeller, requireSellerProfile, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    success(res, await productService.updateVariantStock(
      req.params.variantId, req.user.sellerId!, req.body.stock_qty, req.body.note,
    ));
  } catch (e) { next(e); }
});

router.patch('/admin/products/:id/approve', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    success(res, await productService.approveProduct(req.params.id, req.user.userId, req.body.approve, req.body.reason));
  } catch (e) { next(e); }
});

router.patch('/admin/products/:id/feature', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try { success(res, await productService.featureProduct(req.params.id, req.body.is_featured)); } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════════════════════════════
router.get('/search', async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const q = String(req.query.q || '');
    if (!q.trim()) throw AppError.badRequest('Search query required');
    success(res, await searchService.search(q, req.user?.userId, req.ip));
  } catch (e) { next(e); }
});

router.get('/search/suggest', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try { success(res, await searchService.suggest(String(req.query.q || ''))); } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════════════════
// CART
// ═══════════════════════════════════════════════════════════════════════════
router.get('/cart', authenticate, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try { success(res, await cartService.getCart(req.user.userId)); } catch (e) { next(e); }
});
router.post('/cart', authenticate, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    created(res, await cartService.addItem(req.user.userId, req.body.variant_id, req.body.quantity || 1));
  } catch (e) { next(e); }
});
router.put('/cart/:id', authenticate, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try { success(res, await cartService.updateQty(req.user.userId, req.params.id, req.body.quantity)); } catch (e) { next(e); }
});
router.delete('/cart/:id', authenticate, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try { success(res, await cartService.removeItem(req.user.userId, req.params.id)); } catch (e) { next(e); }
});
router.delete('/cart', authenticate, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try { success(res, await cartService.clearCart(req.user.userId)); } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════════════════
// WISHLIST
// ═══════════════════════════════════════════════════════════════════════════
router.get('/wishlist', authenticate, requireCustomer, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try { success(res, await wishlistService.getWishlist(req.user.userId)); } catch (e) { next(e); }
});
router.post('/wishlist', authenticate, requireCustomer, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try { created(res, await wishlistService.addItem(req.user.userId, req.body.product_id)); } catch (e) { next(e); }
});
router.delete('/wishlist/:productId', authenticate, requireCustomer, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try { success(res, await wishlistService.removeItem(req.user.userId, req.params.productId)); } catch (e) { next(e); }
});
router.post('/wishlist/:productId/move-to-cart', authenticate, requireCustomer, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try { success(res, await wishlistService.moveToCart(req.user.userId, req.params.productId)); } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════════════════
// ORDERS
// ═══════════════════════════════════════════════════════════════════════════
router.post('/orders', authenticate, requireCustomer, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    created(res, await orderService.placeOrder(req.user.userId, req.body), 'Order placed successfully');
  } catch (e) { next(e); }
});

router.get('/orders', authenticate, requireCustomer, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parsePage(req.query.page);
    const r    = await orderService.getCustomerOrders(req.user.userId, page, 10);
    paginated(res, r.orders, r.total, page, 10);
  } catch (e) { next(e); }
});

router.get('/orders/:id', authenticate, requireCustomer, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try { success(res, await orderService.getOrderDetail(req.params.id, req.user.userId)); } catch (e) { next(e); }
});

router.get('/orders/:id/invoice', authenticate, requireCustomer, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pdf = await orderService.generateInvoice(req.params.id, req.user.userId);
    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${req.params.id}.pdf"`,
    });
    res.send(pdf);
  } catch (e) { next(e); }
});

 router.post('/orders/:id/cancel', authenticate, requireCustomer, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const order = await db('orders')
      .where({ id: req.params.id, customer_id: req.user.userId, status: 'pending' })
      .first();
    if (!order) throw AppError.badRequest('Order cannot be cancelled or does not exist');

    await db.transaction(async (trx) => {
      await trx('orders').where('id', req.params.id).update({ status: 'cancelled' });
      await trx('order_status_history').insert({
        id: uuidv4(), order_id: req.params.id,
        from_status: 'pending', to_status: 'cancelled',
        note: 'Cancelled by customer',
      });
    });

     notificationService.notifyOrderStatusChange(req.params.id, 'cancelled').catch(() => {});

    success(res, null, 'Order cancelled');
  } catch (e) { next(e); }
});

router.post('/orders/:id/reorder', authenticate, requireCustomer, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try { success(res, await orderService.reorder(req.params.id, req.user.userId)); } catch (e) { next(e); }
});

// ── Seller order management ───────────────────────────────────────────────────
router.get('/seller/orders', authenticate, requireSeller, requireSellerProfile, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page   = parsePage(req.query.page);
    const status = req.query.status ? String(req.query.status) : null;
    const r      = await orderService.getSellerOrders(req.user.sellerId!, status, page);
    paginated(res, r.items, r.total, page, 20);
  } catch (e) { next(e); }
});

router.patch('/seller/orders/:itemId/accept', authenticate, requireSeller, requireSellerProfile, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    success(res, await orderService.updateItemStatus(req.params.itemId, req.user.sellerId!, 'accepted'));
  } catch (e) { next(e); }
});

router.patch('/seller/orders/:itemId/reject', authenticate, requireSeller, requireSellerProfile, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    success(res, await orderService.updateItemStatus(req.params.itemId, req.user.sellerId!, 'rejected', req.body.reason));
  } catch (e) { next(e); }
});

router.patch('/seller/orders/:itemId/ship', authenticate, requireSeller, requireSellerProfile, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const item = await db('order_items')
      .where({ id: req.params.itemId, seller_id: req.user.sellerId! }).first();
    if (!item) throw AppError.notFound('Order item not found');
    if (req.body.tracking_number) {
      await db('order_items').where('id', req.params.itemId)
        .update({ tracking_number: req.body.tracking_number });
    }
    success(res, await orderService.updateItemStatus(req.params.itemId, req.user.sellerId!, 'shipped'));
  } catch (e) { next(e); }
});

router.patch('/seller/orders/:itemId/deliver', authenticate, requireSeller, requireSellerProfile, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    success(res, await orderService.updateItemStatus(req.params.itemId, req.user.sellerId!, 'delivered'));
  } catch (e) { next(e); }
});

// ── Admin orders ──────────────────────────────────────────────────────────────
router.get('/admin/orders', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parsePage(req.query.page);
    const r    = await orderService.getAllOrders(req.query, page);
    paginated(res, r.orders, r.total, page, 20);
  } catch (e) { next(e); }
});

router.patch('/admin/orders/:id/status', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try { success(res, await adminService.updateOrderStatus(req.params.id, req.body.status)); } catch (e) { next(e); }
});

router.get('/admin/orders/:id', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const order = await db('orders as o')
      .join('users as u', 'u.id', 'o.customer_id')
      .where('o.id', req.params.id)
      .select('o.*', 'u.email', 'u.first_name', 'u.last_name', 'u.phone')
      .first();
    if (!order) throw AppError.notFound('Order not found');
    order.items = await db('order_items as oi')
      .join('product_variants as pv', 'pv.id', 'oi.variant_id')
      .join('products as p',          'p.id',  'pv.product_id')
      .leftJoin('seller_profiles as sp', 'sp.id', 'oi.seller_id')
      .where('oi.order_id', req.params.id)
      .select('oi.*', 'p.name', 'p.slug', 'pv.sku', 'sp.business_name as seller_name');
    success(res, order);
  } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════════════════
// PAYMENTS
// ═══════════════════════════════════════════════════════════════════════════
router.post('/payments/initiate', authenticate, requireCustomer, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try { created(res, await chapaService.initiatePayment(req.body.order_id, req.user.userId)); } catch (e) { next(e); }
});

router.get('/payments/verify/:txRef', authenticate, requireCustomer, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try { success(res, await chapaService.verifyPayment(req.params.txRef, req.user.userId)); } catch (e) { next(e); }
});

router.post('/payments/webhook/chapa',
  express.raw({ type: 'application/json' }),
  async (req: any, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sig    = String(req.headers['x-chapa-signature'] || '');
      const result = await chapaService.handleWebhook(req.body.toString(), sig);
      res.status(200).json(result);
    } catch (e) { next(e); }
  },
);

router.post('/payments/cod-confirm', authenticate, requireCustomer, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { order_id } = req.body;
    if (!order_id) throw AppError.badRequest('order_id is required');

    const order = await db('orders')
      .where({ id: order_id, customer_id: req.user.userId, payment_method: 'cod' })
      .first();
    if (!order) throw AppError.notFound('COD order not found');

    if (order.status !== 'pending') {
      success(res, order, 'Order already confirmed');
      return;
    }

    await db.transaction(async (trx) => {
      await trx('orders').where('id', order_id).update({ status: 'confirmed' });
      await trx('order_status_history').insert({
        id: uuidv4(), order_id,
        from_status: 'pending', to_status: 'confirmed',
        note: 'Cash on delivery order confirmed by customer',
      });
    });

    notificationService.notifyOrderStatusChange(order_id, 'confirmed').catch(() => {});
    success(res, null, 'Order confirmed');
  } catch (e) { next(e); }
});

router.get('/admin/payments', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parsePage(req.query.page);
    const r    = await adminService.getPaymentLogs(req.query, page);
    paginated(res, r.payments, r.total, page, 20);
  } catch (e) { next(e); }
});

router.get('/admin/payments/chapa/config', authenticate, requireAdmin, async (_req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const secretKey     = process.env.CHAPA_SECRET_KEY     || '';
    const webhookSecret = process.env.CHAPA_WEBHOOK_SECRET || '';
    const frontendUrl   = process.env.FRONTEND_URL          || '';
    const apiBaseUrl    = process.env.API_BASE_URL           || '';

    const isConfigured = !!(secretKey && secretKey !== 'your_chapa_secret_key_here' && secretKey.length > 10);

    success(res, {
      is_configured:      isConfigured,
      mode:               secretKey.startsWith('CHASECK_TEST') ? 'test' : isConfigured ? 'live' : 'unconfigured',
      secret_key_preview: isConfigured
        ? `${secretKey.slice(0, 8)}${'●'.repeat(Math.max(0, secretKey.length - 12))}${secretKey.slice(-4)}`
        : null,
      webhook_configured: !!(webhookSecret && webhookSecret.length > 10),
      webhook_url:        apiBaseUrl ? `${apiBaseUrl}/api/v1/payments/webhook/chapa` : null,
      frontend_url:       frontendUrl || null,
    });
  } catch (e) { next(e); }
});

router.post('/admin/payments/chapa/test', authenticate, requireAdmin, async (_req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const secretKey = process.env.CHAPA_SECRET_KEY || '';
    if (!secretKey || secretKey === 'your_chapa_secret_key_here' || secretKey.length < 10) {
      throw AppError.badRequest('CHAPA_SECRET_KEY is not configured in .env');
    }
    const axios    = await import('axios');
    const response = await axios.default.get('https://api.chapa.co/v1/banks', {
      headers: { Authorization: `Bearer ${secretKey}` },
      timeout: 8000,
    });
    if (response.data?.status === 'success') {
      success(res, { connected: true }, `Chapa connection verified — ${response.data?.data?.length ?? 0} banks available`);
    } else {
      throw AppError.internal('Chapa returned unexpected response');
    }
  } catch (e: any) {
    if (e.statusCode) throw e;
    throw AppError.internal(`Chapa test failed: ${e.response?.data?.message || e.message || 'Connection failed'}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// RETURNS
// ═══════════════════════════════════════════════════════════════════════════
router.get('/returns/eligible', authenticate, requireCustomer, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const delivered = await db('order_items as oi')
      .join('orders as o',             'o.id',  'oi.order_id')
      .join('product_variants as pv',  'pv.id', 'oi.variant_id')
      .join('products as p',           'p.id',  'pv.product_id')
      .leftJoin('product_images as pi', function(this: any) {
        this.on('pi.product_id', 'p.id').andOn('pi.is_primary', db.raw('true'));
      })
      .where('o.customer_id', req.user.userId)
      .where('oi.status', 'delivered')
      .select(
        'oi.id as order_item_id', 'oi.order_id', 'oi.quantity', 'oi.line_total',
        'oi.product_name_snapshot as product_name', 'oi.sku_snapshot as sku',
        'o.order_number', 'pi.url as image_url',
      );

    if (!delivered.length) { success(res, []); return; }

    const existingReturns = await db('returns')
      .where('customer_id', req.user.userId)
      .whereIn('status', ['requested', 'under_review', 'approved', 'completed'])
      .pluck('order_item_id');

    const existingSet = new Set(existingReturns);
    success(res, delivered.filter((i: any) => !existingSet.has(i.order_item_id)));
  } catch (e) { next(e); }
});

router.post('/returns', authenticate, requireCustomer, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try { created(res, await returnService.submitReturn(req.user.userId, req.body)); } catch (e) { next(e); }
});

router.get('/returns/mine', authenticate, requireCustomer, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try { success(res, await returnService.getCustomerReturns(req.user.userId)); } catch (e) { next(e); }
});

router.get('/seller/returns', authenticate, requireSeller, requireSellerProfile, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    success(res, await returnService.getSellerReturns(req.user.sellerId!, status));
  } catch (e) { next(e); }
});

router.patch('/seller/returns/:id', authenticate, requireSeller, requireSellerProfile, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    success(res, await returnService.updateReturnStatus(req.params.id, req.user.sellerId!, req.body.status, req.body));
  } catch (e) { next(e); }
});

router.get('/admin/returns', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page   = parsePage(req.query.page);
    const status = req.query.status ? String(req.query.status) : '';

    let q = db('returns as r')
      .join('users as u',             'u.id',  'r.customer_id')
      .join('order_items as oi',      'oi.id', 'r.order_item_id')
      .join('product_variants as pv', 'pv.id', 'oi.variant_id')
      .join('products as p',          'p.id',  'pv.product_id')
      .select('r.*', 'u.email', 'u.first_name', 'u.last_name', 'p.name as product_name', 'pv.sku');

    if (status) q = q.where('r.status', status);

     let countQ = db('returns as r');
    if (status) countQ = countQ.where('r.status', status);
    const [cntResult, returns] = await Promise.all([
      countQ.count('id as total').first(),
      q.orderBy('r.created_at', 'desc').limit(20).offset((page - 1) * 20),
    ]);

    paginated(res, returns, toCount(cntResult), page, 20);
  } catch (e) { next(e); }
});

router.patch('/admin/returns/:id', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [ret] = await db('returns').where('id', req.params.id)
      .update({ status: req.body.status, admin_note: req.body.note, resolved_at: new Date() })
      .returning('*');
    if (!ret) throw AppError.notFound('Return not found');
    notificationService.notifyReturnUpdate(req.params.id).catch(() => {});
    success(res, ret, 'Return status updated');
  } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════════════════
// REVIEWS
// ═══════════════════════════════════════════════════════════════════════════
router.get('/reviews/pending', authenticate, requireCustomer, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const deliveredItems = await db('order_items as oi')
      .join('orders as o',             'o.id',  'oi.order_id')
      .join('product_variants as pv',  'pv.id', 'oi.variant_id')
      .join('products as p',           'p.id',  'pv.product_id')
      .leftJoin('product_images as pi', function(this: any) {
        this.on('pi.product_id', 'p.id').andOn('pi.is_primary', db.raw('true'));
      })
      .where('o.customer_id', req.user.userId)
      .where('oi.status', 'delivered')
      .select(
        'oi.id as order_item_id', 'oi.order_id', 'oi.quantity', 'oi.unit_price_snapshot',
        'oi.product_name_snapshot as product_name', 'oi.sku_snapshot as sku',
        'p.id as product_id', 'p.slug as product_slug', 'pi.url as image_url',
      );

    if (!deliveredItems.length) { success(res, []); return; }

    const productIds  = [...new Set(deliveredItems.map((i: any) => i.product_id))];
    const reviewed    = await db('reviews')
      .where('user_id', req.user.userId).whereIn('product_id', productIds).pluck('product_id');
    const reviewedSet = new Set(reviewed);

    const pending = deliveredItems.filter((i: any) => !reviewedSet.has(i.product_id));
    const seen    = new Set<string>();
    success(res, pending.filter((i: any) => {
      if (seen.has(i.product_id)) return false;
      seen.add(i.product_id); return true;
    }));
  } catch (e) { next(e); }
});

router.get('/reviews/mine', authenticate, requireCustomer, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const reviews = await db('reviews as r')
      .join('products as p', 'p.id', 'r.product_id')
      .leftJoin('product_images as pi', function(this: any) {
        this.on('pi.product_id', 'p.id').andOn('pi.is_primary', db.raw('true'));
      })
      .where('r.user_id', req.user.userId)
      .orderBy('r.created_at', 'desc')
      .select(
        'r.id', 'r.rating', 'r.title', 'r.comment',
        'r.is_approved', 'r.is_verified_purchase', 'r.created_at',
        'p.id as product_id', 'p.name as product_name', 'p.slug as product_slug',
        'pi.url as product_image',
      );
    success(res, reviews);
  } catch (e) { next(e); }
});

router.get('/admin/reviews', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const filter = String(req.query.filter || 'pending');
    let query = db('reviews as r')
      .join('users as u',    'u.id', 'r.user_id')
      .join('products as p', 'p.id', 'r.product_id')
      .select(
        'r.id', 'r.rating', 'r.title', 'r.comment',
        'r.is_approved', 'r.is_reported', 'r.report_reason',
        'r.is_verified_purchase', 'r.created_at',
        'u.first_name', 'u.last_name', 'u.email',
        'p.name as product_name', 'p.slug as product_slug',
      )
      .orderBy('r.created_at', 'desc');

    if (filter === 'pending')  query = query.where('r.is_approved', false).where('r.is_reported', false);
    if (filter === 'approved') query = query.where('r.is_approved', true);
    if (filter === 'reported') query = query.where('r.is_reported', true);
    // 'all' — no additional filter

    success(res, await query);
  } catch (e) { next(e); }
});

router.get('/reviews/product/:productId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const reviews = await db('reviews as r')
      .join('users as u', 'u.id', 'r.user_id')
      .where({ 'r.product_id': req.params.productId, 'r.is_approved': true })
      .orderBy('r.created_at', 'desc')
      .select('r.*', 'u.first_name', 'u.last_name');
    success(res, reviews);
  } catch (e) { next(e); }
});

router.get('/reviews/product/:productId/can-review', authenticate, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const bought = await db('order_items as oi')
      .join('orders as o',            'o.id',  'oi.order_id')
      .join('product_variants as pv', 'pv.id', 'oi.variant_id')
      .where('pv.product_id',   req.params.productId)
      .where('o.customer_id',   req.user.userId)
      .where('oi.status',       'delivered')
      .select('oi.id', 'oi.order_id').first();

    const existing = await db('reviews')
      .where({ product_id: req.params.productId, user_id: req.user.userId }).first();

    success(res, {
      can_review:       !!bought && !existing,
      order_item_id:    bought?.id       ?? null,
      order_id:         bought?.order_id ?? null,
      already_reviewed: !!existing,
    });
  } catch (e) { next(e); }
});

 router.post('/reviews/product/:productId', authenticate, requireCustomer, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const bought = await db('order_items as oi')
      .join('orders as o',            'o.id',  'oi.order_id')
      .join('product_variants as pv', 'pv.id', 'oi.variant_id')
      .where('pv.product_id', req.params.productId)
      .where('o.customer_id', req.user.userId)
      .where('oi.status',     'delivered').first();
    if (!bought) throw AppError.forbidden('You can only review purchased and delivered products');

    const existing = await db('reviews')
      .where({ product_id: req.params.productId, user_id: req.user.userId }).first();
    if (existing) throw AppError.conflict('You have already reviewed this product');

    const rating = Number(req.body.rating);
    if (!rating || rating < 1 || rating > 5) throw AppError.badRequest('Rating must be between 1 and 5');

    const [review] = await db('reviews').insert({
      id:                   uuidv4(),
      product_id:           req.params.productId,
      user_id:              req.user.userId,
      order_id:             req.body.order_id || bought.order_id,
      rating,
      title:                req.body.title   || null,
      comment:              req.body.comment || null,
      is_verified_purchase: true,
       is_approved: false,
    }).returning('*');

    created(res, review, 'Review submitted — it will appear after moderation');
  } catch (e) { next(e); }
});

router.post('/reviews/:id/report', authenticate, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    await db('reviews').where('id', req.params.id)
      .update({ is_reported: true, report_reason: req.body.reason });
    success(res, null, 'Review reported');
  } catch (e) { next(e); }
});

router.patch('/admin/reviews/:id', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [r] = await db('reviews').where('id', req.params.id)
      .update({ is_approved: req.body.approve, is_reported: false }).returning('*');
    if (r) {
      await db.raw(`
        UPDATE products SET
          avg_rating   = (SELECT COALESCE(AVG(rating),0) FROM reviews WHERE product_id = ? AND is_approved = true),
          review_count = (SELECT COUNT(*)                FROM reviews WHERE product_id = ? AND is_approved = true)
        WHERE id = ?
      `, [r.product_id, r.product_id, r.product_id]);
    }
    success(res, r);
  } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════════════════
// WALLET
// ═══════════════════════════════════════════════════════════════════════════
router.get('/wallet', authenticate, requireSeller, requireSellerProfile, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try { success(res, await walletService.getWalletSummary(req.user.sellerId!)); } catch (e) { next(e); }
});
router.post('/wallet/withdraw', authenticate, requireSeller, requireSellerProfile, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try { created(res, await walletService.requestWithdrawal(req.user.sellerId!, req.body)); } catch (e) { next(e); }
});
router.get('/wallet/withdrawals', authenticate, requireSeller, requireSellerProfile, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try { success(res, await walletService.getWithdrawalHistory(req.user.sellerId!)); } catch (e) { next(e); }
});
router.get('/admin/wallet/withdrawals', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parsePage(req.query.page);
    const r    = await adminService.getWithdrawals(req.query, page);
    paginated(res, r.withdrawals, r.total, page, 20);
  } catch (e) { next(e); }
});
router.patch('/admin/wallet/withdrawals/:id', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    success(res, await adminService.processWithdrawal(req.params.id, req.user.userId, req.body.status, req.body.note));
  } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════

router.get('/notifications', authenticate, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const notifs = await db('notifications')
      .where('user_id', req.user.userId)
      .orderBy('created_at', 'desc')
      .limit(50);
    success(res, notifs);
  } catch (e) { next(e); }
});

router.patch('/notifications/read-all', authenticate, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    await db('notifications')
      .where({ user_id: req.user.userId, is_read: false })
      .update({ is_read: true, read_at: new Date() });
    success(res, null, 'All notifications marked as read');
  } catch (e) { next(e); }
});

router.patch('/notifications/:id/read', authenticate, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    await db('notifications')
      .where({ id: req.params.id, user_id: req.user.userId })
      .update({ is_read: true, read_at: new Date() });
    success(res, null);
  } catch (e) { next(e); }
});

router.delete('/notifications/all', authenticate, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    await db('notifications').where('user_id', req.user.userId).delete();
    success(res, null, 'All notifications cleared');
  } catch (e) { next(e); }
});

router.delete('/notifications/:id', authenticate, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const deleted = await db('notifications')
      .where({ id: req.params.id, user_id: req.user.userId }).delete();
    if (!deleted) throw AppError.notFound('Notification not found');
    success(res, null, 'Notification deleted');
  } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════════════════
// SHIPPING
// ═══════════════════════════════════════════════════════════════════════════
router.get('/shipping/zones', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    success(res, await db('shipping_zones').where('is_active', true));
  } catch (e) { next(e); }
});

router.post('/shipping/calculate', authenticate, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { zone_id, cart_total, total_weight } = req.body;
    if (!zone_id) throw AppError.badRequest('zone_id is required');
    const zone = await db('shipping_zones').where('id', zone_id).first();
    if (!zone) throw AppError.notFound('Zone not found');
    const free = zone.free_above_amount > 0 && cart_total >= zone.free_above_amount;
    const cost = free ? 0 : Number(zone.base_rate) + (total_weight * Number(zone.per_kg_rate));
    success(res, {
      shipping_cost:   cost,
      zone:            zone.name,
      estimated_days:  `${zone.estimated_days_min}–${zone.estimated_days_max}`,
      is_free:         free,
    });
  } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════════════════
// DISCOUNT CODES
// ═══════════════════════════════════════════════════════════════════════════
router.get('/discounts/public', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.set('Cache-Control', 'public, max-age=120, s-maxage=120');
    const codes = await db('discount_codes as dc')
      .leftJoin('categories as cat', 'cat.id', 'dc.category_id')
      .leftJoin('products as prod',  'prod.id', 'dc.product_id')
      .where('dc.is_active', true)
      .where('dc.starts_at',  '<=', new Date())
      .where('dc.expires_at', '>=', new Date())
      .whereRaw('(dc.usage_limit IS NULL OR dc.usage_count < dc.usage_limit)')
      .orderBy('dc.created_at', 'desc')
      .select(
        'dc.code', 'dc.type', 'dc.value', 'dc.min_order',
        'dc.expires_at', 'dc.description',
        'cat.name as category_name', 'cat.slug as category_slug',
        'prod.name as product_name', 'prod.slug as product_slug',
      );
    success(res, codes);
  } catch (e) { next(e); }
});

router.post('/discounts/validate', authenticate, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { code, subtotal, category_ids, product_ids } = req.body;
    if (!code) throw AppError.badRequest('code is required');

    const sub      = Number(subtotal) || 0;
    const discount = await db('discount_codes')
      .where('code',       String(code).toUpperCase().trim())
      .where('is_active',  true)
      .where('starts_at',  '<=', new Date())
      .where('expires_at', '>=', new Date())
      .first();

    if (!discount) throw AppError.badRequest('Invalid or expired discount code');
    if (discount.usage_limit !== null && discount.usage_count >= discount.usage_limit) {
      throw AppError.badRequest('This discount code has reached its usage limit');
    }

    if (discount.category_id) {
      const cartCategoryIds: string[] = category_ids ?? [];
      if (!cartCategoryIds.includes(discount.category_id)) {
        const cat = await db('categories').where('id', discount.category_id).select('name').first();
        throw AppError.badRequest(`This code only applies to products in the "${cat?.name ?? 'specific'}" category`);
      }
    }

    if (discount.product_id) {
      const cartProductIds: string[] = product_ids ?? [];
      if (!cartProductIds.includes(discount.product_id)) {
        const prod = await db('products').where('id', discount.product_id).select('name').first();
        throw AppError.badRequest(`This code only applies to "${prod?.name ?? 'a specific product'}"`);
      }
    }

    if (sub > 0 && sub < Number(discount.min_order)) {
      throw AppError.badRequest(`This code requires a minimum order of ${fmtETB(Number(discount.min_order))}`);
    }

    let discount_amount = 0;
    let message         = '';

    if (discount.type === 'percentage') {
      discount_amount = sub * (Number(discount.value) / 100);
      message = `${discount.value}% off — you save ${fmtETB(discount_amount)}`;
    } else if (discount.type === 'fixed_amount') {
      discount_amount = Math.min(Number(discount.value), sub);
      message = `${fmtETB(discount_amount)} off your order`;
    } else if (discount.type === 'free_shipping') {
      message = 'Free shipping applied to your order';
    }

    success(res, {
      valid:           true,
      type:            discount.type,
      discount_amount: Number(discount_amount.toFixed(2)),
      message,
      scope: discount.category_id ? 'category' : discount.product_id ? 'product' : 'global',
    });
  } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════════════════
// FLASH SALES
// ═══════════════════════════════════════════════════════════════════════════
router.get('/flash-sales/active', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.set('Cache-Control', 'public, max-age=30, s-maxage=30');

    const now   = new Date();
    const sales = await db('flash_sales')
      .where('is_active', true)
      .where('starts_at', '<=', now)
      .where('ends_at',   '>=', now)
      .orderBy('starts_at', 'asc');

    if (!sales.length) { success(res, []); return; }

    const saleIds  = sales.map((s: any) => s.id);
    const allItems = await db('flash_sale_items as fsi')
      .join('product_variants as pv', 'pv.id', 'fsi.variant_id')
      .join('products as p',          'p.id',  'pv.product_id')
      .leftJoin('product_images as pi', function(this: any) {
        this.on('pi.product_id', 'p.id').andOn('pi.is_primary', db.raw('true'));
      })
      .whereIn('fsi.flash_sale_id', saleIds)
      .select(
        'fsi.id', 'fsi.flash_sale_id', 'fsi.variant_id',
        'fsi.sale_price', 'fsi.max_qty', 'fsi.sold_qty',
        'pv.price as original_price', 'pv.sku',
        'p.id as product_id', 'p.name', 'p.slug',
        'pi.url as image_url',
      );

    const itemsBySale = new Map<string, any[]>();
    for (const item of allItems) {
      if (!itemsBySale.has(item.flash_sale_id)) itemsBySale.set(item.flash_sale_id, []);
      itemsBySale.get(item.flash_sale_id)!.push(item);
    }

    success(res, sales.map((sale: any) => ({ ...sale, items: itemsBySale.get(sale.id) ?? [] })));
  } catch (e) { next(e); }
});

router.get('/admin/flash-sales', authenticate, requireAdmin, async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sales = await db('flash_sales').orderBy('starts_at', 'desc');

    if (!sales.length) { success(res, []); return; }

    const saleIds  = sales.map((s: any) => s.id);
    const allItems = await db('flash_sale_items as fsi')
      .join('product_variants as pv', 'pv.id', 'fsi.variant_id')
      .join('products as p',          'p.id',  'pv.product_id')
      .leftJoin('product_images as pi', function(this: any) {
        this.on('pi.product_id', 'p.id').andOn('pi.is_primary', db.raw('true'));
      })
      .whereIn('fsi.flash_sale_id', saleIds)
      .select(
        'fsi.id', 'fsi.flash_sale_id', 'fsi.variant_id',
        'fsi.sale_price', 'fsi.max_qty', 'fsi.sold_qty',
        'pv.price as original_price', 'pv.sku',
        'p.id as product_id', 'p.name', 'p.slug',
        'pi.url as image_url',
      );

    const itemsBySale = new Map<string, any[]>();
    for (const item of allItems) {
      if (!itemsBySale.has(item.flash_sale_id)) itemsBySale.set(item.flash_sale_id, []);
      itemsBySale.get(item.flash_sale_id)!.push(item);
    }

    success(res, sales.map((sale: any) => ({ ...sale, items: itemsBySale.get(sale.id) ?? [] })));
  } catch (e) { next(e); }
});

router.post('/admin/flash-sales', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.body.title || !req.body.starts_at || !req.body.ends_at) {
      throw AppError.badRequest('title, starts_at, and ends_at are required');
    }
    if (new Date(req.body.ends_at) <= new Date(req.body.starts_at)) {
      throw AppError.badRequest('ends_at must be after starts_at');
    }
    const [s] = await db('flash_sales')
      .insert({ id: uuidv4(), created_by: req.user.userId, ...req.body })
      .returning('*');
    created(res, { ...s, items: [] });
  } catch (e) { next(e); }
});

router.put('/admin/flash-sales/:id', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [s] = await db('flash_sales').where('id', req.params.id).update(req.body).returning('*');
    if (!s) throw AppError.notFound('Flash sale not found');
    success(res, s);
  } catch (e) { next(e); }
});

  router.delete('/admin/flash-sales/:id', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    await db.transaction(async (trx) => {
       await trx('flash_sale_items').where('flash_sale_id', req.params.id).delete();
      const deleted = await trx('flash_sales').where('id', req.params.id).delete();
      if (!deleted) throw AppError.notFound('Flash sale not found');
    });
    success(res, null, 'Flash sale deleted');
  } catch (e) { next(e); }
});

router.post('/admin/flash-sales/:id/items', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sale = await db('flash_sales').where('id', req.params.id).first();
    if (!sale) throw AppError.notFound('Flash sale not found');
    if (!req.body.variant_id || !req.body.sale_price || !req.body.max_qty) {
      throw AppError.badRequest('variant_id, sale_price, and max_qty are required');
    }
    const [i] = await db('flash_sale_items')
      .insert({ id: uuidv4(), flash_sale_id: req.params.id, sold_qty: 0, ...req.body })
      .returning('*');
    created(res, i);
  } catch (e) { next(e); }
});

 router.delete('/admin/flash-sales/:saleId/items/:itemId', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const deleted = await db('flash_sale_items')
      .where({ id: req.params.itemId, flash_sale_id: req.params.saleId })
      .delete();
    if (!deleted) throw AppError.notFound('Flash sale item not found');
    success(res, null, 'Item removed from flash sale');
  } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════════════════
// NEWSLETTER
// ═══════════════════════════════════════════════════════════════════════════
router.post('/newsletter/subscribe', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw AppError.badRequest('Please provide a valid email address');
    }
    await db('newsletter_subscribers')
      .insert({ email, is_active: true })
      .onConflict('email')
      .merge({ is_active: true });
    success(res, null, 'Subscribed successfully');
  } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════════════════
// CMS — BANNERS + PAGES
// ═══════════════════════════════════════════════════════════════════════════
router.get('/cms/banners', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    const b = await db('banner_items')
      .where('is_active', true)
      .where((b: any) => { b.whereNull('starts_at').orWhere('starts_at', '<=', new Date()); })
      .where((b: any) => { b.whereNull('ends_at').orWhere('ends_at', '>=', new Date()); })
      .orderBy('sort_order');
    success(res, b);
  } catch (e) { next(e); }
});

router.get('/admin/cms/banners', authenticate, requireAdmin, async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try { success(res, await db('banner_items').orderBy('sort_order')); } catch (e) { next(e); }
});

router.post('/admin/cms/banners', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [b] = await db('banner_items')
      .insert({ id: uuidv4(), created_by: req.user.userId, ...req.body }).returning('*');
    created(res, b);
  } catch (e) { next(e); }
});

router.put('/admin/cms/banners/:id', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [b] = await db('banner_items').where('id', req.params.id).update(req.body).returning('*');
    if (!b) throw AppError.notFound('Banner not found');
    success(res, b);
  } catch (e) { next(e); }
});

router.delete('/admin/cms/banners/:id', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    await db('banner_items').where('id', req.params.id).update({ is_active: false });
    success(res, null, 'Banner deactivated');
  } catch (e) { next(e); }
});

router.get('/cms/pages/:slug', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = await db('static_pages').where({ slug: req.params.slug, is_published: true }).first();
    if (!page) throw AppError.notFound('Page not found');
    success(res, page);
  } catch (e) { next(e); }
});

router.put('/admin/cms/pages/:slug', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [page] = await db('static_pages').where('slug', req.params.slug)
      .update({ ...req.body, updated_by: req.user.userId }).returning('*');
    success(res, page);
  } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN: DASHBOARD, USERS, SELLERS, REPORTS
// ═══════════════════════════════════════════════════════════════════════════
router.get('/admin/dashboard', authenticate, requireAdmin, async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try { success(res, await adminService.getDashboard()); } catch (e) { next(e); }
});

router.get('/admin/users', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parsePage(req.query.page);
    const r    = await adminService.getUsers(req.query, page);
    paginated(res, r.users, r.total, page, 20);
  } catch (e) { next(e); }
});

router.get('/admin/users/:id', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await db('users').where('id', req.params.id)
      .select('id', 'email', 'phone', 'role', 'first_name', 'last_name',
        'email_verified', 'is_active', 'is_suspended', 'suspension_reason',
        'last_login_at', 'created_at').first();
    if (!user) throw AppError.notFound('User not found');
    success(res, user);
  } catch (e) { next(e); }
});

router.patch('/admin/users/:id/toggle', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    success(res, await adminService.toggleUserStatus(req.params.id, req.body.suspend, req.body.reason));
  } catch (e) { next(e); }
});

router.patch('/admin/users/:id/role', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [u] = await db('users').where('id', req.params.id)
      .update({ role: req.body.role }).returning(['id', 'email', 'role']);
    if (!u) throw AppError.notFound('User not found');
    success(res, u);
  } catch (e) { next(e); }
});

router.get('/admin/sellers/pending', authenticate, requireAdmin, async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sellers = await db('seller_profiles as sp')
      .join('users as u', 'u.id', 'sp.user_id')
      .where('sp.status', 'pending')
      .select('sp.*', 'u.email', 'u.first_name', 'u.last_name', 'u.phone');
    success(res, sellers);
  } catch (e) { next(e); }
});

router.get('/admin/sellers', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parsePage(req.query.page);
    const r    = await adminService.getAllSellers(req.query, page);
    paginated(res, r.sellers, r.total, page, 20);
  } catch (e) { next(e); }
});

router.get('/admin/sellers/:id', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sp = await db('seller_profiles as sp')
      .join('users as u', 'u.id', 'sp.user_id')
      .where('sp.id', req.params.id)
      .select('sp.*', 'u.email', 'u.first_name', 'u.last_name', 'u.phone', 'u.is_suspended')
      .first();
    if (!sp) throw AppError.notFound('Seller not found');
    success(res, sp);
  } catch (e) { next(e); }
});

router.patch('/admin/sellers/:id/approve', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    success(res, await adminService.approveSeller(req.params.id, req.user.userId, req.body.approve, req.body.reason));
  } catch (e) { next(e); }
});

router.patch('/admin/sellers/:id/commission', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    success(res, await adminService.updateSellerCommission(req.params.id, req.body.commission_rate));
  } catch (e) { next(e); }
});

router.get('/admin/reports/sales', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try { success(res, await adminService.getSalesReport(req.query as any)); } catch (e) { next(e); }
});

router.get('/admin/reports/sellers', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try { success(res, await adminService.getSellerReport(req.query)); } catch (e) { next(e); }
});

router.get('/admin/reports/export', authenticate, requireAdmin, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const format  = String(req.query.format || 'excel');
    const filters = { ...req.query };
    delete filters.format;

    if (format === 'pdf') {
      const pdf = await adminService.exportSalesReportPDF(filters);
      res.set({
        'Content-Type':        'application/pdf',
        'Content-Disposition': 'attachment; filename="sales-report.pdf"',
      });
      res.send(pdf); return;
    }

    const excel = await adminService.exportSalesReportExcel(filters);
    res.set({
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="sales-report.xlsx"',
    });
    res.send(excel);
  } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════════════════
// SELLER DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
router.get('/seller/dashboard', authenticate, requireSeller, requireSellerProfile, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sellerId = req.user.sellerId!;
    const [profile, totalSales, pendingOrders, recentOrders, lowStock] = await Promise.all([
      db('seller_profiles').where('id', sellerId)
        .select('wallet_balance', 'pending_balance', 'total_earned', 'business_name', 'status').first(),
      db('order_items').where('seller_id', sellerId).where('status', 'delivered')
        .sum('line_total as total').first(),
      db('order_items').where({ seller_id: sellerId, status: 'pending' })
        .count('id as total').first(),
      db('order_items as oi')
        .join('orders as o', 'o.id', 'oi.order_id')
        .where('oi.seller_id', sellerId)
        .orderBy('o.placed_at', 'desc').limit(5)
        .select('oi.*', 'o.order_number', 'o.placed_at', 'o.total'),
      db('product_variants as pv')
        .join('products as p', 'p.id', 'pv.product_id')
        .where('p.seller_id', sellerId)
        .whereRaw('pv.stock_qty <= pv.low_stock_threshold')
        .where('pv.is_active', true)
        .select('p.name', 'pv.sku', 'pv.stock_qty', 'pv.low_stock_threshold'),
    ]);

    success(res, {
      profile,
      total_sales:      Number((totalSales as any)?.total || 0),
      pending_orders:   toCount(pendingOrders),
      recent_orders:    recentOrders,
      low_stock_alerts: lowStock,
    });
  } catch (e) { next(e); }
});

export default router;