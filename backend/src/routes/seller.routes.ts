// src/routes/seller.routes.ts
import { Router, IRouter, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, requireSeller, requireSellerProfile, requireCustomer } from '../middleware';
import { sellerService } from '../modules/seller/seller.service';
import { returnService } from '../modules/returns/returns.service';
import { success, paginated, created, AppError } from '../utils/response';
import db from '../config/database';

const router: IRouter = Router();

router.use(authenticate, requireSeller, requireSellerProfile);

// ── Req 3.1.3: Seller profile ──────────────────────────────────────────────
router.get('/profile', async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try { success(res, await sellerService.getProfile(req.user.sellerId!)); } catch (e) { next(e); }
});

router.put('/profile', async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try { success(res, await sellerService.updateProfile(req.user.sellerId!, req.body)); } catch (e) { next(e); }
});

// ── Req 3.3.1: Sales graph ─────────────────────────────────────────────────
router.get('/sales-graph', async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const period = String(req.query.period || 'daily') as 'daily' | 'weekly' | 'monthly';
    success(res, await sellerService.getSalesGraph(req.user.sellerId!, period));
  } catch (e) { next(e); }
});

// ── Req 3.3.1: Product performance ────────────────────────────────────────
router.get('/product-performance', async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try { success(res, await sellerService.getProductPerformance(req.user.sellerId!)); } catch (e) { next(e); }
});

// ── Req 3.3.4: Inventory management ───────────────────────────────────────
router.get('/inventory', async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page  = Number(String(req.query.page  || '1'))  || 1;
    const limit = Number(String(req.query.limit || '20')) || 20;
    const result = await sellerService.getInventory(req.user.sellerId!, page, limit);
    paginated(res, result.data, result.total, page, limit);
  } catch (e) { next(e); }
});

// ── Req 3.3.4: Stock history per variant ──────────────────────────────────
router.get('/inventory/:variantId/history', async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try { success(res, await sellerService.getStockHistory(req.user.sellerId!, req.params.variantId)); } catch (e) { next(e); }
});

// ── Products with variants — used by the flash sale variant picker ─────────
// Returns seller's active products with their variants and primary image
// so the frontend picker can show a rich list without separate requests.
router.get('/products-with-variants', async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sellerId = req.user.sellerId!;
    const limit    = Math.min(Number(req.query.limit || '100'), 200);

    const products = await db('products as p')
      .where('p.seller_id', sellerId)
      .whereIn('p.status', ['active', 'pending_review'])
      .orderBy('p.created_at', 'desc')
      .limit(limit)
      .select('p.id', 'p.name', 'p.status');

    if (!products.length) { success(res, []); return; }

    const productIds = products.map((p: any) => p.id);

    // Load all variants for these products in one query
    const variants = await db('product_variants')
      .whereIn('product_id', productIds)
      .where('is_active', true)
      .select('id', 'product_id', 'sku', 'price', 'discount_price', 'stock_qty', 'weight_kg');

    // Load primary images in one query
    const images = await db('product_images')
      .whereIn('product_id', productIds)
      .where('is_primary', true)
      .select('product_id', 'url');

    const imageMap  = Object.fromEntries(images.map((i: any) => [i.product_id, i.url]));
    const variantMap: Record<string, any[]> = {};
    for (const v of variants) {
      if (!variantMap[v.product_id]) variantMap[v.product_id] = [];
      variantMap[v.product_id].push(v);
    }

    const result = products
      .map((p: any) => ({
        ...p,
        primary_image: imageMap[p.id] || null,
        variants:      (variantMap[p.id] || []).map((v: any) => ({
          ...v,
          product: { name: p.name, images: imageMap[p.id] ? [{ url: imageMap[p.id] }] : [] },
        })),
      }))
      .filter((p: any) => p.variants.length > 0); // only show products that have variants

    success(res, result);
  } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════════════════
// SELLER DISCOUNTS
// ═══════════════════════════════════════════════════════════════════════════

router.get('/discounts', async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const codes = await db('discount_codes')
      .where('seller_id', req.user.sellerId!)
      .orderBy('created_at', 'desc');
    success(res, codes);
  } catch (e) { next(e); }
});

