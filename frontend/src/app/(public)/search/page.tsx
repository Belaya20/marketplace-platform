'use client';
// frontend/src/app/(public)/search/page.tsx
//
// Audit fixes:
//  1. Mobile has NO sort/filter UI → added bottom-sheet drawer for mobile (<md)
//  2. containerRef double-assigned → split into staticBarRef + floatingBarRef
//  3. Dynamic import inside query → use already-imported catalogApi.getBrands()
//  4. Price inputs fire on every keystroke → local state + onBlur / Enter to apply
//  5. No empty state → dedicated empty state component
//  6. Dropdown absolute positioning → explicit relative wrapper per bar
//  7. staleTime: 0 → staleTime: 30_000 (placeholderData already handles stale UI)
//  8. z-index conflict with Navbar → elevated to z-[300]
//  9. Title overflow on 320px → clamp text, break-words
// 10. Pagination overflow on mobile → icon-only buttons on xs, text on sm+
// 11. inStock toggle → aria-checked + role="switch" for accessibility
// 12. Brands query staleTime too low for static data → 1 hour

import { useState, useCallback, useRef, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SlidersHorizontal, ArrowUpDown, Star, Check,
  Loader2, ChevronLeft, ChevronRight, X, PackageSearch,
} from 'lucide-react';
import { productApi, catalogApi } from '@/lib/api';
import { ProductGrid } from '@/components/features/product/ProductCard';
import { DiscountBanner } from '@/components/features/product/DiscountBanner';
import type { Product, Category, Brand } from '@/types';
import clsx from 'clsx';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SORTS = [
  { value: 'newest',     label: 'Newest Arrivals' },
  { value: 'popularity', label: 'Most Popular' },
  { value: 'rating',     label: 'Highest Rated' },
  { value: 'price_asc',  label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// FilterPanel — the actual filter content, reused in dropdown + mobile drawer
// ─────────────────────────────────────────────────────────────────────────────

interface FilterPanelProps {
  sort:       string;
  category:   string;
  brand:      string;
  minPrice:   string;
  maxPrice:   string;
  minRating:  string;
  inStock:    boolean;
  categories: Category[];
  brands:     Brand[];
  setFilter:  (key: string, val: string | null | boolean) => void;
  onClose:    () => void;
  searchQuery: string;
}

function FilterPanel({
  sort, category, brand, minPrice, maxPrice, minRating,
  inStock, categories, brands, setFilter, onClose, searchQuery,
}: FilterPanelProps) {
  // FIX 4: local price state — only fires setFilter on blur or Enter
  const [localMin, setLocalMin] = useState(minPrice);
  const [localMax, setLocalMax] = useState(maxPrice);

  const applyPrice = () => {
    setFilter('min_price', localMin);
    setFilter('max_price', localMax);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50 shrink-0">
        <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
          Refine results
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setLocalMin(''); setLocalMax('');
              const base = searchQuery ? `/search?q=${searchQuery}` : '/search';
              onClose();
              window.history.pushState({}, '', base);
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
          >
            Reset all
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-200 transition-colors md:hidden"
            aria-label="Close filters"
          >
            <X size={16} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-6 space-y-8">

        {/* Sort (shown only inside the panel on mobile — desktop has its own button) */}
        <section className="md:hidden">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
            Sort by
          </p>
          <div className="space-y-1">
            {SORTS.map(s => (
              <button
                key={s.value}
                onClick={() => setFilter('sort', s.value)}
                className={clsx(
                  'w-full flex items-center justify-between py-3 px-4 rounded-2xl text-sm transition-all',
                  sort === s.value
                    ? 'bg-black text-white font-medium'
                    : 'text-gray-700 hover:bg-gray-100',
                )}
              >
                {s.label}
                {sort === s.value && <Check size={15} />}
              </button>
            ))}
          </div>
        </section>

        {/* Collections */}
        <section>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
            Collections
          </p>
          <div className="space-y-1">
            {categories.map((c: Category) => (
              <button
                key={c.id}
                onClick={() => setFilter('category', category === c.slug ? null : c.slug)}
                className={clsx(
                  'w-full text-left py-3 px-4 rounded-2xl text-sm transition-all',
                  category === c.slug
                    ? 'bg-black text-white font-medium'
                    : 'text-gray-700 hover:bg-gray-100',
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        </section>

        {/* Price range — FIX 4: local state, apply on blur/Enter */}
        <section>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
            Price range (ETB)
          </p>
          <div className="flex gap-3 items-center">
            <input
              type="number"
              placeholder="Min"
              value={localMin}
              onChange={e => setLocalMin(e.target.value)}
              onBlur={applyPrice}
              onKeyDown={e => e.key === 'Enter' && applyPrice()}
              className="w-full bg-gray-50 border border-transparent focus:border-gray-300 rounded-2xl px-4 py-3 text-sm outline-none transition-colors"
              min={0}
            />
            <span className="text-gray-400 shrink-0">–</span>
            <input
              type="number"
              placeholder="Max"
              value={localMax}
              onChange={e => setLocalMax(e.target.value)}
              onBlur={applyPrice}
              onKeyDown={e => e.key === 'Enter' && applyPrice()}
              className="w-full bg-gray-50 border border-transparent focus:border-gray-300 rounded-2xl px-4 py-3 text-sm outline-none transition-colors"
              min={0}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1.5 pl-1">
            Press Enter or click outside to apply
          </p>
        </section>

        {/* Brands */}
        {brands.length > 0 && (
          <section>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
              Brands
            </p>
            <div className="space-y-1">
              {brands.map((b: Brand) => (
                <button
                  key={b.id}
                  onClick={() => setFilter('brand', brand === b.slug ? null : b.slug)}
                  className={clsx(
                    'flex items-center justify-between w-full py-3 px-4 rounded-2xl text-sm transition-all',
                    brand === b.slug
                      ? 'bg-black text-white font-medium'
                      : 'text-gray-700 hover:bg-gray-100',
                  )}
                >
                  {b.name}
                  {brand === b.slug && <Check size={15} />}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Rating */}
        <section>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
            Customer rating
          </p>
          <div className="space-y-2">
            {[4, 3, 2].map(r => (
              <button
                key={r}
                onClick={() => setFilter('min_rating', minRating === String(r) ? null : String(r))}
                className={clsx(
                  'w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-all',
                  minRating === String(r)
                    ? 'bg-black text-white border-black'
                    : 'bg-gray-50 border-transparent hover:border-gray-200',
                )}
              >
                <div className="flex gap-0.5 shrink-0">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={13}
                      fill={i < r ? 'currentColor' : 'none'}
                      className={
                        i < r
                          ? minRating === String(r) ? 'text-white' : 'text-amber-400'
                          : 'text-gray-300'
                      }
                    />
                  ))}
                </div>
                <span className="text-sm font-medium">& Up</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* In-stock toggle — sticky at bottom — FIX 11: proper a11y */}
      <div className="shrink-0 px-6 py-5 bg-gray-50 border-t border-gray-100">
        <div
          role="switch"
          aria-checked={inStock}
          tabIndex={0}
          onClick={() => setFilter('in_stock', !inStock ? 'true' : null)}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setFilter('in_stock', !inStock ? 'true' : null)}
          className="flex items-center justify-between cursor-pointer select-none outline-none"
        >
          <div>
            <span className="font-medium text-sm text-gray-900">In stock only</span>
            <p className="text-xs text-gray-500 mt-0.5">Hide unavailable items</p>
          </div>
          <div
            className={clsx(
              'relative w-11 h-6 rounded-full transition-colors flex items-center px-1 shrink-0',
              inStock ? 'bg-black' : 'bg-gray-200',
            )}
          >
            <motion.div
              layout
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="w-4 h-4 bg-white rounded-full shadow-sm"
              animate={{ x: inStock ? 20 : 0 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({ query, hasFilters, onReset }: {
  query:      string;
  hasFilters: boolean;
  onReset:    () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <PackageSearch size={52} className="text-gray-200 mb-4" strokeWidth={1.5} />
      <h2 className="text-xl font-semibold text-gray-800 mb-2">
        {query ? `No results for "${query}"` : 'No products found'}
      </h2>
      <p className="text-sm text-gray-400 max-w-xs mb-6">
        {hasFilters
          ? 'Try adjusting or clearing your filters.'
          : 'Check your spelling or try a more general search term.'}
      </p>
      {hasFilters && (
        <button
          onClick={onReset}
          className="px-6 py-2.5 rounded-2xl bg-black text-white text-sm font-medium hover:bg-gray-900 transition-colors"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SearchPageContent — main logic
// ─────────────────────────────────────────────────────────────────────────────

function SearchPageContent() {
  const sp     = useSearchParams();
  const router = useRouter();

  // Separate menu states so sort and filters can open independently
  const [sortOpen,     setSortOpen]    = useState(false);
  const [filtersOpen,  setFiltersOpen] = useState(false);
  // Mobile bottom drawer
  const [mobileOpen,   setMobileOpen]  = useState(false);
  const [isScrolled,   setIsScrolled]  = useState(false);
  const [page,         setPage]        = useState(1);

  // FIX 2: separate refs — static bar and floating pill are different DOM nodes
  const staticBarRef   = useRef<HTMLDivElement>(null);
  const floatingBarRef = useRef<HTMLDivElement>(null);
  const headerRef      = useRef<HTMLDivElement>(null);

  // Read URL params
  const q         = sp.get('q')          || '';
  const category  = sp.get('category')   || '';
  const brand     = sp.get('brand')      || '';
  const sort      = sp.get('sort')       || 'newest';
  const minPrice  = sp.get('min_price')  || '';
  const maxPrice  = sp.get('max_price')  || '';
  const minRating = sp.get('min_rating') || '';
  const inStock   = sp.get('in_stock')   === 'true';

  const currentSortLabel = useMemo(
    () => SORTS.find(s => s.value === sort)?.label || 'Sort',
    [sort],
  );

  const hasFilters = !!(category || brand || minPrice || maxPrice || minRating || inStock);

  // Scroll → show floating pill, close any open menus
  useEffect(() => {
    const handle = () => {
      const headerH = headerRef.current?.offsetHeight || 140;
      const show    = window.scrollY > headerH + 30;
      setIsScrolled(show);
      if (show) { setSortOpen(false); setFiltersOpen(false); }
    };
    window.addEventListener('scroll', handle, { passive: true });
    return () => window.removeEventListener('scroll', handle);
  }, []);

  // Click-outside for both bars — FIX 2: check each ref independently
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      const target = e.target as Node;
      const inStatic   = staticBarRef.current?.contains(target);
      const inFloating = floatingBarRef.current?.contains(target);
      if (!inStatic && !inFloating) {
        setSortOpen(false);
        setFiltersOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // Update URL and reset page
  const setFilter = useCallback((key: string, value: string | null | boolean) => {
    const p = new URLSearchParams(sp.toString());
    if (value === null || value === '' || value === false) p.delete(key);
    else p.set(key, String(value));
    p.delete('page');
    setPage(1);
    router.push(`/search?${p.toString()}`, { scroll: false });
  }, [sp, router]);

  const resetAll = useCallback(() => {
    setPage(1);
    router.push(q ? `/search?q=${q}` : '/search', { scroll: false });
  }, [q, router]);

  // ── Queries ──────────────────────────────────────────────────────────────
  const params = useMemo(() => ({
    page, limit: 24, sort, q, category, brand,
    min_price:  minPrice  ? Number(minPrice)  : undefined,
    max_price:  maxPrice  ? Number(maxPrice)  : undefined,
    min_rating: minRating ? Number(minRating) : undefined,
    in_stock:   inStock   || undefined,
  }), [page, sort, q, category, brand, minPrice, maxPrice, minRating, inStock]);

  const { data, isLoading } = useQuery({
    queryKey:        ['search', params],
    queryFn:         () => productApi.search(params),
    placeholderData: (prev: any) => prev,
    staleTime:       30_000, // FIX 7: was 0 — triggers refetch on every render
  });

  // FIX 3: use already-imported catalogApi — no dynamic import
  const { data: categories = [] } = useQuery({
    queryKey:  ['categories'],
    queryFn:   catalogApi.getCategories,
    staleTime: 600_000,
  });

  const { data: brands = [] } = useQuery({
    queryKey:  ['brands'],
    queryFn:   catalogApi.getBrands,   // FIX 3: was dynamic import
    staleTime: 3_600_000,              // FIX 12: brands are static — 1 hour
  });

  const products   = (data?.data ?? []) as Product[];
  const total      = data?.meta?.total       ?? 0;
  const totalPages = data?.meta?.total_pages ?? 1;

  // Shared filter panel props
  const filterProps: FilterPanelProps = {
    sort, category, brand, minPrice, maxPrice, minRating, inStock,
    categories: categories as Category[],
    brands:     brands     as Brand[],
    setFilter,
    onClose:     () => { setFiltersOpen(false); setSortOpen(false); setMobileOpen(false); },
    searchQuery: q,
  };

  return (
    <div className="container-page py-6 sm:py-10 min-h-screen bg-white">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div ref={headerRef} className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          {/* Title — FIX 9: break-words + clamped size for small screens */}
          <div className="min-w-0">
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-light tracking-tighter text-gray-900 break-words">
              {q
                ? <>&ldquo;{q}&rdquo;</>
                : category
                  ? category.replace(/-/g, ' ')
                  : 'All Collections'
              }
            </h1>
            {!isLoading && (
              <p className="mt-2 text-sm font-medium text-gray-500 tracking-wide">
                {total.toLocaleString()} product{total !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Desktop sort + filter bar — FIX 2: uses staticBarRef */}
          <div className="hidden md:block relative shrink-0" ref={staticBarRef}>
            <div className="flex items-center bg-gray-50 rounded-full p-1 border border-gray-100 shadow-sm">
              {/* Sort button */}
              <button
                onClick={() => { setSortOpen(o => !o); setFiltersOpen(false); }}
                className={clsx(
                  'flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium tracking-wide transition-all whitespace-nowrap',
                  sortOpen ? 'bg-white shadow-sm text-black' : 'text-gray-600 hover:text-gray-900',
                )}
              >
                <ArrowUpDown size={15} />
                {currentSortLabel}
              </button>
              <div className="w-px h-5 bg-gray-200 mx-1.5" />
              {/* Filter button */}
              <button
                onClick={() => { setFiltersOpen(o => !o); setSortOpen(false); }}
                className={clsx(
                  'flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium tracking-wide transition-all',
                  filtersOpen ? 'bg-white shadow-sm text-black' : 'text-gray-600 hover:text-gray-900',
                )}
              >
                <SlidersHorizontal size={15} />
                Filters
                {hasFilters && (
                  <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                )}
              </button>
            </div>

            {/* ── Desktop sort dropdown ── */}
            <AnimatePresence>
              {sortOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.97 }}
                  transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                  // FIX 6: absolute + top-full + right-0 — positioned relative to staticBarRef
                  className="absolute top-full right-0 mt-2 w-56 bg-white border border-gray-100 shadow-2xl rounded-3xl overflow-hidden z-[300]"
                >
                  <div className="flex flex-col py-2">
                    {SORTS.map(s => (
                      <button
                        key={s.value}
                        onClick={() => { setFilter('sort', s.value); setSortOpen(false); }}
                        className={clsx(
                          'flex items-center justify-between px-5 py-3.5 text-sm transition-all',
                          sort === s.value
                            ? 'text-black font-semibold bg-gray-50'
                            : 'text-gray-500 hover:text-black hover:bg-gray-50',
                        )}
                      >
                        {s.label}
                        {sort === s.value && <Check size={15} className="text-black shrink-0" />}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Desktop filter dropdown ── */}
            <AnimatePresence>
              {filtersOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.97 }}
                  transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                  className="absolute top-full right-0 mt-2 w-80 bg-white border border-gray-100 shadow-2xl rounded-[2rem] overflow-hidden z-[300] max-h-[75vh] flex flex-col"
                >
                  <FilterPanel {...filterProps} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Mobile sort + filter bar — FIX 1 ── */}
        <div className="flex items-center gap-2 mt-4 md:hidden">
          {/* Sort pill */}
          <button
            onClick={() => setMobileOpen(true)}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-medium border transition-all shrink-0',
              'bg-white border-gray-200 text-gray-700 active:bg-gray-50',
            )}
          >
            <ArrowUpDown size={14} />
            <span className="max-w-[120px] truncate">{currentSortLabel}</span>
          </button>

          {/* Filter pill */}
          <button
            onClick={() => setMobileOpen(true)}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-medium border transition-all',
              hasFilters
                ? 'bg-black text-white border-black'
                : 'bg-white border-gray-200 text-gray-700 active:bg-gray-50',
            )}
          >
            <SlidersHorizontal size={14} />
            Filters
            {hasFilters && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white text-black text-[10px] font-bold ml-0.5">
                {[category, brand, minPrice || maxPrice, minRating, inStock].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Discount banners */}
      {category && (
        <DiscountBanner
          categorySlug={category}
          title={`Discount codes for "${category.replace(/-/g, ' ')}"`}
        />
      )}
      {!category && !q && (
        <DiscountBanner title="Available discount codes" />
      )}

      {/* ── Floating pill (scrolled, desktop only) ─────────────────────── */}
      {/* FIX 8: z-[300] — above navbar. FIX 2: uses floatingBarRef */}
      <AnimatePresence>
        {isScrolled && (
          <motion.div
            ref={floatingBarRef}
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,   scale: 1 }}
            exit={{ opacity: 0,  y: -16,   scale: 0.95 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-[300] hidden md:block"
          >
            <div className="relative flex items-center bg-white/95 backdrop-blur-2xl rounded-3xl p-1.5 border border-gray-100 shadow-2xl">
              <button
                onClick={() => { setSortOpen(o => !o); setFiltersOpen(false); }}
                className={clsx(
                  'flex items-center gap-2 px-6 py-3 rounded-3xl text-sm font-semibold tracking-wide transition-all whitespace-nowrap',
                  sortOpen ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100',
                )}
              >
                <ArrowUpDown size={16} />
                {currentSortLabel}
              </button>
              <div className="w-px h-6 bg-gray-200 mx-1.5" />
              <button
                onClick={() => { setFiltersOpen(o => !o); setSortOpen(false); }}
                className={clsx(
                  'flex items-center gap-2 px-6 py-3 rounded-3xl text-sm font-semibold tracking-wide transition-all',
                  filtersOpen ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100',
                )}
              >
                <SlidersHorizontal size={16} />
                Filters
                {hasFilters && (
                  <span className="ml-1 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </button>

              {/* Floating sort dropdown */}
              <AnimatePresence>
                {sortOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 mt-2 w-56 bg-white border border-gray-100 shadow-2xl rounded-3xl overflow-hidden z-[301]"
                  >
                    <div className="flex flex-col py-2">
                      {SORTS.map(s => (
                        <button key={s.value}
                          onClick={() => { setFilter('sort', s.value); setSortOpen(false); }}
                          className={clsx(
                            'flex items-center justify-between px-5 py-3.5 text-sm transition-all',
                            sort === s.value
                              ? 'text-black font-semibold bg-gray-50'
                              : 'text-gray-500 hover:text-black hover:bg-gray-50',
                          )}>
                          {s.label}
                          {sort === s.value && <Check size={15} className="shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Floating filter dropdown */}
              <AnimatePresence>
                {filtersOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full right-0 mt-2 w-80 bg-white border border-gray-100 shadow-2xl rounded-[2rem] overflow-hidden z-[301] max-h-[75vh] flex flex-col"
                  >
                    <FilterPanel {...filterProps} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mobile bottom drawer — FIX 1 ───────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 z-[400] md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            {/* Drawer — slides up from bottom */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 40 }}
              className="fixed bottom-0 left-0 right-0 z-[401] md:hidden bg-white rounded-t-[2.5rem] flex flex-col"
              style={{ maxHeight: '88dvh' }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1.5 rounded-full bg-gray-200" />
              </div>
              <FilterPanel {...filterProps} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Product grid ────────────────────────────────────────────────── */}
      <div className="relative mt-4">
        {isLoading ? (
          // Skeleton — 2 cols on mobile, 4 on lg
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="aspect-[4/5] bg-gray-100 animate-pulse rounded-3xl" />
                <div className="h-3.5 bg-gray-100 animate-pulse rounded-full w-3/4" />
                <div className="h-3 bg-gray-100 animate-pulse rounded-full w-1/2" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          // FIX 5: empty state
          <EmptyState query={q} hasFilters={hasFilters} onReset={resetAll} />
        ) : (
          <>
            <ProductGrid products={products} />

            {/* ── Pagination — FIX 10: icon-only on xs, text on sm+ ── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 sm:gap-6 mt-14 sm:mt-20">
                <button
                  disabled={page === 1}
                  onClick={() => { setPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="flex items-center gap-1.5 px-4 sm:px-7 py-2.5 sm:py-3 text-sm font-medium border border-gray-200 rounded-2xl disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                  <span className="hidden sm:inline">Previous</span>
                </button>

                <span className="text-sm text-gray-500 font-medium whitespace-nowrap">
                  {page} / {totalPages}
                </span>

                <button
                  disabled={page === totalPages}
                  onClick={() => { setPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="flex items-center gap-1.5 px-4 sm:px-7 py-2.5 sm:py-3 text-sm font-medium border border-gray-200 rounded-2xl disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  aria-label="Next page"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page export — Suspense required for useSearchParams in Next.js 14+
// ─────────────────────────────────────────────────────────────────────────────

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="container-page py-12 min-h-screen flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-gray-300 mb-4" />
          <p className="text-gray-400 text-sm animate-pulse">Loading search…</p>
        </div>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}