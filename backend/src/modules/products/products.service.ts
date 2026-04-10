// src/modules/products/products.service.ts
// FIX 2339 (line 101): Knex .count() returns Dict<string|number>.
//   Fixed by extracting count with explicit cast via toCount() helper.
import { v4 as uuidv4 } from 'uuid';
import slugify from 'slugify';
import { Knex } from 'knex';
import db from '../../config/database';
import { AppError } from '../../utils/response';
import { ProductSearchQuery } from '../../types';

// Helper: safely extract count from Knex count result
function toCount(result: any): number {
  if (!result) return 0;
  const val = result.total ?? result.count ?? 0;
  return Number(val);
}

export const productService = {

  // ── Req 3.2.2: Product Search + Filtering + Sorting ──────────────────────
  async searchProducts(query: ProductSearchQuery) {
    const {
      q, category, brand,
      status, seller_id,
      min_price, max_price, min_rating,
      attributes, sort = 'newest',
      page = 1, limit = 20,
    } = query;

    // ── FIX: Express passes query params as strings, not booleans.
    //         in_stock arrives as "true" (string) not true (boolean).
    //         Coerce to boolean so the filter always works correctly. ──
    const in_stock = query.in_stock === true || (query.in_stock as any) === 'true';

    const offset = (page - 1) * limit;

    // For admin queries (non-active status), use LEFT JOIN so products without
    // default variants still appear in the list
    const isAdminQuery = status && status !== 'active';
    let builder = isAdminQuery
      ? db('products as p').leftJoin('product_variants as pv', (b: Knex.JoinClause) => {
          b.on('pv.product_id', 'p.id').andOn('pv.is_default', db.raw('true'));
        })
      : db('products as p').join('product_variants as pv', (b: Knex.JoinClause) => {
          b.on('pv.product_id', 'p.id').andOn('pv.is_default', db.raw('true'));
        });
    builder = builder
      .leftJoin('categories as c',       'c.id',  'p.category_id')
      .leftJoin('brands as b',           'b.id',  'p.brand_id')
      .leftJoin('seller_profiles as sp', 'sp.id', 'p.seller_id')
      .where('p.status', status || 'active')
      .select(
        'p.id', 'p.name', 'p.slug', 'p.short_description',
        'p.avg_rating', 'p.review_count', 'p.total_sold', 'p.is_featured',
        'p.status',
        'pv.id as variant_id',
        'pv.price', 'pv.discount_price', 'pv.stock_qty', 'pv.sku',
        'c.name as category_name', 'c.slug as category_slug',
        'b.name as brand_name',
        'sp.business_name as seller_name', 'sp.store_slug'
      );

    // Only filter active variants for public-facing queries
    if (!status || status === 'active') {
      builder = builder.where('pv.is_active', true);
    }

    // Filter by seller_id (for seller's own products in admin)
    if (seller_id) builder = builder.where('p.seller_id', seller_id);

    // Req 3.2.2: Keyword search
    if (q) {
      builder = builder.where((b: Knex.QueryBuilder) => {
        b.whereRaw('p.name ILIKE ?', [`%${q}%`])
         .orWhereRaw('p.full_description ILIKE ?', [`%${q}%`]);
      });
    }

    // Req 3.2.2: Filter by category (including subcategories)
    if (category) {
      const cat = await db('categories').where('slug', category).first();
      if (cat) {
        const childIds = await db('categories').where('parent_id', cat.id).pluck('id');
        builder = builder.whereIn('p.category_id', [cat.id, ...childIds]);
      }
    }

    // Req 3.2.2: Filter by brand
    if (brand) builder = builder.where('b.slug', brand);

    // Req 3.2.2: Filter by price range
    if (min_price !== undefined) builder = builder.where('pv.price', '>=', min_price);
    if (max_price !== undefined) builder = builder.where('pv.price', '<=', max_price);

    // Req 3.2.2: Filter by rating
    if (min_rating !== undefined) builder = builder.where('p.avg_rating', '>=', min_rating);

    // Req 3.2.2: Filter by availability
    // ── FIXED: was (in_stock === true) which never matched string "true" from URL ──
    if (in_stock) builder = builder.where('pv.stock_qty', '>', 0);

    // Req 3.2.2: Filter by attributes (size, color, etc.)
    if (attributes && Object.keys(attributes).length > 0) {
      for (const [attrName, attrValue] of Object.entries(attributes)) {
        builder = builder.whereExists(
          db('product_attribute_values as pav')
            .join('attribute_values as av', 'av.id', 'pav.attribute_value_id')
            .join('product_attributes as pa', 'pa.id', 'pav.attribute_id')
            .whereRaw('pav.variant_id = pv.id')
            .where('pa.name', attrName)
            .where('av.value', attrValue)
            .select(db.raw('1'))
        );
      }
    }

    // Req 3.2.2: Sort options
    const sortMap: Record<string, { col: string; order: 'asc' | 'desc' }[]> = {
      price_asc:  [{ col: 'pv.price',     order: 'asc'  }],
      price_desc: [{ col: 'pv.price',     order: 'desc' }],
      newest:     [{ col: 'p.created_at', order: 'desc' }],
      popularity: [{ col: 'p.total_sold', order: 'desc' }],
      rating:     [{ col: 'p.avg_rating', order: 'desc' }],
    };
    for (const s of (sortMap[sort] || sortMap['newest'])) {
      builder = builder.orderBy(s.col, s.order);
    }

    // FIX 2339: use toCount() instead of destructuring countResult.total
    const countResult = await builder.clone()
      .clearSelect()
      .clearOrder()
      .count('p.id as total')
      .first();

    const rows = await builder.limit(limit).offset(offset);

    // Attach primary image to each product
    const ids = rows.map((r: any) => r.id);
    const images = ids.length
      ? await db('product_images')
          .whereIn('product_id', ids)
          .where('is_primary', true)
          .select('product_id', 'url')
      : [];
    const imageMap = Object.fromEntries(images.map((i: any) => [i.product_id, i.url]));

    const data = rows.map((r: any) => ({
      ...r,
      primary_image:   imageMap[r.id] || null,
      effective_price: r.discount_price || r.price,
    }));

    return { data, total: toCount(countResult) };
  },

  // ── Req 3.2.3: Product Detail Page ───────────────────────────────────────
  async getProductBySlug(slug: string) {
    const product = await db('products as p')
      .leftJoin('categories as c',       'c.id',  'p.category_id')
      .leftJoin('brands as b',           'b.id',  'p.brand_id')
      .leftJoin('seller_profiles as sp', 'sp.id', 'p.seller_id')
      .leftJoin('users as u',            'u.id',  'sp.user_id')
      .where('p.slug', slug)
      .whereIn('p.status', ['active', 'pending_review'])
      .select(
        'p.*',
        'c.name as category_name', 'c.slug as category_slug',
        'b.name as brand_name',    'b.logo_url as brand_logo',
        'sp.id as seller_id',      'sp.business_name', 'sp.store_slug',
        'sp.return_policy',
        'u.id as seller_user_id'
      )
      .first();

    if (!product) throw AppError.notFound('Product not found');

    // Variants with their attributes
    // Show all variants for pending_review (seller preview), only active for active products
    const variantQuery = db('product_variants as pv')
      .where('pv.product_id', product.id);
    if (product.status === 'active') {
      variantQuery.where('pv.is_active', true);
    }
    const variants = await variantQuery.select('pv.*');

    for (const v of variants) {
      v.attributes = await db('product_attribute_values as pav')
        .join('product_attributes as pa', 'pa.id', 'pav.attribute_id')
        .join('attribute_values as av',   'av.id', 'pav.attribute_value_id')
        .where('pav.variant_id', v.id)
        .select(
          'pa.name', 'pa.display_name',
          'av.value', 'av.display_value', 'av.color_hex'
        );
    }

    // Req 3.2.3: Images (multiple)
    const images = await db('product_images')
      .where('product_id', product.id)
      .orderBy('is_primary', 'desc')
      .orderBy('sort_order');

    // Req 3.2.3: Tags
    const tags = await db('product_tags').where('product_id', product.id).pluck('tag');

    // Req 3.2.3: Related products
    const related = await db('products as p')
      .join('product_variants as pv', (b: Knex.JoinClause) => {
        b.on('pv.product_id', 'p.id').andOn('pv.is_default', db.raw('true'));
      })
      .where('p.category_id', product.category_id)
      .where('p.status', 'active')
      .whereNot('p.id', product.id)
      .select('p.id', 'p.name', 'p.slug', 'p.avg_rating', 'pv.price', 'pv.discount_price')
      .limit(8);

    return { ...product, variants, images, tags, related };
  },

  // ── Req 3.3.2: Seller Create Product ─────────────────────────────────────
  async createProduct(sellerId: string, data: any) {
    const slug = await this._uniqueSlug(data.name);

    return db.transaction(async (trx) => {
      const [product] = await trx('products').insert({
        id: uuidv4(), seller_id: sellerId,
        category_id:      data.category_id,
        brand_id:         data.brand_id         || null,
        name:             data.name,
        slug,
        short_description: data.short_description || null,
        full_description:  data.full_description  || null,
        status:           'pending_review',
        meta_title:       data.meta_title        || null,
        meta_description: data.meta_description  || null,
      }).returning('*');

      if (data.variants?.length) {
        for (let i = 0; i < data.variants.length; i++) {
          const v = data.variants[i];
          const [variant] = await trx('product_variants').insert({
            id: uuidv4(), product_id: product.id,
            sku:                 v.sku,
            price:               v.price,
            discount_price:      v.discount_price      || null,
            stock_qty:           v.stock_qty            || 0,
            low_stock_threshold: v.low_stock_threshold  || 5,
            weight_kg:           v.weight_kg            || 0,
            length_cm:           v.length_cm            || null,
            width_cm:            v.width_cm             || null,
            height_cm:           v.height_cm            || null,
            is_default:          i === 0,
          }).returning('*');

          if (v.attributes?.length) {
            for (const attr of v.attributes) {
              await trx('product_attribute_values').insert({
                id: uuidv4(), variant_id: variant.id,
                attribute_id:       attr.attribute_id,
                attribute_value_id: attr.attribute_value_id,
              });
            }
          }
        }
      }

      if (data.tags?.length) {
        for (const tag of data.tags) {
          await trx('product_tags')
            .insert({ id: uuidv4(), product_id: product.id, tag: tag.toLowerCase().trim() })
            .onConflict(['product_id', 'tag'])
            .ignore();
        }
      }

      // Handle images array (URLs from image hosting)
      if (data.images?.length) {
        for (let i = 0; i < data.images.length; i++) {
          const img = data.images[i];
          const url = typeof img === 'string' ? img : img.url;
          if (url) {
            await trx('product_images').insert({
              id:         uuidv4(),
              product_id: product.id,
              url,
              alt_text:   img.alt_text || data.name,
              is_primary: i === 0,
              sort_order: i,
            });
          }
        }
      }

      return product;
    });
  },

  // ── Req 3.3.2: Edit Product ───────────────────────────────────────────────
  async updateProduct(productId: string, sellerId: string, data: any) {
    const product = await db('products')
      .where({ id: productId, seller_id: sellerId })
      .first();
    if (!product) throw AppError.notFound('Product not found');

    const updates: any = {};
    const allowed = [
      'name', 'short_description', 'full_description',
      'category_id', 'brand_id', 'meta_title', 'meta_description',
    ];
    for (const key of allowed) {
      if (data[key] !== undefined) updates[key] = data[key];
    }
    if (data.name && data.name !== product.name) {
      updates.slug = await this._uniqueSlug(data.name, productId);
    }
    if (product.status === 'rejected') updates.status = 'pending_review';

    const [updated] = await db('products')
      .where('id', productId)
      .update(updates)
      .returning('*');

    return updated;
  },

  // ── Req 3.3.2: Delete Product (soft-delete) ───────────────────────────────
  async deleteProduct(productId: string, sellerId: string) {
    const product = await db('products')
      .where({ id: productId, seller_id: sellerId })
      .first();
    if (!product) throw AppError.notFound('Product not found');

    await db('products').where('id', productId).update({ status: 'archived' });
    return { deleted: true };
  },

  // ── Req 3.3.2: Manage stock ───────────────────────────────────────────────
  async updateVariantStock(variantId: string, sellerId: string, qty: number, note?: string) {
    const variant = await db('product_variants as pv')
      .join('products as p', 'p.id', 'pv.product_id')
      .where('pv.id', variantId)
      .where('p.seller_id', sellerId)
      .select('pv.*')
      .first();

    if (!variant) throw AppError.notFound('Variant not found');

    const before = variant.stock_qty;
    const after  = qty;

    await db.transaction(async (trx) => {
      await trx('product_variants').where('id', variantId).update({ stock_qty: after });

      await trx('stock_history').insert({
        id: uuidv4(), variant_id: variantId,
        qty_before: before, qty_change: after - before, qty_after: after,
        reason: 'manual_adjustment', note: note || null,
      });
    });

    return { stock_qty: after };
  },

  // ── Req 3.4.4: Admin approve/reject product ───────────────────────────────
  async approveProduct(productId: string, adminId: string, approve: boolean, reason?: string) {
    const product = await db('products').where('id', productId).first();
    if (!product) throw AppError.notFound('Product not found');

    const newStatus = approve ? 'active' : 'rejected';

    await db('products').where('id', productId).update({
      status:           newStatus,
      rejection_reason: approve ? null : (reason || 'Did not meet listing standards'),
      reviewed_by:      adminId,
      reviewed_at:      new Date(),
    });

    // When approving, ensure all variants are active
    if (approve) {
      await db('product_variants').where('product_id', productId).update({ is_active: true });
    }

    // Notify seller
    try {
      const sp = await db('seller_profiles as sp')
        .join('users as u', 'u.id', 'sp.user_id')
        .where('sp.id', product.seller_id)
        .select('u.id as user_id', 'u.email', 'sp.business_name')
        .first();
      if (sp) {
        await db('notifications').insert({
          id: uuidv4(), user_id: sp.user_id,
          type: approve ? 'product_approved' : 'product_rejected',
          channel: 'in_app',
          title: approve ? 'Product approved!' : 'Product rejected',
          body: approve
            ? `Your product "${product.name}" has been approved and is now live.`
            : `Your product "${product.name}" was rejected. Reason: ${reason || 'Did not meet standards'}`,
        });
      }
    } catch { /* notification failure should not block approval */ }

    return { approved: approve, status: newStatus };
  },

  // ── Req 3.4.4: Admin feature product ─────────────────────────────────────
  async featureProduct(productId: string, featured: boolean) {
    await db('products').where('id', productId).update({ is_featured: featured });
    return { is_featured: featured };
  },

  // ─── Internal helpers ─────────────────────────────────────────────────────
  async _uniqueSlug(name: string, excludeId?: string): Promise<string> {
    const base  = slugify(name, { lower: true, strict: true });
    let slug    = base;
    let counter = 1;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const q = db('products').where('slug', slug);
      if (excludeId) q.whereNot('id', excludeId);
      const exists = await q.first();
      if (!exists) break;
      slug = `${base}-${counter++}`;
    }

    return slug;
  },
};