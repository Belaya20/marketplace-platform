'use client';
// src/app/(public)/product/[slug]/page.tsx
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link  from 'next/link';
import { useParams } from 'next/navigation';
import {
  Star, Heart, ShoppingCart, Truck, RotateCcw,
  Shield, ChevronRight, Zap, Clock, Loader2, CheckCircle2,
} from 'lucide-react';
import { useProduct, useCart, useWishlist, formatETB } from '@/hooks';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewApi, flashSaleApi } from '@/lib/api';
import api from '@/lib/api';
import { ProductGrid } from '@/components/features/product/ProductCard';
import type { ProductVariant, Review, ProductDetail, FlashSale } from '@/types';
import { useAuthStore } from '@/store';
import clsx from 'clsx';
import toast from 'react-hot-toast';

// ── Live countdown ────────────────────────────────────────────────────────────
function useCountdown(endDate: string) {
  const calc = () => {
    const diff = new Date(endDate).getTime() - Date.now();
    if (diff <= 0) return { h: 0, m: 0, s: 0, over: true };
    return {
      h: Math.floor(diff / 3_600_000),
      m: Math.floor((diff % 3_600_000) / 60_000),
      s: Math.floor((diff % 60_000) / 1_000),
      over: false,
    };
  };
  const [time, setTime] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setTime(calc()), 1_000);
    return () => clearInterval(id);
  }, [endDate]);
  return time;
}
function pad(n: number) { return String(n).padStart(2, '0'); }

// ── Star selector ─────────────────────────────────────────────────────────────
function StarSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} type="button"
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(i)}
          className="p-0.5 transition-transform hover:scale-110 active:scale-95">
          <Star size={28} className={clsx('transition-colors',
            i <= (hovered || value) ? 'fill-amber-400 text-amber-400' : 'text-gray-300')} />
        </button>
      ))}
      <span className="ml-2 text-sm font-medium text-gray-600">
        {value === 0 ? 'Select rating' : LABELS[value]}
      </span>
    </div>
  );
}