router.post('/discounts', async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { code, type, value, min_order, usage_limit, starts_at, expires_at } = req.body;

    if (!code || !type || !starts_at || !expires_at) {
      throw AppError.badRequest('code, type, starts_at and expires_at are required');
    }
    const validTypes = ['percentage', 'fixed_amount', 'free_shipping'];
    if (!validTypes.includes(type)) {
      throw AppError.badRequest(`type must be one of: ${validTypes.join(', ')}`);
    }
    if (type !== 'free_shipping' && (!value || Number(value) <= 0)) {
      throw AppError.badRequest('value must be greater than 0 for percentage and fixed_amount types');
    }
    if (type === 'percentage' && Number(value) > 100) {
      throw AppError.badRequest('Percentage value cannot exceed 100');
    }
    if (new Date(expires_at) <= new Date(starts_at)) {
      throw AppError.badRequest('expires_at must be after starts_at');
    }

    const existing = await db('discount_codes')
      .whereRaw('UPPER(code) = ?', [code.toUpperCase()])
      .where('seller_id', req.user.sellerId!)
      .first();
    if (existing) throw AppError.badRequest('You already have a discount code with this name');

    const [discount] = await db('discount_codes').insert({
      id:          uuidv4(),
      seller_id:   req.user.sellerId!,
      code:        code.toUpperCase().trim(),
      type,
      value:       type === 'free_shipping' ? 0 : Number(value),
      min_order:   min_order   ? Number(min_order)   : 0,
      usage_limit: usage_limit ? Number(usage_limit) : null,
      usage_count: 0,
      starts_at:   new Date(starts_at),
      expires_at:  new Date(expires_at),
      is_active:   true,
    }).returning('*');

    created(res, discount, 'Discount code created');
  } catch (e) { next(e); }
});

router.patch('/discounts/:id/toggle', async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const discount = await db('discount_codes')
      .where({ id: req.params.id, seller_id: req.user.sellerId! })
      .first();
    if (!discount) throw AppError.notFound('Discount code not found');
    const [updated] = await db('discount_codes')
      .where('id', req.params.id)
      .update({ is_active: !discount.is_active })
      .returning('*');
    success(res, updated, `Discount code ${updated.is_active ? 'activated' : 'deactivated'}`);
  } catch (e) { next(e); }
});

router.delete('/discounts/:id', async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const deleted = await db('discount_codes')
      .where({ id: req.params.id, seller_id: req.user.sellerId! })
      .delete();
    if (!deleted) throw AppError.notFound('Discount code not found');
    success(res, null, 'Discount code deleted');
  } catch (e) { next(e); }
});




// =============================================================================
// ADD to src/routes/index.ts — RETURNS section
// These go alongside the existing return routes
// =============================================================================

// GET /seller/returns — seller sees all returns for their items
// Supports ?status=requested|under_review|approved|rejected|completed
router.get('/seller/returns', authenticate, requireSeller, requireSellerProfile, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    success(res, await returnService.getSellerReturns(req.user.sellerId!, status));
  } catch (e) { next(e); }
});

// PATCH /seller/returns/:id — seller responds to a return request
// Body: { status, resolution?, seller_note?, refund_amount? }
// status enum: 'under_review' | 'approved' | 'rejected' | 'completed'
// resolution enum: 'refund' | 'replacement' | 'store_credit'
router.patch('/seller/returns/:id', authenticate, requireSeller, requireSellerProfile, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    success(res, await returnService.updateReturnStatus(req.params.id, req.user.sellerId!, req.body.status, req.body));
  } catch (e) { next(e); }
});

// NOTE: Also update the existing POST /returns route body handling:
// The frontend now sends { order_item_id, reason, note? }
// The backend submitReturn now accepts note? and stores it in evidence_urls
// Ensure the route passes req.body through as-is:
router.post('/returns', authenticate, requireCustomer, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    created(res, await returnService.submitReturn(req.user.userId, req.body), 'Return request submitted');
  } catch (e) { next(e); }
});
// ═══════════════════════════════════════════════════════════════════════════
// SELLER FLASH SALE JOIN
// ═══════════════════════════════════════════════════════════════════════════

router.post('/flash-sales/:id/join', async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { variant_id, sale_price, max_qty } = req.body;

    if (!variant_id || !sale_price || !max_qty) {
      throw AppError.badRequest('variant_id, sale_price and max_qty are required');
    }

    const sale = await db('flash_sales')
      .where('id', req.params.id)
      .where('is_active', true)
      .where('ends_at', '>=', new Date())
      .first();
    if (!sale) throw AppError.notFound('Flash sale not found or has already ended');

    const variant = await db('product_variants as pv')
      .join('products as p', 'p.id', 'pv.product_id')
      .where('pv.id', variant_id)
      .where('p.seller_id', req.user.sellerId!)
      .where('p.status', 'active')
      .select('pv.*', 'p.name as product_name')
      .first();
    if (!variant) throw AppError.notFound('Variant not found or does not belong to your store');

    if (Number(sale_price) >= Number(variant.price)) {
      throw AppError.badRequest(`Sale price must be below the regular price of ${variant.price}`);
    }

    const duplicate = await db('flash_sale_items')
      .where({ flash_sale_id: req.params.id, variant_id })
      .first();
    if (duplicate) throw AppError.badRequest('This variant is already part of this flash sale');

    const [item] = await db('flash_sale_items').insert({
      id:            uuidv4(),
      flash_sale_id: req.params.id,
      variant_id,
      sale_price:    Number(sale_price),
      max_qty:       Number(max_qty),
      sold_qty:      0,
    }).returning('*');

    created(res, { ...item, product_name: variant.product_name }, 'Joined flash sale successfully');
  } catch (e) { next(e); }
});

export default router;