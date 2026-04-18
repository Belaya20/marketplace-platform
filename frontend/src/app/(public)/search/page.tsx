'use client';
// frontend/src/app/(shop)/search/page.tsx
//
// Full-featured search page with:
//   • URL-driven filter state (shareable, bookmarkable, back-button safe)
//   • Desktop: static bar in header + floating pill on scroll
//   • Mobile: bottom-sheet drawer (sort + filters together)
//   • Filter chips showing active filters with individual remove
//   • Stable price inputs (no reset while typing)
//   • Per-filter loading feedback via placeholder data

import {
  useState, useCallback, useRef, useEffect, useMemo, Suspense,
} from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SlidersHorizontal, ArrowUpDown, Star, Check, Loader2,
  ChevronLeft, ChevronRight, X, PackageSearch, ChevronDown,
} from 'lucide-react';
import { productApi, catalogApi } from '@/lib/api';
import { ProductGrid } from '@/components/features/product/ProductCard';
import { DiscountBanner } from '@/components/features/product/DiscountBanner';
import type { Product, Category, Brand } from '@/types';
import clsx from 'clsx';

// ── Constants ─────────────────────────────────────────────────────────────────

const SORTS = [
  { value: 'newest',     label: 'Newest Arrivals'  },
  { value: 'popularity', label: 'Most Popular'      },
  { value: 'rating',     label: 'Highest Rated'     },
  { value: 'price_asc',  label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
] as const;

// Shared style constants — defined once, not inside any render function
const SECTION_LABEL = 'text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5 block';
const INPUT_BASE    = [
  'w-full bg-gray-50 border border-transparent',
  'focus:border-gray-300 focus:bg-white',
  'rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all',
  '[appearance:textfield]',
  '[&::-webkit-inner-spin-button]:appearance-none',
  '[&::-webkit-outer-spin-button]:appearance-none',
].join(' ');

// ── Utilities ─────────────────────────────────────────────────────────────────

function toTitle(slug: string) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Prevents body scroll while mobile drawer is open.
// Saves and restores scroll position so page doesn't jump.
function lockBody() {
  const y = window.scrollY;
  Object.assign(document.body.style, {
    position: 'fixed', top: `-${y}px`, width: '100%', overflowY: 'scroll',
  });
}
function unlockBody() {
  const y = Math.abs(parseInt(document.body.style.top || '0', 10));
  Object.assign(document.body.style, { position: '', top: '', width: '', overflowY: '' });
  window.scrollTo(0, y);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-gray-900 text-white text-xs font-medium whitespace-nowrap">
      {label}
      <button
        onClick={onRemove}
        className="flex items-center justify-center w-4 h-4 rounded-full bg-white/20 hover:bg-white/35 transition-colors"
        aria-label={`Remove ${label} filter`}
      >
        <X size={9} />
      </button>
    </span>
  );
}

function SortPanel({ current, onChange }: { current: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col py-1.5">
      {SORTS.map(s => (
        <button
          key={s.value}
          onClick={() => onChange(s.value)}
          className={clsx(
            'flex items-center justify-between px-5 py-3.5 text-sm transition-colors',
            s.value === current
              ? 'text-gray-900 font-semibold bg-gray-50'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50',
          )}
        >
          {s.label}
          {s.value === current && <Check size={14} className="shrink-0 text-gray-900" />}
        </button>
      ))}
    </div>
  );
}

// ── FilterPanel ───────────────────────────────────────────────────────────────
// Used in three places: static desktop dropdown, floating desktop dropdown,
// and mobile bottom drawer. showSort controls whether the Sort section appears
// (on mobile it does; desktop has a separate sort dropdown).
//
// PRICE INPUT STABILITY:
//   lMin/lMax are local state. They only sync from URL params on mount and when
//   the URL params themselves change. setFilterRef is a ref to the latest
//   setFilter callback — this breaks the dependency chain that was causing
//   price inputs to reset when any unrelated filter changed.

interface FPProps {
  showSort:   boolean;
  sort:       string;
  category:   string;
  brand:      string;
  minPrice:   string;
  maxPrice:   string;
  minRating:  string;
  inStock:    boolean;
  categories: Category[];
  brands:     Brand[];
  setFilter:  (k: string, v: string | null | boolean) => void;
  onReset:    () => void;
  onClose:    () => void;
}

