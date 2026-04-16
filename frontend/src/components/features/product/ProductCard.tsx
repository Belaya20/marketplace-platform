'use client';
// src/components/features/product/ProductCard.tsx
import Image from 'next/image';
import Link  from 'next/link';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  Heart, ShoppingBag, ShoppingCart, Star, Zap, ArrowRight,
  Smartphone, Tablet, Laptop, Monitor, Tv, Printer, Cpu,
  Speaker, Headphones, Mic, Radio, Plug, Shirt, Watch,
  Glasses, Briefcase, Sofa, UtensilsCrossed, Sparkles,
  Scissors, HeartPulse, Coffee, Dumbbell, Bike, Car,
  Wrench, Music, Camera, Palette, BookOpen,
  Gamepad2, Baby, PawPrint, Tent, Flower2,
  Copy, Check, Tag, Clock, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useCart, useWishlist, formatETB } from '@/hooks';
import { cmsApi, flashSaleApi, productApi, catalogApi } from '@/lib/api';
import api from '@/lib/api';
import type { Product, Category, FlashSale, Banner } from '@/types';
import clsx from 'clsx';

// ── Flash sale map ────────────────────────────────────────────────────────────
function useFlashSaleMap(enabled = true) {
  const { data: sales = [] } = useQuery({
    queryKey:        ['flash-sales'],
    queryFn:         flashSaleApi.getActive,
    staleTime:       60_000,
    refetchInterval: 60_000,
    enabled,          
  });

  return useMemo(() => {
    const map: Record<string, {
      sale_price: number; max_qty: number; sold_qty: number; ends_at: string;
    }> = {};
    for (const sale of sales as FlashSale[]) {
      for (const item of sale.items ?? []) {
        map[(item as any).variant_id] = {
          sale_price: Number((item as any).sale_price),
          max_qty:    Number((item as any).max_qty),
          sold_qty:   Number((item as any).sold_qty),
          ends_at:    sale.ends_at,
        };
      }
    }
    return map;
  }, [sales]);
}

// ── Live countdown ────────────────────────────────────────────────────────────
function useCountdown(endDate: string) {
  const calc = useCallback(() => {
    const diff = new Date(endDate).getTime() - Date.now();
    if (diff <= 0) return { h: 0, m: 0, s: 0, over: true };
    return {
      h:    Math.floor(diff / 3_600_000),
      m:    Math.floor((diff % 3_600_000) / 60_000),
      s:    Math.floor((diff % 60_000) / 1_000),
      over: false,
    };
  }, [endDate]);

  const [time, setTime] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setTime(calc()), 1_000);
    return () => clearInterval(id);
  }, [calc]);
  return time;
}

function pad(n: number) { return String(n).padStart(2, '0'); }

// ── PRODUCT CARD ──────────────────────────────────────────────────────────────
interface CardProps { product: Product; showAddToCart?: boolean; flashMap?: Record<string, any>; }

