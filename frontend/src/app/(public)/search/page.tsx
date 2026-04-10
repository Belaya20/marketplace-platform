'use client';

import { useState, useCallback, useRef, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { SlidersHorizontal, ArrowUpDown, Star, Check, Loader2 } from 'lucide-react';
import { productApi, catalogApi } from '@/lib/api';
import { ProductGrid } from '@/components/features/product/ProductCard';
import { DiscountBanner } from '@/components/features/product/DiscountBanner';
import type { Product, Category, Brand } from '@/types';
import clsx from 'clsx';

const SORTS = [
  { value: 'newest',     label: 'Newest Arrivals' },
  { value: 'popularity', label: 'Most Popular' },
  { value: 'rating',     label: 'Highest Rated' },
  { value: 'price_asc',  label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
];

// ─── LOGIC COMPONENT ───
function SearchPageContent() {
  const sp     = useSearchParams();
  const router = useRouter();
  const [activeMenu, setActiveMenu] = useState<'sort' | 'filters' | null>(null);
  const [page,         setPage]      = useState(1);
  const [isScrolled,   setIsScrolled] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef    = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clickOut = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', clickOut);
    return () => document.removeEventListener('mousedown', clickOut);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY      = window.scrollY;
      const headerHeight = headerRef.current?.offsetHeight || 140;
      const showFloat    = scrollY > headerHeight + 30;
      setIsScrolled(showFloat);
      if (showFloat && activeMenu) setActiveMenu(null);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeMenu]);

  const q         = sp.get('q')         || '';
  const category  = sp.get('category')  || '';
  const brand     = sp.get('brand')     || '';
  const sort      = sp.get('sort')      || 'newest';
  const minPrice  = sp.get('min_price') || '';
  const maxPrice  = sp.get('max_price') || '';
  const minRating = sp.get('min_rating')|| '';
  const inStock   = sp.get('in_stock')   === 'true';

  const currentSortLabel = useMemo(
    () => SORTS.find(s => s.value === sort)?.label || 'Sort',
    [sort]
  );

  const params = {
    page, limit: 24, sort, q, category, brand,
    min_price:  minPrice  ? Number(minPrice)  : undefined,
    max_price:  maxPrice  ? Number(maxPrice)  : undefined,
    min_rating: minRating ? Number(minRating) : undefined,
    in_stock:   inStock,
  };

  const { data, isLoading } = useQuery({
    queryKey:         ['search', params],
    queryFn:         () => productApi.search(params),
    placeholderData: (prev: any) => prev,
    staleTime:       0,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'], queryFn: catalogApi.getCategories, staleTime: 600_000,
  });
  
  const { data: brands = [] } = useQuery({
    queryKey: ['brands'], 
    queryFn: () => import('@/lib/api').then(m => m.catalogApi.getBrands()), 
    staleTime: 600_000,
  });

  const setFilter = useCallback((key: string, value: string | null | boolean) => {
    const p = new URLSearchParams(sp.toString());
    if (value === null || value === '' || value === false) p.delete(key);
    else p.set(key, String(value));
    p.delete('page');
    setPage(1);
    router.push(`/search?${p.toString()}`, { scroll: false });
  }, [sp, router]);

  const products    = (data?.data ?? []) as Product[];
  const total       = data?.meta?.total ?? 0;
  const totalPages  = data?.meta?.total_pages ?? 1;
  const hasFilters  = !!(category || brand || minPrice || maxPrice || minRating || inStock);

  return (
    <div className="container-page py-12 min-h-screen bg-white">
      {/* Header */}
      <div ref={headerRef} className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
        <div>
          <h1 className="text-5xl md:text-6xl font-light tracking-tighter text-gray-900 capitalize">
            {q ? `"${q}"` : category ? category.replace(/-/g, ' ') : 'All Collections'}
          </h1>
          <p className="mt-3 text-sm font-medium text-gray-500 tracking-wide">
            {total.toLocaleString()} products
          </p>
        </div>

        <div className="hidden md:block relative" ref={containerRef}>
          <div className="flex items-center bg-gray-50 rounded-full p-1 border border-gray-100 shadow-sm">
            <button onClick={() => setActiveMenu(activeMenu === 'sort' ? null : 'sort')}
              className={clsx('flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium tracking-wide transition-all',
                activeMenu === 'sort' ? 'bg-white shadow-sm text-black' : 'text-gray-600 hover:text-gray-900')}>
              <ArrowUpDown size={16} /> {currentSortLabel}
            </button>
            <div className="w-[1px] h-5 bg-gray-200 mx-2" />
            <button onClick={() => setActiveMenu(activeMenu === 'filters' ? null : 'filters')}
              className={clsx('flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium tracking-wide transition-all',
                activeMenu === 'filters' ? 'bg-white shadow-sm text-black' : 'text-gray-600 hover:text-gray-900')}>
              <SlidersHorizontal size={16} /> Filters
              {hasFilters && <span className="w-1.5 h-1.5 rounded-full bg-black ml-1.5 animate-pulse" />}
            </button>
          </div>
        </div>
      </div>

      {category && (
        <DiscountBanner
          categorySlug={category}
          title={`Discount codes for "${category.replace(/-/g, ' ')}"`}
        />
      )}
      {!category && !q && (
        <DiscountBanner title="Available discount codes" />
      )}

      <AnimatePresence>
        {isScrolled && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[200]"
          >
            <div ref={containerRef}
              className="flex items-center bg-white/95 backdrop-blur-2xl rounded-3xl p-1.5 border border-gray-100 shadow-2xl">
              <button onClick={() => setActiveMenu(activeMenu === 'sort' ? null : 'sort')}
                className={clsx('flex items-center gap-2.5 px-7 py-3.5 rounded-3xl text-sm font-semibold tracking-wide transition-all',
                  activeMenu === 'sort' ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100')}>
                <ArrowUpDown size={17} /> {currentSortLabel}
              </button>
              <div className="w-px h-7 bg-gray-200 mx-2" />
              <button onClick={() => setActiveMenu(activeMenu === 'filters' ? null : 'filters')}
                className={clsx('flex items-center gap-2.5 px-7 py-3.5 rounded-3xl text-sm font-semibold tracking-wide transition-all',
                  activeMenu === 'filters' ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100')}>
                <SlidersHorizontal size={17} /> Filters
                {hasFilters && <span className="ml-1 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Menus and Grid logic remains same as provided */}
      <AnimatePresence>
        {activeMenu && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            className="fixed lg:absolute top-24 lg:top-auto left-1/2 lg:left-auto lg:right-0 -translate-x-1/2 lg:translate-x-0 z-[210] w-80 bg-white border border-gray-100 shadow-[0_30px_60px_rgba(0,0,0,0.12)] rounded-[2.5rem] overflow-hidden"
          >
            {activeMenu === 'sort' && (
              <div className="flex flex-col py-4">
                {SORTS.map(s => (
                  <button key={s.value} onClick={() => { setFilter('sort', s.value); setActiveMenu(null); }}
                    className={clsx('flex items-center justify-between px-8 py-4 text-sm transition-all',
                      sort === s.value ? 'text-black font-semibold bg-gray-50' : 'text-gray-500 hover:text-black')}>
                    {s.label}
                    {sort === s.value && <Check size={16} className="text-black" />}
                  </button>
                ))}
              </div>
            )}

            {activeMenu === 'filters' && (
              <div className="flex flex-col">
                <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Refine</span>
                  <button onClick={() => { router.push(q ? `/search?q=${q}` : '/search'); setActiveMenu(null); }}
                    className="text-sm font-medium text-gray-900 hover:text-red-600 transition-colors">
                    Reset All
                  </button>
                </div>
                <div className="max-h-[55vh] overflow-y-auto p-8 space-y-10">
                  <section>
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Collections</p>
                    <div className="space-y-1">
                      {(categories as Category[]).map(c => (
                        <button key={c.id} onClick={() => setFilter('category', category === c.slug ? null : c.slug)}
                          className={clsx('w-full text-left py-3 px-4 rounded-2xl text-sm transition-all',
                            category === c.slug ? 'bg-black text-white font-medium' : 'text-gray-700 hover:bg-gray-100')}>
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </section>
                  <section>
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Price Range</p>
                    <div className="flex gap-3">
                      <input type="number" placeholder="Min" value={minPrice}
                        onChange={e => setFilter('min_price', e.target.value)}
                        className="w-full bg-gray-50 border border-transparent focus:border-gray-300 rounded-2xl px-5 py-3.5 text-sm" />
                      <input type="number" placeholder="Max" value={maxPrice}
                        onChange={e => setFilter('max_price', e.target.value)}
                        className="w-full bg-gray-50 border border-transparent focus:border-gray-300 rounded-2xl px-5 py-3.5 text-sm" />
                    </div>
                  </section>
                  <section>
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Brands</p>
                    <div className="space-y-2">
                      {(brands as Brand[]).map((b: Brand) => (
                        <button key={b.id} onClick={() => setFilter('brand', brand === b.slug ? null : b.slug)}
                          className={clsx('flex items-center justify-between w-full py-3 px-4 rounded-2xl text-sm transition-all',
                            brand === b.slug ? 'bg-black text-white font-medium' : 'text-gray-700 hover:bg-gray-100')}>
                          {b.name}
                          {brand === b.slug && <Check size={16} />}
                        </button>
                      ))}
                    </div>
                  </section>
                  <section>
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Customer Rating</p>
                    <div className="space-y-3">
                      {[4, 3, 2].map(r => (
                        <button key={r}
                          onClick={() => setFilter('min_rating', minRating === String(r) ? null : String(r))}
                          className={clsx('w-full flex items-center gap-4 p-4 rounded-2xl border transition-all',
                            minRating === String(r) ? 'bg-black text-white border-black' : 'bg-gray-50 border-transparent hover:border-gray-200')}>
                          <div className="flex gap-0.5">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} size={14}
                                fill={i < r ? 'currentColor' : 'none'}
                                className={i < r ? (minRating === String(r) ? 'text-white' : 'text-amber-400') : 'text-gray-300'} />
                            ))}
                          </div>
                          <span className="text-sm font-medium">& Up</span>
                        </button>
                      ))}
                    </div>
                  </section>
                </div>
                <div className="p-6 bg-gray-50 border-t border-gray-100">
                  <div className="flex items-center justify-between cursor-pointer"
                    onClick={() => setFilter('in_stock', !inStock ? 'true' : null)}>
                    <div>
                      <span className="font-medium">In Stock Only</span>
                      <p className="text-xs text-gray-500">Hide unavailable items</p>
                    </div>
                    <div className={clsx('relative w-12 h-6 rounded-full transition-colors flex items-center px-1',
                      inStock ? 'bg-black' : 'bg-gray-200')}>
                      <motion.div layout transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className="w-4 h-4 bg-white rounded-full shadow-sm"
                        animate={{ x: inStock ? 24 : 0 }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative">
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-4">
                <div className="aspect-[4/5] bg-gray-100 animate-pulse rounded-3xl" />
                <div className="h-4 bg-gray-100 animate-pulse rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <ProductGrid products={products} />
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-8 mt-20">
                <button disabled={page === 1}
                  onClick={() => { setPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="px-8 py-3 text-sm font-medium border border-gray-200 rounded-2xl disabled:opacity-40 hover:bg-gray-50 transition-colors">
                  Previous
                </button>
                <span className="text-sm text-gray-500 font-medium">Page {page} of {totalPages}</span>
                <button disabled={page === totalPages}
                  onClick={() => { setPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="px-8 py-3 text-sm font-medium border border-gray-200 rounded-2xl disabled:opacity-40 hover:bg-gray-50 transition-colors">
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── MAIN EXPORT WITH SUSPENSE ───
export default function SearchPage() {
  return (
    <Suspense 
      fallback={
        <div className="container-page py-12 min-h-screen flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-gray-300 mb-4" />
          <p className="text-gray-400 text-sm animate-pulse">Initializing search...</p>
        </div>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}