function FilterPanel({
  showSort, sort, category, brand, minPrice, maxPrice, minRating,
  inStock, categories, brands, setFilter, onReset, onClose,
}: FPProps) {
  const [lMin, setLMin] = useState(minPrice);
  const [lMax, setLMax] = useState(maxPrice);
  const [showAllCats, setShowAllCats] = useState(false);

  // Only sync local price inputs from URL when the URL values change externally.
  // Using a ref to track "previous URL value" prevents the sync from firing
  // while the user is typing.
  const prevMinRef = useRef(minPrice);
  const prevMaxRef = useRef(maxPrice);
  useEffect(() => {
    if (minPrice !== prevMinRef.current) { setLMin(minPrice); prevMinRef.current = minPrice; }
  }, [minPrice]);
  useEffect(() => {
    if (maxPrice !== prevMaxRef.current) { setLMax(maxPrice); prevMaxRef.current = maxPrice; }
  }, [maxPrice]);

  // Stable refs so applyMin/applyMax don't recreate when setFilter changes
  const setFilterRef = useRef(setFilter);
  useEffect(() => { setFilterRef.current = setFilter; }, [setFilter]);

  const applyMin = useCallback((val: string) => {
    setFilterRef.current('min_price', val || null);
  }, []);
  const applyMax = useCallback((val: string) => {
    setFilterRef.current('max_price', val || null);
  }, []);

  const visibleCats = showAllCats ? categories : categories.slice(0, 8);
  const hasMoreCats = categories.length > 8;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/80 shrink-0">
        <span className={SECTION_LABEL} style={{ marginBottom: 0 }}>Refine</span>
        <div className="flex items-center gap-4">
          <button
            onClick={() => { onReset(); onClose(); }}
            className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
          >
            Reset all
          </button>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-gray-200 transition-colors"
            aria-label="Close filters"
          >
            <X size={14} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
        <div className="px-5 py-5 space-y-6">

          {/* Sort — only shown on mobile (showSort=true) */}
          {showSort && (
            <section>
              <span className={SECTION_LABEL}>Sort by</span>
              <div className="space-y-0.5">
                {SORTS.map(s => (
                  <button
                    key={s.value}
                    onClick={() => setFilter('sort', s.value)}
                    className={clsx(
                      'w-full flex items-center justify-between py-2.5 px-3.5 rounded-xl text-sm transition-colors',
                      s.value === sort
                        ? 'bg-gray-900 text-white font-medium'
                        : 'text-gray-700 hover:bg-gray-100',
                    )}
                  >
                    {s.label}
                    {s.value === sort && <Check size={13} />}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Collections */}
          {categories.length > 0 && (
            <section>
              <span className={SECTION_LABEL}>Collections</span>
              <div className="space-y-0.5">
                {visibleCats.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setFilter('category', category === c.slug ? null : c.slug)}
                    className={clsx(
                      'w-full text-left py-2.5 px-3.5 rounded-xl text-sm transition-colors',
                      category === c.slug
                        ? 'bg-gray-900 text-white font-medium'
                        : 'text-gray-700 hover:bg-gray-100',
                    )}
                  >
                    {c.name}
                  </button>
                ))}
                {hasMoreCats && (
                  <button
                    onClick={() => setShowAllCats(v => !v)}
                    className="w-full flex items-center gap-1.5 py-2 px-3.5 text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    <ChevronDown
                      size={13}
                      className={clsx('transition-transform', showAllCats && 'rotate-180')}
                    />
                    {showAllCats
                      ? 'Show less'
                      : `Show ${categories.length - 8} more`
                    }
                  </button>
                )}
              </div>
            </section>
          )}

          {/* Price range */}
          <section>
            <span className={SECTION_LABEL}>Price range (ETB)</span>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-400 font-medium pl-1">Min</span>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={lMin}
                  onChange={e => setLMin(e.target.value)}
                  onBlur={e => applyMin(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && applyMin(lMin)}
                  className={INPUT_BASE}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-400 font-medium pl-1">Max</span>
                <input
                  type="number"
                  min={0}
                  placeholder="Any"
                  value={lMax}
                  onChange={e => setLMax(e.target.value)}
                  onBlur={e => applyMax(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && applyMax(lMax)}
                  className={INPUT_BASE}
                />
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5 pl-1">
              Press Enter or tab to apply
            </p>
          </section>

          {/* Brands */}
          {brands.length > 0 && (
            <section>
              <span className={SECTION_LABEL}>Brands</span>
              <div className="space-y-0.5 max-h-44 overflow-y-auto overscroll-contain">
                {brands.map(b => (
                  <button
                    key={b.id}
                    onClick={() => setFilter('brand', brand === b.slug ? null : b.slug)}
                    className={clsx(
                      'flex items-center justify-between w-full py-2.5 px-3.5 rounded-xl text-sm transition-colors',
                      brand === b.slug
                        ? 'bg-gray-900 text-white font-medium'
                        : 'text-gray-700 hover:bg-gray-100',
                    )}
                  >
                    {b.name}
                    {brand === b.slug && <Check size={13} />}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Rating */}
          <section>
            <span className={SECTION_LABEL}>Customer rating</span>
            <div className="space-y-1.5">
              {[4, 3, 2].map(r => (
                <button
                  key={r}
                  onClick={() => setFilter('min_rating', minRating === String(r) ? null : String(r))}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-colors',
                    minRating === String(r)
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-gray-50 border-transparent hover:border-gray-200',
                  )}
                >
                  <div className="flex gap-0.5 shrink-0">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={12}
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
      </div>

      {/* In-stock toggle — sticky footer */}
      <div className="shrink-0 px-5 py-4 bg-gray-50/80 border-t border-gray-100">
        <button
          role="switch"
          aria-checked={inStock}
          onClick={() => setFilter('in_stock', inStock ? null : 'true')}
          className="w-full flex items-center justify-between rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
        >
          <div className="text-left">
            <span className="text-sm font-medium text-gray-900">In stock only</span>
            <p className="text-[11px] text-gray-400 mt-0.5">Hide unavailable items</p>
          </div>
          <div className={clsx(
            'relative w-11 h-6 rounded-full transition-colors shrink-0 ml-4',
            inStock ? 'bg-gray-900' : 'bg-gray-200',
          )}>
            <motion.div
              layout
              transition={{ type: 'spring', stiffness: 500, damping: 32 }}
              className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
              animate={{ left: inStock ? 24 : 4 }}
            />
          </div>
        </button>
      </div>
    </div>
  );
}

// ── Dropdown wrapper ──────────────────────────────────────────────────────────

function Dropdown({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0,   scale: 1    }}
      exit={   { opacity: 0, y: 6,   scale: 0.97 }}
      transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
      className={clsx(
        'absolute top-full right-0 mt-2 bg-white border border-gray-100 shadow-2xl z-[300]',
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

// ── ControlBar ────────────────────────────────────────────────────────────────
// Shared between the static header bar (size="sm") and floating pill (size="lg").
// The only difference is visual weight — same logic, different styling.

interface BarProps {
  size:             'sm' | 'lg';
  sortOpen:         boolean;
  filterOpen:       boolean;
  onSortClick:      () => void;
  onFilterClick:    () => void;
  currentSortLabel: string;
  filterCount:      number;
}

function ControlBar({
  size, sortOpen, filterOpen,
  onSortClick, onFilterClick,
  currentSortLabel, filterCount,
}: BarProps) {
  const lg = size === 'lg';
  return (
    <div className={clsx(
      'flex items-center rounded-full p-1 border border-gray-100',
      lg
        ? 'bg-white/95 backdrop-blur-2xl shadow-[0_8px_40px_rgba(0,0,0,0.14)]'
        : 'bg-gray-50 shadow-sm',
    )}>
      {/* Sort button */}
      <button
        onClick={onSortClick}
        className={clsx(
          'flex items-center gap-2 rounded-full transition-all whitespace-nowrap text-sm',
          lg ? 'px-6 py-3 font-semibold' : 'px-5 py-2.5 font-medium',
          lg
            ? sortOpen
                ? 'bg-gray-900 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            : sortOpen
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-600 hover:text-gray-900',
        )}
      >
        <ArrowUpDown size={lg ? 15 : 14} />
        {currentSortLabel}
      </button>

      <div className="w-px h-4 bg-gray-200 mx-1 shrink-0" />

      {/* Filter button */}
      <button
        onClick={onFilterClick}
        className={clsx(
          'flex items-center gap-2 rounded-full transition-all whitespace-nowrap text-sm',
          lg ? 'px-6 py-3 font-semibold' : 'px-5 py-2.5 font-medium',
          lg
            ? filterOpen
                ? 'bg-gray-900 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            : filterOpen
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-600 hover:text-gray-900',
        )}
      >
        <SlidersHorizontal size={lg ? 15 : 14} />
        Filters
        {filterCount > 0 && (
          <span className={clsx(
            'inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold',
            filterOpen && lg ? 'bg-white text-gray-900' : 'bg-gray-900 text-white',
          )}>
            {filterCount}
          </span>
        )}
      </button>
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState({ q, hasFilters, onReset }: {
  q: string; hasFilters: boolean; onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-4">
      <PackageSearch size={48} strokeWidth={1.5} className="text-gray-200 mb-4" />
      <h2 className="text-lg font-semibold text-gray-800 mb-2">
        {q ? `No results for \u201c${q}\u201d` : 'No products found'}
      </h2>
      <p className="text-sm text-gray-400 max-w-xs mb-6">
        {hasFilters
          ? 'Try removing some filters to see more results.'
          : 'Check your spelling or try a more general search term.'}
      </p>
      {hasFilters && (
        <button
          onClick={onReset}
          className="px-6 py-2.5 rounded-2xl bg-gray-900 text-white text-sm font-medium hover:bg-black transition-colors"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}

// ── SearchPageContent ─────────────────────────────────────────────────────────

function SearchPageContent() {
  const sp     = useSearchParams();
  const router = useRouter();

  // Read all filter state from URL — single source of truth
  const q         = sp.get('q')          || '';
  const category  = sp.get('category')   || '';
  const brand     = sp.get('brand')      || '';
  const sort      = sp.get('sort')       || 'newest';
  const minPrice  = sp.get('min_price')  || '';
  const maxPrice  = sp.get('max_price')  || '';
  const minRating = sp.get('min_rating') || '';
  const inStock   = sp.get('in_stock')   === 'true';

  const [sortOpen,   setSortOpen]   = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled,   setScrolled]   = useState(false);
  const [page,       setPage]       = useState(1);

  const staticRef = useRef<HTMLDivElement>(null);
  const floatRef  = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const closeAll = useCallback(() => { setSortOpen(false); setFilterOpen(false); }, []);
  const closeMob = useCallback(() => setMobileOpen(false), []);

  // Show floating pill once the header has scrolled past
  useEffect(() => {
    const handle = () => {
      const threshold = (headerRef.current?.offsetHeight ?? 160) + 20;
      setScrolled(window.scrollY > threshold);
      if (window.scrollY > threshold) closeAll();
    };
    window.addEventListener('scroll', handle, { passive: true });
    return () => window.removeEventListener('scroll', handle);
  }, [closeAll]);

  // Close dropdowns when clicking outside both bars
  useEffect(() => {
    const handle = (e: MouseEvent | TouchEvent) => {
      const t = (e as MouseEvent).target as Node;
      if (!staticRef.current?.contains(t) && !floatRef.current?.contains(t)) closeAll();
    };
    document.addEventListener('mousedown',  handle);
    document.addEventListener('touchstart', handle, { passive: true });
    return () => {
      document.removeEventListener('mousedown',  handle);
      document.removeEventListener('touchstart', handle);
    };
  }, [closeAll]);

  // Lock body scroll while mobile drawer is open (preserves scroll position)
  useEffect(() => {
    if (mobileOpen) lockBody(); else unlockBody();
    return unlockBody;
  }, [mobileOpen]);

  // Update URL and reset to page 1
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
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search', { scroll: false });
  }, [q, router]);

  // ── Queries ───────────────────────────────────────────────────────────────

  const searchParams = useMemo(() => ({
    page, limit: 24, sort, q, category, brand,
    min_price:  minPrice  ? Number(minPrice)  : undefined,
    max_price:  maxPrice  ? Number(maxPrice)  : undefined,
    min_rating: minRating ? Number(minRating) : undefined,
    in_stock:   inStock   || undefined,
  }), [page, sort, q, category, brand, minPrice, maxPrice, minRating, inStock]);

  const { data, isLoading } = useQuery({
    queryKey:        ['search', searchParams],
    queryFn:         () => productApi.search(searchParams),
    placeholderData: (prev: any) => prev,
    staleTime:       30_000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'], queryFn: catalogApi.getCategories, staleTime: 600_000,
  });
  const { data: brands = [] } = useQuery({
    queryKey: ['brands'], queryFn: catalogApi.getBrands, staleTime: 3_600_000,
  });

  const products   = (data?.data ?? []) as Product[];
  const total      = data?.meta?.total       ?? 0;
  const totalPages = data?.meta?.total_pages ?? 1;

  // ── Derived display values ────────────────────────────────────────────────

  const currentSortLabel = useMemo(
    () => SORTS.find(s => s.value === sort)?.label ?? 'Sort',
    [sort],
  );

  const filterCount = useMemo(() =>
    [category, brand, minPrice, maxPrice, minRating, inStock ? '1' : ''].filter(Boolean).length,
    [category, brand, minPrice, maxPrice, minRating, inStock],
  );

  const chips = useMemo(() => {
    const list: { label: string; key: string }[] = [];
    if (category)  list.push({ label: toTitle(category),     key: 'category'   });
    if (brand)     list.push({ label: brand,                 key: 'brand'      });
    if (minPrice)  list.push({ label: `Min ${minPrice} ETB`, key: 'min_price'  });
    if (maxPrice)  list.push({ label: `Max ${maxPrice} ETB`, key: 'max_price'  });
    if (minRating) list.push({ label: `${minRating}★ & up`,  key: 'min_rating' });
    if (inStock)   list.push({ label: 'In stock',            key: 'in_stock'   });
    return list;
  }, [category, brand, minPrice, maxPrice, minRating, inStock]);

  // ── Shared props ──────────────────────────────────────────────────────────

  // fpProps is memoized so FilterPanel only re-renders when relevant values change
  const fpProps = useMemo<Omit<FPProps, 'showSort'>>(() => ({
    sort, category, brand, minPrice, maxPrice, minRating, inStock,
    categories: categories as Category[],
    brands:     brands     as Brand[],
    setFilter,
    onReset:    resetAll,
    onClose:    () => { closeAll(); closeMob(); },
  }), [
    sort, category, brand, minPrice, maxPrice, minRating, inStock,
    categories, brands, setFilter, resetAll, closeAll, closeMob,
  ]);

  // barProps is NOT memoized (inline object) because ControlBar is lightweight
  // and re-renders are cheap — no need to add complexity here
  const barProps = {
    sortOpen,
    filterOpen,
    onSortClick:   () => { setSortOpen(o => !o); setFilterOpen(false); },
    onFilterClick: () => { setFilterOpen(o => !o); setSortOpen(false); },
    currentSortLabel,
    filterCount,
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="container-page py-6 sm:py-10 min-h-screen bg-white">

      {/* ── Page header ── */}
      <div ref={headerRef} className="mb-5 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-6">

          {/* Title + count */}
          <div className="min-w-0 flex-1">
            <h1
              className="font-light tracking-tighter text-gray-900 break-words"
              style={{ fontSize: 'clamp(1.75rem, 5vw, 3.75rem)', lineHeight: 1.1 }}
            >
              {q
                ? <>&ldquo;{q}&rdquo;</>
                : category
                  ? toTitle(category)
                  : 'All Collections'
              }
            </h1>
            <p className={clsx(
              'mt-2 text-sm font-medium text-gray-400 tracking-wide transition-opacity duration-300',
              isLoading ? 'opacity-0' : 'opacity-100',
            )}>
              {total.toLocaleString()} product{total !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Desktop static bar */}
          <div className="hidden md:block relative shrink-0" ref={staticRef}>
            <ControlBar size="sm" {...barProps} />
            <AnimatePresence>
              {sortOpen && (
                <Dropdown className="w-52 rounded-3xl overflow-hidden">
                  <SortPanel
                    current={sort}
                    onChange={v => { setFilter('sort', v); setSortOpen(false); }}
                  />
                </Dropdown>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {filterOpen && (
                <Dropdown className="w-72 rounded-2xl max-h-[76vh] flex flex-col overflow-hidden">
                  <FilterPanel {...fpProps} showSort={false} />
                </Dropdown>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Mobile pills */}
        <div className="flex items-center gap-2 mt-3 md:hidden overflow-x-auto pb-0.5 scrollbar-none">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border border-gray-200 bg-white text-gray-700 whitespace-nowrap shrink-0 active:bg-gray-50 transition-colors"
          >
            <ArrowUpDown size={13} />
            <span className="max-w-[130px] truncate">{currentSortLabel}</span>
          </button>
          <button
            onClick={() => setMobileOpen(true)}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border whitespace-nowrap shrink-0 transition-colors',
              filterCount > 0
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white border-gray-200 text-gray-700 active:bg-gray-50',
            )}
          >
            <SlidersHorizontal size={13} />
            Filters
            {filterCount > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white text-gray-900 text-[10px] font-bold">
                {filterCount}
              </span>
            )}
          </button>
        </div>

        {/* Active filter chips */}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {chips.map(c => (
              <FilterChip
                key={c.key}
                label={c.label}
                onRemove={() => setFilter(c.key, null)}
              />
            ))}
            {chips.length > 1 && (
              <button
                onClick={resetAll}
                className="text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors px-1.5 py-1.5 underline underline-offset-2"
              >
                Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {/* Discount banners */}
      {category && (
        <DiscountBanner
          categorySlug={category}
          title={`Discount codes for ${toTitle(category)}`}
        />
      )}
      {!category && !q && <DiscountBanner title="Available discount codes" />}

      {/* ── Floating pill (desktop, on scroll) ── */}
      <AnimatePresence>
        {scrolled && (
          <motion.div
            ref={floatRef}
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,   scale: 1    }}
            exit={   { opacity: 0, y: -16, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-[300] hidden md:block"
          >
            <div className="relative">
              <ControlBar size="lg" {...barProps} />
              <AnimatePresence>
                {sortOpen && (
                  <Dropdown className="w-52 rounded-3xl overflow-hidden">
                    <SortPanel
                      current={sort}
                      onChange={v => { setFilter('sort', v); setSortOpen(false); }}
                    />
                  </Dropdown>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {filterOpen && (
                  <Dropdown className="w-72 rounded-2xl max-h-[76vh] flex flex-col overflow-hidden">
                    <FilterPanel {...fpProps} showSort={false} />
                  </Dropdown>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mobile bottom-sheet drawer ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Scrim */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={   { opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-[400] md:hidden"
              onClick={closeMob}
              aria-hidden
            />
            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={   { y: '100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 38 }}
              className="fixed inset-x-0 bottom-0 z-[401] md:hidden bg-white rounded-t-[1.75rem] flex flex-col"
              // dvh is not supported on iOS 14 — fall back to vh
              style={{ maxHeight: 'min(88dvh, 88vh)' }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1 shrink-0" aria-hidden>
                <div className="w-10 h-1.5 rounded-full bg-gray-200" />
              </div>
              <FilterPanel {...fpProps} showSort />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Product grid ── */}
      <div className="mt-4">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-7">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="aspect-[4/5] bg-gray-100 animate-pulse rounded-3xl" />
                <div className="h-3.5 bg-gray-100 animate-pulse rounded-full w-3/4" />
                <div className="h-3   bg-gray-100 animate-pulse rounded-full w-1/2" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <EmptyState q={q} hasFilters={filterCount > 0} onReset={resetAll} />
        ) : (
          <>
            <ProductGrid products={products} />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 sm:gap-5 mt-14 sm:mt-20">
                <button
                  disabled={page === 1}
                  onClick={() => {
                    setPage(p => p - 1);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="flex items-center gap-1.5 px-4 sm:px-7 py-2.5 sm:py-3 text-sm font-medium border border-gray-200 rounded-2xl disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={15} />
                  <span className="hidden sm:inline">Previous</span>
                </button>

                <span className="text-sm text-gray-400 font-medium tabular-nums whitespace-nowrap">
                  {page} / {totalPages}
                </span>

                <button
                  disabled={page === totalPages}
                  onClick={() => {
                    setPage(p => p + 1);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="flex items-center gap-1.5 px-4 sm:px-7 py-2.5 sm:py-3 text-sm font-medium border border-gray-200 rounded-2xl disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  aria-label="Next page"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight size={15} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Page export ───────────────────────────────────────────────────────────────
// Suspense is required — useSearchParams throws without it in Next.js 14+.

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="container-page py-12 min-h-screen flex flex-col items-center justify-center">
        <Loader2 size={36} className="animate-spin text-gray-200 mb-4" />
        <p className="text-gray-400 text-sm">Loading search…</p>
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  );
}