export function ProductCard({ product, showAddToCart = true, flashMap }: CardProps) {
  const { addItem, isAdding } = useCart();
  const { isInWishlist, addItem: addWish, removeItem: rmWish } = useWishlist();

  // FIX: only run the query when no flashMap is provided by parent
  const localFlashMap = useFlashSaleMap(!flashMap);
  const map           = flashMap ?? localFlashMap;

  const variantId  = (product as any).variant_id ?? (product as any).default_variant_id ?? product.id;
  const flashItem  = map[variantId];
  const inWish     = isInWishlist(product.id);
  const origP      = Number(product.price ?? 0);
  const salePrice  = flashItem?.sale_price ?? null;
  const regPrice   = product.discount_price ? Number(product.discount_price) : origP;
  const price      = salePrice ?? regPrice;
  const hasDis     = salePrice !== null || (product.discount_price && Number(product.discount_price) < origP);
  const discPct    = salePrice && origP > 0
    ? Math.round((1 - salePrice / origP) * 100)
    : product.discount_price && origP > 0
      ? Math.round((1 - Number(product.discount_price) / origP) * 100)
      : 0;
  const outOfStock = (product.stock_qty ?? 1) === 0;
  const isFlash    = salePrice !== null;

  const avgRating   = Number(product.avg_rating   ?? 0);
  const reviewCount = Number(product.review_count ?? 0);

  return (
    <div className={clsx(
      'group flex flex-col gap-2.5 sm:gap-3 relative w-full rounded-xl p-2 sm:p-2.5 bg-white border',
      'transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]',
      // FIX: min-w-0 prevents the card itself from overflowing its grid cell
      'min-w-0',
      isFlash
        ? 'border-red-100 hover:border-red-200 hover:shadow-[0_8px_30px_rgba(239,68,68,0.12)]'
        : 'border-transparent hover:border-gray-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)]'
    )}>
      {isFlash && (
        <div className="absolute inset-0 rounded-xl ring-1 ring-red-400/20 pointer-events-none z-0" />
      )}

      {/* ── Image ── */}
      <div className="relative aspect-square w-full bg-gray-50 rounded-lg overflow-hidden">
        <Link href={`/product/${product.slug}`} className="block w-full h-full">
          {product.primary_image ? (
            <Image
              src={product.primary_image}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-105"
              sizes="(max-width:480px)50vw,(max-width:768px)33vw,(max-width:1280px)25vw,20vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-300">
              <ShoppingCart size={28} strokeWidth={1.5} />
            </div>
          )}
        </Link>

        {/* FIX: Badges — max-w + truncate so long % values don't overflow */}
        <div className="absolute top-2 left-2 flex flex-col items-start gap-1 z-20 max-w-[60%]">
          {isFlash && (
            <span className="flex items-center gap-0.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm shadow-red-500/30 animate-pulse whitespace-nowrap">
              <Zap size={8} className="fill-white shrink-0" />FLASH
            </span>
          )}
          {discPct > 0 && (
            // FIX: truncate + max-w prevents badge text pushing outside card
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap max-w-full truncate">
              -{discPct}%
            </span>
          )}
          {outOfStock && (
            <span className="bg-gray-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
              Sold out
            </span>
          )}
        </div>

        {/* Wishlist */}
        <button
          onClick={e => { e.preventDefault(); inWish ? rmWish(product.id) : addWish(product.id); }}
          className="absolute top-2 right-2 p-1.5 sm:p-2 bg-white/90 backdrop-blur-md rounded-full shadow-sm z-20
            opacity-100 sm:opacity-0 sm:-translate-y-1
            sm:group-hover:translate-y-0 sm:group-hover:opacity-100
            transition-all duration-300 hover:bg-white active:scale-95"
          aria-label={inWish ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart size={14} strokeWidth={2}
            className={clsx('transition-colors duration-300',
              inWish ? 'fill-red-500 text-red-500' : 'text-gray-400 hover:text-gray-900')} />
        </button>

        {/* FIX: Flash countdown — z-10 so add-to-cart button (z-20) renders above it */}
        {isFlash && flashItem && (
          <FlashCountdownBar
            endsAt={flashItem.ends_at}
            soldQty={flashItem.sold_qty}
            maxQty={flashItem.max_qty}
          />
        )}

        {/* Add to cart — FIX: z-20 so it's always above the flash bar */}
        {showAddToCart && (
          <div className={clsx(
            'absolute bottom-0 left-0 w-full p-1.5 sm:p-2 z-20',
            'transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]',
            'translate-y-0 opacity-100',
            'sm:translate-y-[110%] sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100'
          )}>
            <button
              onClick={e => { e.preventDefault(); addItem({ variantId, quantity: 1 }); }}
              disabled={isAdding || outOfStock}
              className={clsx(
                'w-full text-white text-xs sm:text-sm font-semibold py-2 sm:py-2.5 rounded-md',
                'transition-colors shadow-lg disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none',
                isFlash
                  ? 'bg-red-500/95 hover:bg-red-600 shadow-red-500/25'
                  : 'bg-violet-600/95 hover:bg-violet-700 shadow-violet-600/25'
              )}
            >
              {outOfStock ? 'Out of stock' : isFlash ? '⚡ Flash price' : 'Add to cart'}
            </button>
          </div>
        )}
      </div>

      {/* ── Info — FIX: min-w-0 + overflow-hidden at every level ── */}
      <div className="flex flex-col gap-1 px-0.5 sm:px-1 min-w-0 overflow-hidden">
        {/* Category + rating row */}
        <div className="flex justify-between items-center gap-1.5 min-w-0">
          {/* FIX: min-w-0 + truncate so category name doesn't push rating off */}
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide truncate min-w-0">
            {product.category_name ?? product.brand_name ?? ''}
          </p>
          {reviewCount > 0 && (
            <div className="flex items-center gap-0.5 shrink-0">
              <Star size={9} className="fill-amber-400 text-amber-400" />
              <span className="text-[10px] font-semibold text-gray-600">{avgRating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Product name */}
        <Link href={`/product/${product.slug}`} className="block min-w-0">
          <h3 className={clsx(
            'text-xs sm:text-sm font-medium line-clamp-2 leading-snug transition-colors',
            isFlash ? 'text-gray-900 group-hover:text-red-600' : 'text-gray-900 group-hover:text-violet-600'
          )}>
            {product.name}
          </h3>
        </Link>

        {/* FIX: Price row — flex-wrap + min-w-0 prevents ETB overflow on small screens */}
        <div className="flex items-baseline gap-1.5 flex-wrap min-w-0 mt-0.5">
          <span className={clsx(
            'text-sm sm:text-base font-bold tracking-tight shrink-0',
            isFlash ? 'text-red-600' : 'text-violet-600'
          )}>
            {formatETB(price)}
          </span>
          {hasDis && origP > price && (
            // FIX: shrink-0 so the strikethrough price doesn't get squeezed to nothing
            <span className="text-[10px] sm:text-xs text-gray-400 line-through font-medium shrink-0">
              {formatETB(origP)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Flash countdown bar ───────────────────────────────────────────────────────
// FIX: z-10 (was implicitly above add-to-cart) — now below z-20 add-to-cart
function FlashCountdownBar({ endsAt, soldQty, maxQty }: {
  endsAt: string; soldQty: number; maxQty: number;
}) {
  const { h, m, s, over } = useCountdown(endsAt);
  if (over) return null;
  const pct = maxQty > 0 ? Math.min((soldQty / maxQty) * 100, 100) : 0;

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-900/80 to-transparent px-2 pb-10 sm:pb-11 pt-6 z-10 pointer-events-none">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] sm:text-[10px] font-bold text-white/80 uppercase tracking-wide">
          {soldQty}/{maxQty}
        </span>
        <span className="text-[9px] sm:text-[10px] font-mono font-bold text-amber-300">
          {pad(h)}:{pad(m)}:{pad(s)}
        </span>
      </div>
      <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
        <div
          className="h-full bg-red-400 rounded-full transition-all duration-1000"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── PRODUCT GRID ──────────────────────────────────────────────────────────────
export function ProductGrid({ products }: { products: Product[] }) {
  // FIX: flashMap built once here, passed to every card — no duplicate queries
  const flashMap = useFlashSaleMap(true);

  if (!products.length) return (
    <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
      <ShoppingCart size={36} strokeWidth={1.5} className="mb-3 text-gray-300" />
      <p className="text-sm font-medium">No products found</p>
    </div>
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3 sm:gap-4">
      {products.map(p => (
        <ProductCard key={p.id} product={p} flashMap={flashMap} />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// HOME BANNERS
// ═══════════════════════════════════════════════════════════════════
export function HomeBanners() {
  const { data: banners = [] } = useQuery({
    queryKey: ['banners'],
    queryFn:  cmsApi.getBanners,
    staleTime: 300_000,
  });

  const list = banners as Banner[];

  if (!list.length) return (
    <div className="container-page py-4 sm:py-6">
      <div className="bg-gradient-to-br from-violet-600 to-violet-800 rounded-2xl h-48 sm:h-64 md:h-72 flex items-center justify-center px-6 sm:px-8 shadow-md">
        <div className="text-center text-white max-w-lg">
          {/* FIX: text-xl on mobile, scale up on larger screens */}
          <h1 className="text-xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-3 leading-tight tracking-tight">
            Welcome to AddisMarket
          </h1>
          <p className="text-violet-100 text-xs sm:text-sm md:text-base mb-4 sm:mb-6">
            Discover thousands of products from verified sellers
          </p>
          <Link href="/search"
            className="inline-block bg-white text-violet-700 font-bold px-5 py-2 sm:px-8 sm:py-3 rounded-xl hover:bg-violet-50 transition-colors shadow-sm active:scale-95 text-sm sm:text-base">
            Shop now
          </Link>
        </div>
      </div>
    </div>
  );

  if (list.length === 1) return (
    <div className="container-page py-4 sm:py-6">
      <BannerSlide banner={list[0]} priority />
    </div>
  );

  return (
    <div className="container-page py-4 sm:py-6">
      <BannerCarousel banners={list} />
    </div>
  );
}

function BannerSlide({ banner: b, priority = false, className }: {
  banner: Banner; priority?: boolean; className?: string;
}) {
  return (
    <Link
      href={b.link_url || '#'}
      className={clsx(
        'group block relative h-48 sm:h-64 md:h-80 overflow-hidden shadow-lg',
        className ?? 'rounded-2xl'
      )}
    >
      <Image
        src={b.image_url} alt={b.title} fill priority={priority}
        className="object-cover transition-transform duration-[2s] ease-out group-hover:scale-[1.03]"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
      <div className="absolute inset-0 flex items-center px-5 sm:px-8 md:px-14">
        <div className="text-white max-w-xl min-w-0">
          {/* FIX: text-xl on mobile */}
          <h2 className="text-xl sm:text-3xl md:text-4xl font-black mb-1.5 sm:mb-2 leading-tight tracking-tight
            transition-transform duration-500 group-hover:-translate-y-1 line-clamp-2">
            {b.title}
          </h2>
          {b.subtitle && (
            <p className="text-white/80 text-xs sm:text-base mb-3 sm:mb-6 opacity-90
              transition-transform duration-500 delay-75 group-hover:-translate-y-1 line-clamp-2">
              {b.subtitle}
            </p>
          )}
          {b.cta_text && (
            <span className="inline-flex items-center gap-1.5 sm:gap-2 bg-white text-gray-900 font-bold
              text-xs sm:text-sm px-4 py-2 sm:px-6 sm:py-3 rounded-xl shadow-lg
              transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-xl">
              {b.cta_text} <ArrowRight size={13} />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [current,   setCurrent]   = useState(0);
  const [paused,    setPaused]    = useState(false);
  const [animating, setAnimating] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const count = banners.length;

  const goTo = useCallback((idx: number) => {
    if (animating) return;
    setAnimating(true);
    setCurrent(((idx % count) + count) % count);
    setTimeout(() => setAnimating(false), 500);
  }, [animating, count]);

  const prev = useCallback(() => goTo(current - 1), [current, goTo]);
  const next = useCallback(() => goTo(current + 1), [current, goTo]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(next, 5000);
    return () => clearInterval(id);
  }, [paused, next]);

  return (
    <div
      className="relative rounded-2xl overflow-hidden shadow-lg"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        if (touchStartX.current === null) return;
        const diff = touchStartX.current - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 40) diff > 0 ? next() : prev();
        touchStartX.current = null;
      }}
    >
      <div className="relative h-48 sm:h-64 md:h-80">
        {banners.map((b, i) => (
          <div
            key={b.id}
            className={clsx(
              'absolute inset-0 transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]',
              i === current                             ? 'opacity-100 translate-x-0 z-10'
              : i === ((current - 1 + count) % count)  ? 'opacity-0 -translate-x-8 z-0'
                                                       : 'opacity-0 translate-x-8 z-0'
            )}
          >
            <BannerSlide banner={b} priority={i === 0} className="" />
          </div>
        ))}
      </div>

      {/* Nav buttons */}
      <button onClick={prev} aria-label="Previous"
        className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full
          bg-black/30 backdrop-blur-sm text-white flex items-center justify-center
          hover:bg-black/50 active:scale-95 transition-all duration-200">
        <ChevronLeft size={16} />
      </button>
      <button onClick={next} aria-label="Next"
        className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full
          bg-black/30 backdrop-blur-sm text-white flex items-center justify-center
          hover:bg-black/50 active:scale-95 transition-all duration-200">
        <ChevronRight size={16} />
      </button>

      {/* Dots */}
      <div className="absolute bottom-3 left-0 right-0 z-20 flex items-center justify-center gap-1.5">
        {banners.map((_, i) => (
          <button key={i} onClick={() => goTo(i)} aria-label={`Banner ${i + 1}`}
            className={clsx(
              'rounded-full transition-all duration-300',
              i === current ? 'w-5 h-1.5 bg-white shadow-sm' : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/80'
            )} />
        ))}
      </div>

      {!paused && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10 z-20 overflow-hidden">
          <ProgressBar key={current} duration={5000} />
        </div>
      )}

      <div className="absolute top-3 right-3 z-20 bg-black/30 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
        {current + 1}/{count}
      </div>
    </div>
  );
}

function ProgressBar({ duration }: { duration: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setWidth(100));
    return () => cancelAnimationFrame(t);
  }, []);
  return (
    <div className="h-full bg-white/60 rounded-full"
      style={{ width: `${width}%`, transition: `width ${duration}ms linear` }} />
  );
}

// ── FLASH SALE SECTION ────────────────────────────────────────────────────────
export function FlashSaleSection() {
  const { data: sales = [] } = useQuery({
    queryKey:        ['flash-sales'],
    queryFn:         flashSaleApi.getActive,
    staleTime:       60_000,
    refetchInterval: 60_000,
  });

  const sale = (sales as FlashSale[])[0];
  if (!sale?.items?.length) return null;

  return (
    <section className="container-page py-4 sm:py-6">
      <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-100 rounded-2xl p-4 sm:p-6 md:p-7 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full -translate-y-32 translate-x-32 pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 sm:mb-6 gap-3 relative z-10">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="bg-red-500 text-white p-1.5 sm:p-2 rounded-lg shadow-sm shadow-red-500/30 shrink-0">
              <Zap size={18} className="fill-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {/* FIX: truncate sale title if too long */}
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 tracking-tight truncate max-w-[180px] sm:max-w-none">
                  {sale.title}
                </h2>
                <span className="flex items-center gap-1 bg-red-500 text-white text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded shadow-sm uppercase tracking-wider shrink-0">
                  <span className="w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full bg-white animate-ping" />LIVE
                </span>
              </div>
              {(sale as any).description && (
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5 truncate">{(sale as any).description}</p>
              )}
            </div>
          </div>
          <FlashSaleCountdown endsAt={sale.ends_at} />
        </div>

        {/* FIX: 2 cols on tiny screens, 3 on sm, 5 on lg */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 sm:gap-4 relative z-10">
          {(sale.items as any[]).slice(0, 5).map((item: any) => (
            <FlashSaleCard key={item.id} item={item} />
          ))}
        </div>

        {(sale.items as any[]).length > 5 && (
          <div className="mt-4 text-center relative z-10">
            <Link href="/search?flash=1"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-red-600 hover:text-red-700 bg-white/80 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-red-100 hover:bg-white transition-all">
              View all {(sale.items as any[]).length} deals <ArrowRight size={13} />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function FlashSaleCountdown({ endsAt }: { endsAt: string }) {
  const { h, m, s, over } = useCountdown(endsAt);
  if (over) return <span className="text-xs text-gray-400 font-medium">Sale ended</span>;
  return (
    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
      <span className="text-xs font-medium text-gray-500 hidden sm:block">Ends in</span>
      <div className="flex items-center gap-0.5 sm:gap-1 font-mono">
        {[pad(h), pad(m), pad(s)].map((unit, i) => (
          <span key={i} className="flex items-center gap-0.5 sm:gap-1">
            <span className="bg-white border border-red-200 text-red-700 font-bold text-xs sm:text-sm px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-lg shadow-sm min-w-[28px] sm:min-w-[36px] text-center tabular-nums">
              {unit}
            </span>
            {i < 2 && <span className="text-red-400 font-bold text-xs sm:text-sm">:</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

function FlashSaleCard({ item }: { item: any }) {
  const { addItem, isAdding } = useCart();
  const pct     = item.max_qty > 0 ? Math.min((Number(item.sold_qty) / Number(item.max_qty)) * 100, 100) : 0;
  const discPct = item.original_price && Number(item.original_price) > Number(item.sale_price)
    ? Math.round(((Number(item.original_price) - Number(item.sale_price)) / Number(item.original_price)) * 100)
    : 0;

  return (
    <Link href={`/product/${item.slug}`}
      className="group bg-white rounded-xl overflow-hidden shadow-sm border border-transparent
        hover:border-red-100 hover:shadow-lg hover:shadow-red-500/10 transition-all duration-300 flex flex-col min-w-0">
      <div className="aspect-square bg-gray-50 overflow-hidden relative">
        {item.image_url ? (
          <Image src={item.image_url} alt={item.name} fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width:640px)50vw,20vw" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-200">
            <ShoppingBag strokeWidth={1.5} size={28} />
          </div>
        )}
        {discPct > 0 && (
          <div className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">
            -{discPct}%
          </div>
        )}
      </div>
      {/* FIX: min-w-0 + overflow-hidden to prevent text overflow */}
      <div className="p-2 sm:p-3 flex flex-col flex-1 gap-1 min-w-0 overflow-hidden">
        <h3 className="text-xs sm:text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-red-600 transition-colors leading-snug">
          {item.name}
        </h3>
        {/* FIX: flex-wrap for price row */}
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <p className="text-red-600 font-bold text-sm sm:text-base shrink-0">{formatETB(Number(item.sale_price))}</p>
          {item.original_price && Number(item.original_price) > Number(item.sale_price) && (
            <p className="text-[10px] sm:text-xs text-gray-400 line-through shrink-0">{formatETB(Number(item.original_price))}</p>
          )}
        </div>
        {item.max_qty > 0 && (
          <div className="mt-auto pt-1">
            <div className="flex justify-between text-[9px] sm:text-[10px] font-medium mb-1">
              <span className="text-gray-500">{item.sold_qty} sold</span>
              <span className={pct > 80 ? 'text-red-500 font-bold' : 'text-gray-400'}>
                {Number(item.max_qty) - Number(item.sold_qty)} left
              </span>
            </div>
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <div className={clsx('h-full rounded-full transition-all duration-700', pct > 80 ? 'bg-red-500' : 'bg-orange-400')}
                style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); addItem({ variantId: item.variant_id, quantity: 1 }); }}
          disabled={isAdding}
          className="mt-1.5 w-full bg-red-500 hover:bg-red-600 text-white text-[10px] sm:text-xs font-bold py-1.5 sm:py-2 rounded-lg transition-colors shadow-sm shadow-red-500/20 disabled:opacity-60 flex items-center justify-center gap-1"
        >
          <Zap size={9} className="fill-white shrink-0" /> Add to cart
        </button>
      </div>
    </Link>
  );
}

// ── DISCOUNT CODES STRIP ──────────────────────────────────────────────────────
export function DiscountCodesStrip() {
  const { data: codes = [] } = useQuery({
    queryKey: ['public-discounts'],
    queryFn:  () => api.get('/discounts/public').then((r: any) => r.data.data ?? []),
    staleTime: 120_000,
  });
  if (!(codes as any[]).length) return null;

  return (
    <section className="container-page">
      <div className="flex items-center gap-2.5 sm:gap-3 mb-3 sm:mb-4 flex-wrap">
        <Tag size={15} className="text-violet-600 shrink-0" />
        <h2 className="text-base sm:text-lg font-bold text-gray-900">Discount codes</h2>
        <p className="text-xs sm:text-sm text-gray-400 hidden sm:block">Copy a code and use it at checkout</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
        {(codes as any[]).map((code: any) => (
          <DiscountCodePill key={code.code} code={code} />
        ))}
      </div>
    </section>
  );
}

function DiscountCodePill({ code }: { code: any }) {
  const [copied, setCopied] = useState(false);

  const expiryLabel = useMemo(() => {
    if (!code.expires_at) return '';
    const diff = new Date(code.expires_at).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const days  = Math.floor(diff / 86_400_000);
    if (days > 1) return `${days}d left`;
    const hours = Math.floor(diff / 3_600_000);
    if (hours > 0) return `${hours}h left`;
    return 'Expiring soon';
  }, [code.expires_at]);

  const discLabel = code.type === 'percentage'
    ? `${code.value}% off`
    : code.type === 'fixed_amount'
      ? `ETB ${code.value} off`
      : 'Free shipping';

  const copy = (e: React.MouseEvent) => {
    e.preventDefault();
    navigator.clipboard.writeText(code.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <button onClick={copy}
      className="group relative flex items-center gap-0 rounded-xl overflow-hidden
        border border-dashed border-violet-300 hover:border-violet-500
        transition-all duration-200 hover:shadow-md hover:shadow-violet-500/10 text-left w-full min-w-0">
      <div className="w-1.5 sm:w-2 self-stretch bg-violet-500 group-hover:bg-violet-600 transition-colors shrink-0" />
      <div className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-violet-50/50 group-hover:bg-violet-50 transition-colors min-w-0 overflow-hidden">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 overflow-hidden">
            {/* FIX: truncate so long codes don't overflow on tiny screens */}
            <p className="font-mono font-bold text-violet-700 tracking-widest text-xs sm:text-sm truncate">
              {code.code}
            </p>
            <p className="text-[11px] sm:text-xs font-semibold text-gray-700 mt-0.5">{discLabel}</p>
            {code.min_order > 0 && (
              <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5">
                Min. ETB {code.min_order}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className={clsx(
              'flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-semibold px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg transition-all whitespace-nowrap',
              copied ? 'bg-emerald-500 text-white' : 'bg-violet-600 text-white group-hover:bg-violet-700'
            )}>
              {copied ? <><Check size={10} />Copied!</> : <><Copy size={10} />Copy</>}
            </div>
            {expiryLabel && (
              <span className="flex items-center gap-0.5 text-[9px] sm:text-[10px] text-gray-400 font-medium whitespace-nowrap">
                <Clock size={8} />{expiryLabel}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ── PRODUCT SECTION ───────────────────────────────────────────────────────────
export function ProductSection({ title, params, apiKey }: {
  title: string; params: any; apiKey: string;
}) {
  const { data } = useQuery({
    queryKey: ['products', apiKey, params],
    queryFn:  () => productApi.search({ ...params, limit: 10 }),
    staleTime: 120_000,
  });
  const products = (data?.data ?? []) as Product[];
  if (!products.length) return null;

  return (
    <div className="py-5 sm:py-8">
      <div className="flex items-center justify-between mb-4 sm:mb-6 gap-3">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 tracking-tight">{title}</h2>
        <Link href={`/search?sort=${params.sort}`}
          className="group flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm font-semibold text-violet-600 hover:text-violet-800 transition-colors bg-violet-50 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-violet-100 shrink-0">
          View all <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
      <ProductGrid products={products} />
    </div>
  );
}

// ── CATEGORY GRID ─────────────────────────────────────────────────────────────
const ICON_MAP: Array<[string[], React.ComponentType<any>]> = [
  [['phone', 'mobile'],           Smartphone   ],
  [['tablet', 'ipad'],            Tablet       ],
  [['laptop', 'computer'],        Laptop       ],
  [['monitor', 'screen'],         Monitor      ],
  [['tv', 'television'],          Tv           ],
  [['print'],                     Printer      ],
  [['cpu', 'processor'],          Cpu          ],
  [['audio', 'speaker'],          Speaker      ],
  [['headphone', 'earphone'],     Headphones   ],
  [['mic'],                       Mic          ],
  [['radio'],                     Radio        ],
  [['tech', 'electronic'],        Plug         ],
  [['cloth', 'fashion'],          Shirt        ],
  [['watch', 'jewelry'],          Watch        ],
  [['glass', 'eyewear'],          Glasses      ],
  [['bag', 'luggage'],            Briefcase    ],
  [['home', 'furniture'],         Sofa         ],
  [['kitchen', 'cook'],           UtensilsCrossed],
  [['beauty', 'cosmetic'],        Sparkles     ],
  [['hair', 'salon'],             Scissors     ],
  [['health', 'medical'],         HeartPulse   ],
  [['food', 'grocery'],           Coffee       ],
  [['sport', 'fitness'],          Dumbbell     ],
  [['bike', 'bicycle'],           Bike         ],
  [['outdoor', 'camp'],           Tent         ],
  [['garden', 'flower'],          Flower2      ],
  [['auto', 'car'],               Car          ],
  [['tool', 'hardware'],          Wrench       ],
  [['music', 'instrument'],       Music        ],
  [['camera', 'photo'],           Camera       ],
  [['art', 'craft'],              Palette      ],
  [['book', 'read'],              BookOpen     ],
  [['game', 'gaming'],            Gamepad2     ],
  [['baby', 'kid'],               Baby         ],
  [['pet', 'dog'],                PawPrint     ],
];

function getCategoryIcon(name: string): React.ComponentType<any> {
  const n = name.toLowerCase();
  for (const [keywords, Icon] of ICON_MAP) {
    if (keywords.some(k => n.includes(k))) return Icon;
  }
  return ShoppingBag;
}

export function CategoryGrid() {
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn:  catalogApi.getCategories,
    staleTime: 600_000,
  });

  return (
    <div className="py-5 sm:py-8">
      {/* FIX: 4 cols on xs, 5 on sm, 8 on md, 10 on lg — prevents icon overflow */}
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-1.5 sm:gap-2 md:gap-3">
        {(categories as Category[]).slice(0, 10).map(cat => {
          const Icon = getCategoryIcon(cat.name);
          return (
            <Link key={cat.id} href={`/category/${cat.slug}`}
              className="flex flex-col items-center gap-1 sm:gap-1.5 p-1.5 sm:p-2 md:p-3 rounded-xl
                hover:bg-violet-50 transition-all duration-300 group text-center active:scale-95 min-w-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-gray-100 rounded-xl
                group-hover:bg-violet-100 transition-colors duration-300
                flex items-center justify-center overflow-hidden shrink-0">
                {cat.image_url ? (
                  <Image src={cat.image_url} alt={cat.name} width={56} height={56}
                    className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-110" />
                ) : (
                  <Icon size={18} strokeWidth={1.5}
                    className="text-gray-500 group-hover:text-violet-600 transition-colors duration-300" />
                )}
              </div>
              {/* FIX: truncate category name on tiny screens */}
              <span className="text-[9px] sm:text-[10px] md:text-xs text-gray-600 group-hover:text-violet-700
                font-medium line-clamp-2 leading-tight w-full transition-colors duration-300">
                {cat.name}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}