// ── Review form ───────────────────────────────────────────────────────────────
function ReviewForm({ productId }: { productId: string }) {
  const { user }    = useAuthStore();
  const qc          = useQueryClient();
  const [rating,    setRating]    = useState(0);
  const [title,     setTitle]     = useState('');
  const [comment,   setComment]   = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { data: canReviewData, isLoading: checkLoading } = useQuery({
    queryKey: ['can-review', productId],
    queryFn:  () => api.get(`/reviews/product/${productId}/can-review`).then((r: any) => r.data.data),
    enabled:  !!user,
  });

  const mutation = useMutation({
    mutationFn: () => reviewApi.submitReview(productId, {
      rating, title: title.trim() || undefined, comment: comment.trim() || undefined,
      order_id: canReviewData?.order_id,
    }),
    onSuccess: () => {
      toast.success('Review submitted! Thank you.');
      setSubmitted(true);
      qc.invalidateQueries({ queryKey: ['reviews', productId] });
      qc.invalidateQueries({ queryKey: ['can-review', productId] });
      qc.invalidateQueries({ queryKey: ['product'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to submit review'),
  });

  if (!user) return (
    <div className="card p-5 bg-gray-50 text-center">
      <p className="text-sm text-gray-500 mb-2">Sign in to leave a review</p>
      <Link href="/login" className="btn-primary text-sm py-2 px-6">Sign in</Link>
    </div>
  );

  if (checkLoading) return (
    <div className="card p-5 flex items-center gap-2 text-gray-400 text-sm">
      <Loader2 size={14} className="animate-spin" /> Checking eligibility…
    </div>
  );

  if (canReviewData?.already_reviewed || submitted) return (
    <div className="card p-5 bg-green-50 border border-green-100 flex items-center gap-3">
      <CheckCircle2 size={20} className="text-green-500 shrink-0" />
      <div>
        <p className="text-sm font-medium text-green-800">You've already reviewed this product</p>
        <p className="text-xs text-green-600 mt-0.5">Thank you for your feedback!</p>
      </div>
    </div>
  );

  if (!canReviewData?.can_review) return (
    <div className="card p-4 bg-gray-50 text-sm text-gray-500">
      Only customers who have purchased and received this product can leave a review.
    </div>
  );

  return (
    <div className="card p-5 space-y-4">
      <h3 className="font-semibold text-gray-900 text-sm">Write a review</h3>
      <div>
        <label className="text-xs font-medium text-gray-500 mb-2 block">Your rating *</label>
        <StarSelector value={rating} onChange={setRating} />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Review title</label>
        <input value={title} onChange={e => setTitle(e.target.value)}
          className="input text-sm" placeholder="Summarize your experience" maxLength={120} />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Your review</label>
        <textarea value={comment} onChange={e => setComment(e.target.value)}
          rows={4} className="input text-sm resize-none"
          placeholder="Share details about your experience with this product…" maxLength={1000} />
        <p className="text-xs text-gray-400 mt-1 text-right">{comment.length}/1000</p>
      </div>
      <button
        onClick={() => { if (!rating) { toast.error('Please select a rating'); return; } mutation.mutate(); }}
        disabled={mutation.isPending || !rating}
        className="btn-primary gap-2 text-sm disabled:opacity-50">
        {mutation.isPending ? <><Loader2 size={13} className="animate-spin" />Submitting…</> : 'Submit review'}
      </button>
    </div>
  );
}

// ── Flash price banner ────────────────────────────────────────────────────────
function FlashPriceBanner({ salePrice, origPrice, endsAt, soldQty, maxQty }: {
  salePrice: number; origPrice: number; endsAt: string; soldQty: number; maxQty: number;
}) {
  const { h, m, s, over } = useCountdown(endsAt);
  const pct     = maxQty > 0 ? Math.min((soldQty / maxQty) * 100, 100) : 0;
  const savings = origPrice - salePrice;
  if (over) return null;

  return (
    <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="bg-red-500 text-white p-1.5 rounded-lg shrink-0">
            <Zap size={14} className="fill-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-red-700">Flash Sale Price!</p>
            <p className="text-xs text-red-500">You save {formatETB(savings)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock size={13} className="text-red-400" />
          <span className="text-xs text-gray-500">Ends in</span>
          <span className="font-mono font-bold text-red-700 text-sm tabular-nums">
            {pad(h)}:{pad(m)}:{pad(s)}
          </span>
        </div>
      </div>
      {maxQty > 0 && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>{soldQty} sold</span>
            <span className={pct > 80 ? 'text-red-600 font-bold' : ''}>{maxQty - soldQty} remaining</span>
          </div>
          <div className="h-2 bg-red-100 rounded-full overflow-hidden">
            <div className={clsx('h-full rounded-full transition-all', pct > 80 ? 'bg-red-500' : 'bg-red-400')}
              style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Star display (read-only) ──────────────────────────────────────────────────
// FIX: accepts rating as number, coerced at call site
function StarRow({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={size}
          className={i < Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'} />
      ))}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProductPage() {
  const { slug }                     = useParams<{ slug: string }>();
  const { data: product, isLoading } = useProduct(slug);
  const { addItem, isAdding }        = useCart();
  const { isInWishlist, addItem: addWish, removeItem: rmWish } = useWishlist();

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [mainImg, setMainImg] = useState(0);
  const [qty,     setQty]     = useState(1);

  const { data: sales = [] } = useQuery({
    queryKey:        ['flash-sales'],
    queryFn:         flashSaleApi.getActive,
    staleTime:       60_000,
    refetchInterval: 60_000,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews', (product as any)?.id],
    queryFn:  () => reviewApi.getProductReviews((product as any).id),
    enabled:  !!(product as any)?.id,
  });

  if (isLoading) return (
    <div className="container-page py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="aspect-square skeleton rounded-2xl" />
        <div className="space-y-4">
          <div className="h-8 skeleton rounded w-3/4" /><div className="h-6 skeleton rounded w-1/3" />
          <div className="h-10 skeleton rounded w-1/2" /><div className="h-12 skeleton rounded" />
        </div>
      </div>
    </div>
  );
  if (!product) return <div className="container-page py-16 text-center text-gray-400">Product not found</div>;

  const p       = product as ProductDetail;
  const variant = selectedVariant ?? p.variants?.[0];

  // Flash sale lookup for this variant
  let flashSaleItem: any = null;
  let flashSaleEndsAt    = '';
  for (const sale of sales as FlashSale[]) {
    const found = (sale.items ?? []).find((i: any) => i.variant_id === variant?.id);
    if (found) { flashSaleItem = found; flashSaleEndsAt = sale.ends_at; break; }
  }

  const origP   = Number(variant?.price ?? 0);
  const price   = flashSaleItem?.sale_price ?? Number(variant?.discount_price ?? origP);
  const hasDis  = flashSaleItem || (variant?.discount_price && Number(variant.discount_price) < origP);
  const discPct = flashSaleItem
    ? Math.round((1 - flashSaleItem.sale_price / origP) * 100)
    : variant?.discount_price ? Math.round((1 - Number(variant.discount_price) / origP) * 100) : 0;
  const inStock = (variant?.stock_qty ?? 0) > 0;
  const inWish  = isInWishlist(p.id);
  const isFlash = !!flashSaleItem;

  // ── FIX: coerce avg_rating and review_count to numbers ──
  // PostgreSQL returns NUMERIC columns as strings in Node.js/pg driver.
  const avgRating   = Number(p.avg_rating   ?? 0);
  const reviewCount = Number(p.review_count ?? 0);

  const attrMap: Record<string, Set<string>> = {};
  p.variants?.forEach(v => v.attributes?.forEach(a => {
    if (!attrMap[a.name]) attrMap[a.name] = new Set();
    attrMap[a.name].add(a.value);
  }));

  return (
    <div className="container-page py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-6 flex-wrap">
        <Link href="/" className="hover:text-gray-600">Home</Link>
        <ChevronRight size={12} />
        {p.category_name && (
          <><Link href={`/category/${p.category_slug}`} className="hover:text-gray-600">{p.category_name}</Link><ChevronRight size={12} /></>
        )}
        <span className="text-gray-700 truncate max-w-[200px]">{p.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12">
        {/* Images */}
        <div>
          <div className={clsx('aspect-square rounded-2xl overflow-hidden bg-gray-100 mb-3 relative', isFlash && 'ring-2 ring-red-400/40')}>
            {isFlash && (
              <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-md">
                <Zap size={12} className="fill-white" /> Flash Sale · -{discPct}% off
              </div>
            )}
            {p.images?.[mainImg]?.url
              ? <Image src={p.images[mainImg].url} alt={p.name} width={600} height={600} className="w-full h-full object-cover" priority />
              : <div className="w-full h-full bg-gray-200 flex items-center justify-center"><ShoppingCart size={40} className="text-gray-300" /></div>
            }
          </div>
          {(p.images?.length ?? 0) > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {p.images.map((img, i) => (
                <button key={img.id} onClick={() => setMainImg(i)}
                  className={clsx('flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors',
                    mainImg === i ? 'border-violet-600' : 'border-transparent')}>
                  <Image src={img.url} alt="" width={64} height={64} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 leading-tight mb-2">{p.name}</h1>

          {/* Rating display — uses coerced values */}
          {reviewCount > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <div className="flex"><StarRow rating={avgRating} /></div>
              <span className="text-sm font-medium text-gray-700">{avgRating.toFixed(1)}</span>
              <span className="text-sm text-gray-400">({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})</span>
            </div>
          )}

          {/* Flash sale banner */}
          {isFlash && flashSaleEndsAt && (
            <FlashPriceBanner
              salePrice={flashSaleItem.sale_price}
              origPrice={origP}
              endsAt={flashSaleEndsAt}
              soldQty={flashSaleItem.sold_qty}
              maxQty={flashSaleItem.max_qty}
            />
          )}

          {/* Price */}
          <div className="flex items-baseline gap-3 mb-5">
            <span className={clsx('text-3xl font-bold', isFlash ? 'text-red-600' : 'text-violet-600')}>
              {formatETB(price)}
            </span>
            {hasDis && (
              <>
                <span className="text-lg text-gray-400 line-through">{formatETB(origP)}</span>
                <span className="badge bg-red-100 text-red-700">-{discPct}%</span>
              </>
            )}
          </div>

          {/* Variants */}
          {Object.entries(attrMap).map(([attrName, values]) => {
            const selVal = variant?.attributes?.find(a => a.name === attrName)?.value;
            return (
              <div key={attrName} className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2 capitalize">
                  {attrName}: <span className="text-gray-900 font-semibold">{selVal}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {Array.from(values).map(val => {
                    const mv   = p.variants?.find(v => v.attributes?.some(a => a.name === attrName && a.value === val));
                    const attr = mv?.attributes?.find(a => a.name === attrName);
                    const isSel = selVal === val;
                    if (attr?.color_hex) return (
                      <button key={val} onClick={() => mv && setSelectedVariant(mv)}
                        className={clsx('w-8 h-8 rounded-full border-2 transition-all', isSel ? 'border-violet-600 scale-110' : 'border-gray-300')}
                        style={{ backgroundColor: attr.color_hex }} title={attr.display_value} />
                    );
                    return (
                      <button key={val} onClick={() => mv && setSelectedVariant(mv)}
                        className={clsx('px-3 py-1.5 text-sm rounded-lg border transition-colors',
                          isSel ? 'border-violet-600 bg-violet-50 text-violet-700 font-medium' : 'border-gray-200 text-gray-700 hover:border-gray-400')}>
                        {attr?.display_value ?? val}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* SKU + stock */}
          <div className="flex items-center gap-4 text-sm mb-5">
            <span className="text-gray-500">SKU: <span className="font-mono text-gray-700">{variant?.sku}</span></span>
            <span className={inStock ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
              {inStock ? `${variant?.stock_qty} in stock` : 'Out of stock'}
            </span>
          </div>

          {/* Qty + cart */}
          <div className="flex gap-3 mb-5">
            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
              <button onClick={() => setQty(q => Math.max(1, q - 1))} className="px-3 py-2.5 hover:bg-gray-50 text-gray-700">−</button>
              <span className="px-4 py-2.5 text-sm font-medium border-x border-gray-300 min-w-[40px] text-center">{qty}</span>
              <button onClick={() => setQty(q => Math.min(variant?.stock_qty ?? 1, q + 1))} className="px-3 py-2.5 hover:bg-gray-50 text-gray-700">+</button>
            </div>
            <button
              onClick={() => variant && addItem({ variantId: variant.id, quantity: qty })}
              disabled={!inStock || isAdding}
              className={clsx(
                'flex-1 gap-2 flex items-center justify-center font-semibold rounded-lg px-4 py-2.5 transition-colors disabled:opacity-50',
                isFlash ? 'bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/20' : 'btn-primary'
              )}
            >
              {isFlash ? <Zap size={17} className="fill-white" /> : <ShoppingCart size={17} />}
              {inStock ? (isFlash ? 'Add — Flash price' : 'Add to cart') : 'Out of stock'}
            </button>
            <button onClick={() => inWish ? rmWish(p.id) : addWish(p.id)}
              className={clsx('p-3 rounded-lg border transition-colors',
                inWish ? 'border-red-300 bg-red-50 text-red-500' : 'border-gray-300 text-gray-500 hover:border-red-300 hover:text-red-500')}>
              <Heart size={20} className={inWish ? 'fill-red-500' : ''} />
            </button>
          </div>

          {/* Trust badges */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            {[{ icon: Truck, text: 'Fast delivery' }, { icon: RotateCcw, text: 'Easy returns' }, { icon: Shield, text: 'Secure payment' }].map(({ icon: Icon, text }) => (
              <div key={text} className="flex flex-col items-center gap-1 p-2.5 bg-gray-50 rounded-xl text-center">
                <Icon size={17} className="text-violet-600" />
                <span className="text-xs text-gray-600">{text}</span>
              </div>
            ))}
          </div>

          {/* Seller */}
          <div className="card p-4 bg-gray-50">
            <p className="text-xs text-gray-400 mb-1">Sold by</p>
            <p className="font-medium text-violet-600">{p.business_name}</p>
            {p.return_policy && <p className="text-xs text-gray-500 mt-1">{p.return_policy}</p>}
          </div>
        </div>
      </div>

      {/* Description */}
      {(p.full_description || p.short_description) && (
        <div className="mb-10">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Description</h2>
          <div className="prose prose-sm max-w-none text-gray-600 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: p.full_description || p.short_description || '' }} />
        </div>
      )}

      {/* Tags */}
      {p.tags?.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-10">
          {p.tags.map(t => (
            <Link key={t} href={`/search?q=${encodeURIComponent(t)}`}
              className="badge border border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-700 py-1 px-3">
              #{t}
            </Link>
          ))}
        </div>
      )}

      {/* ── REVIEWS ── */}
      <div className="mb-10 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Customer reviews
            {reviewCount > 0 && <span className="ml-2 text-sm font-normal text-gray-400">({reviewCount})</span>}
          </h2>
          {/* Overall star summary — uses coerced values */}
          {reviewCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex"><StarRow rating={avgRating} size={14} /></div>
              <span className="text-sm font-bold text-gray-700">{avgRating.toFixed(1)}</span>
              <span className="text-xs text-gray-400">/ 5</span>
            </div>
          )}
        </div>

        {p.id && <ReviewForm productId={p.id} />}

        {(reviews as Review[]).length === 0 ? (
          <p className="text-gray-400 text-sm">No reviews yet. Be the first to review this product!</p>
        ) : (
          <div className="space-y-4">
            {(reviews as Review[]).map(r => {
              // FIX: coerce each review's rating to a number
              const rRating = Number(r.rating ?? 0);
              return (
                <div key={r.id} className="card p-4">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 text-sm font-bold shrink-0">
                      {r.first_name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900">{r.first_name} {r.last_name}</p>
                        <span className="text-xs text-gray-400">
                          {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5 mt-0.5">
                        <StarRow rating={rRating} size={12} />
                      </div>
                    </div>
                  </div>
                  {r.title   && <p className="text-sm font-semibold text-gray-900 mb-1">{r.title}</p>}
                  {r.comment && <p className="text-sm text-gray-600 leading-relaxed">{r.comment}</p>}
                  {r.is_verified_purchase && (
                    <div className="flex items-center gap-1 mt-2">
                      <CheckCircle2 size={12} className="text-green-500" />
                      <p className="text-xs text-green-600 font-medium">Verified purchase</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Related */}
      {p.related?.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Related products</h2>
          <ProductGrid products={p.related} />
        </div>
      )}
    </div>
  );
}