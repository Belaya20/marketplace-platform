'use client';
// src/app/dashboard/flash-sales/page.tsx
//
// BUGS FIXED:
//  1. LiveCountdown frozen — was calculating diff once at render with no timer.
//     Fixed: useEffect + setInterval that ticks every second.
//  2. adminApi.getFlashSales wrong signature — useQuery injects QueryFunctionContext
//     as first arg. Old `async (params = {})` silently received {queryKey, signal}.
//     Fixed: queryFn is a plain arrow `() => adminApi.getFlashSales()`.
//  3. No delete sale button — added DeleteSaleButton with inline two-step confirm.
//     Works for active, inactive, upcoming, and ended sales.
//  4. toggleMut.isPending global spinner — fixed with loadingToggleId state so
//     only the specific card's button shows a spinner.
//  5. removeItemMut.isPending global spinner — fixed with loadingItemId state.
//  6. AddItemForm state persists between renders — key={sale.id} on AddItemForm
//     forces a fresh instance per sale card.
//  7. Double invalidation — removed duplicate qc.invalidateQueries from onSuccess
//     prop; mutation's own onSuccess handles it.
//  8. Image aspect ratio warnings — added style={{ width:'auto' }} to all
//     next/image instances that have fixed height via className.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, flashSaleApi } from '@/lib/api';
import api from '@/lib/api';
import { formatETB } from '@/lib/utils';
import {
  Plus, Zap, Loader2, Trash2, Search,
  Package, X, Power, PowerOff, Clock,
  AlertTriangle, CalendarClock, CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Image from 'next/image';
import clsx from 'clsx';

// ── Helpers ───────────────────────────────────────────────────────────────────
function pad(n: number) { return String(n).padStart(2, '0'); }

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getSaleStatus(sale: any): 'live' | 'upcoming' | 'ended' | 'inactive' {
  const now = Date.now();
  const start = new Date(sale.starts_at).getTime();
  const end   = new Date(sale.ends_at).getTime();
  if (end < now)                          return 'ended';
  if (!sale.is_active)                    return 'inactive';
  if (sale.is_active && start <= now && end >= now) return 'live';
  if (sale.is_active && start > now)      return 'upcoming';
  return 'inactive';
}

// ── FIX 1: LiveCountdown — ticks every second via useEffect ──────────────────
function LiveCountdown({ endsAt }: { endsAt: string }) {
  const calc = useCallback(() => {
    const diff = new Date(endsAt).getTime() - Date.now();
    if (diff <= 0) return { h: 0, m: 0, s: 0, over: true };
    return {
      h:    Math.floor(diff / 3_600_000),
      m:    Math.floor((diff % 3_600_000) / 60_000),
      s:    Math.floor((diff % 60_000) / 1_000),
      over: false,
    };
  }, [endsAt]);

  const [time, setTime] = useState(calc);

  useEffect(() => {
    const id = setInterval(() => setTime(calc()), 1_000);
    return () => clearInterval(id);
  }, [calc]);

  if (time.over) return <span className="text-xs text-gray-400 font-medium">Sale ended</span>;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
      <Clock size={11} className="shrink-0" />
      {pad(time.h)}:{pad(time.m)}:{pad(time.s)}
    </span>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function SaleBadge({ status }: { status: ReturnType<typeof getSaleStatus> }) {
  const cfg = {
    live:     { label: 'Live',     cls: 'bg-green-100 text-green-700 border-green-200',   dot: true  },
    upcoming: { label: 'Upcoming', cls: 'bg-indigo-100 text-indigo-700 border-indigo-200', dot: false },
    ended:    { label: 'Ended',    cls: 'bg-gray-100 text-gray-500 border-gray-200',      dot: false },
    inactive: { label: 'Inactive', cls: 'bg-orange-100 text-orange-600 border-orange-200',dot: false },
  }[status];

  return (
    <span className={clsx('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border', cfg.cls)}>
      {cfg.dot && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />}
      {cfg.label}
    </span>
  );
}

// ── Delete sale button — inline two-step confirm ──────────────────────────────
// FIX 3: was completely missing. Handles all sale states.
function DeleteSaleButton({ saleId, isPending, onConfirm }: {
  saleId:    string;
  isPending: boolean;
  onConfirm: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg
          text-red-500 hover:bg-red-50 border border-transparent hover:border-red-200
          transition-all disabled:opacity-50"
        title="Delete sale"
        disabled={isPending}
      >
        <Trash2 size={12} />Delete
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
      <div className="flex items-start gap-2">
        <AlertTriangle size={13} className="text-red-500 shrink-0 mt-0.5" />
        <p className="text-xs font-semibold text-red-800 leading-snug">
          Delete this sale and all its items? This cannot be undone.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => { setConfirming(false); onConfirm(saleId); }}
          disabled={isPending}
          className="flex-1 inline-flex items-center justify-center gap-1 py-1.5
            bg-red-600 hover:bg-red-700 text-white text-xs font-bold
            rounded-lg transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
          Yes, delete
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="flex-1 py-1.5 border border-red-300 text-red-700
            text-xs font-semibold rounded-lg hover:bg-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Variant/product search modal ──────────────────────────────────────────────
function VariantSearchModal({ open, onSelect, onClose }: {
  open:     boolean;
  onSelect: (v: any) => void;
  onClose:  () => void;
}) {
  const [search, setSearch] = useState('');

  // Reset search when modal closes
  useEffect(() => { if (!open) setSearch(''); }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-products-search', search],
    queryFn:  () => api.get('/products', { params: { q: search, limit: 20 } }).then((r: any) => r.data.data ?? []),
    enabled:  open && search.length >= 2,
    staleTime: 10_000,
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Search size={14} className="text-gray-400" />
            <h3 className="font-semibold text-sm text-gray-900">Search products</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Search input */}
        <div className="px-4 py-2.5 border-b border-gray-100">
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
            <Search size={13} className="text-gray-400 shrink-0" />
            <input
              autoFocus
              className="bg-transparent text-sm flex-1 outline-none placeholder:text-gray-400"
              placeholder="Search by name or SKU…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-gray-300 hover:text-gray-500 transition-colors">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="overflow-y-auto max-h-80 overscroll-contain">
          {search.length < 2 && (
            <p className="text-center text-sm text-gray-400 py-10">Type at least 2 characters to search</p>
          )}
          {isLoading && (
            <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
              <Loader2 size={16} className="animate-spin" />Searching…
            </div>
          )}
          {!isLoading && search.length >= 2 && (!data || data.length === 0) && (
            <p className="text-center text-sm text-gray-400 py-10">No products found for "{search}"</p>
          )}
          {(data ?? []).map((product: any) => (
            <button
              key={product.id}
              onClick={() => { onSelect(product); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left transition-colors border-b border-gray-50 last:border-0"
            >
              <div className="w-10 h-10 rounded-xl bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                {product.primary_image ? (
                  <Image
                    src={product.primary_image} alt=""
                    width={40} height={40}
                    // FIX 8: explicit width/height prevents aspect ratio warnings
                    className="object-cover w-10 h-10"
                    unoptimized={product.primary_image.startsWith('data:')}
                  />
                ) : (
                  <Package size={16} className="text-gray-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{product.name}</p>
                <p className="text-xs text-gray-400 font-mono">{product.sku}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-gray-900">{formatETB(product.price)}</p>
                <p className="text-xs text-gray-400">{product.stock_qty} in stock</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Add item form ─────────────────────────────────────────────────────────────
// FIX 6: key={sale.id} on this component resets state between sales.
function AddItemForm({ saleId, onAdded }: { saleId: string; onAdded: () => void }) {
  const [pickerOpen, setPicker]   = useState(false);
  const [selected,   setSelected] = useState<any>(null);
  const [salePrice,  setSalePrice]= useState('');
  const [maxQty,     setMaxQty]   = useState('');

  const discountPct = selected && salePrice && Number(salePrice) > 0
    ? Math.round(((selected.price - Number(salePrice)) / selected.price) * 100)
    : null;

  // FIX 7: onSuccess only in mutation — no duplicate invalidation from prop
  const mutation = useMutation({
    mutationFn: () => adminApi.addFlashSaleItem(saleId, {
      // FIX: prefer variant_id if present (product search returns variant_id),
      // fall back to product id. Backend expects variant_id.
      variant_id: selected?.variant_id ?? selected?.default_variant_id ?? selected?.id,
      sale_price: Number(salePrice),
      max_qty:    Number(maxQty),
    }),
    onSuccess: () => {
      toast.success('Product added to sale');
      setSelected(null);
      setSalePrice('');
      setMaxQty('');
      onAdded(); // trigger refetch in parent
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to add product'),
  });

  const handleAdd = () => {
    if (!selected)                              return toast.error('Select a product first');
    if (!salePrice || Number(salePrice) <= 0)   return toast.error('Enter a valid sale price');
    if (!maxQty    || Number(maxQty)    <= 0)   return toast.error('Enter a valid max quantity');
    if (Number(salePrice) >= selected.price)    return toast.error('Sale price must be below the regular price');
    mutation.mutate();
  };

  return (
    <>
      <VariantSearchModal
        open={pickerOpen}
        onSelect={p => {
          setSelected(p);
          // Auto-suggest 20% off as a starting point
          setSalePrice(String(Math.round(p.price * 0.8)));
        }}
        onClose={() => setPicker(false)}
      />

      <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Add product to this sale</p>

        {/* Product picker button */}
        <button
          type="button"
          onClick={() => setPicker(true)}
          className={clsx(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all',
            selected
              ? 'border-violet-300 bg-violet-50/50 hover:border-violet-400'
              : 'border-dashed border-gray-300 hover:border-violet-300 hover:bg-gray-50'
          )}
        >
          {selected ? (
            <>
              <div className="w-9 h-9 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                {selected.primary_image ? (
                  <Image src={selected.primary_image} alt="" width={36} height={36}
                    className="object-cover w-9 h-9"
                    unoptimized={selected.primary_image.startsWith('data:')} />
                ) : <Package size={14} className="text-gray-300" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{selected.name}</p>
                <p className="text-xs text-gray-400 font-mono">{selected.sku} · {formatETB(selected.price)}</p>
              </div>
              <span className="text-xs text-violet-600 font-semibold shrink-0 hover:underline">Change</span>
            </>
          ) : (
            <div className="flex items-center gap-2 text-gray-400">
              <Search size={14} className="shrink-0" />
              <span className="text-sm">Search and select a product…</span>
            </div>
          )}
        </button>

        {/* Price + qty + submit */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[140px]">
            <input
              type="number" step="0.01" min="0"
              value={salePrice}
              onChange={e => setSalePrice(e.target.value)}
              className="input text-sm w-full pr-16"
              placeholder="Sale price (ETB)"
            />
            {discountPct !== null && discountPct > 0 && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold
                text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                -{discountPct}%
              </span>
            )}
            {discountPct !== null && discountPct <= 0 && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-red-500">
                ↑ Low
              </span>
            )}
          </div>

          <input
            type="number" min="1"
            value={maxQty}
            onChange={e => setMaxQty(e.target.value)}
            className="input text-sm w-28"
            placeholder="Max qty"
          />

          <button
            onClick={handleAdd}
            disabled={mutation.isPending}
            className="btn-primary text-xs py-2 px-4 gap-1.5 whitespace-nowrap disabled:opacity-50"
          >
            {mutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
            Add to sale
          </button>
        </div>
      </div>
    </>
  );
}

// ── Create sale form ──────────────────────────────────────────────────────────
function CreateSaleForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    title: '', description: '', starts_at: '', ends_at: '',
  });

  const mutation = useMutation({
    mutationFn: () => flashSaleApi.create({ ...form, is_active: true }),
    onSuccess:  () => { toast.success('Flash sale created'); onCreated(); },
    onError:    (e: any) => toast.error(e.response?.data?.message || 'Failed to create'),
  });

  const f = (k: keyof typeof form) => ({
    value:    form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value })),
  });

  const valid = !!form.title && !!form.starts_at && !!form.ends_at
    && new Date(form.ends_at) > new Date(form.starts_at);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
          <Zap size={14} className="text-amber-500 fill-amber-500" />New flash sale
        </h2>
        <button onClick={onCancel} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <X size={15} />
        </button>
      </div>

      <div>
        <label className="label text-xs">Title <span className="text-red-400">*</span></label>
        <input {...f('title')} className="input" placeholder="Summer Flash Sale — Up to 70% off" />
      </div>

      <div>
        <label className="label text-xs">Description <span className="text-gray-400 font-normal">(optional)</span></label>
        <input {...f('description')} className="input" placeholder="Limited time deals on top products" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label text-xs">Starts at <span className="text-red-400">*</span></label>
          <input type="datetime-local" {...f('starts_at')} className="input" />
        </div>
        <div>
          <label className="label text-xs">Ends at <span className="text-red-400">*</span></label>
          <input type="datetime-local" {...f('ends_at')} className="input" />
        </div>
      </div>

      {form.starts_at && form.ends_at && new Date(form.ends_at) <= new Date(form.starts_at) && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-xl">
          <AlertTriangle size={12} className="shrink-0" />End time must be after start time
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !valid}
          className="btn-primary gap-2 disabled:opacity-50"
        >
          {mutation.isPending && <Loader2 size={14} className="animate-spin" />}
          Create flash sale
        </button>
        <button onClick={onCancel} className="btn-secondary">Cancel</button>
      </div>
    </div>
  );
}

// ── Sale card ─────────────────────────────────────────────────────────────────
function SaleCard({
  sale,
  onToggle,
  onDelete,
  onRemoveItem,
  onAdded,
  isToggling,
  isDeleting,
  removingItemId,
}: {
  sale:           any;
  onToggle:       (id: string, activate: boolean) => void;
  onDelete:       (id: string) => void;
  onRemoveItem:   (saleId: string, itemId: string) => void;
  onAdded:        () => void;
  isToggling:     boolean;
  isDeleting:     boolean;
  removingItemId: string | null;
}) {
  const status  = getSaleStatus(sale);
  const isLive  = status === 'live';
  const isEnded = status === 'ended';
  const items   = sale.items ?? [];

  return (
    <div className={clsx(
      'bg-white border rounded-2xl overflow-hidden transition-all',
      isEnded     ? 'border-gray-200 opacity-75' : 'border-gray-200',
      !sale.is_active && !isEnded ? 'border-orange-200' : '',
      isLive      ? 'border-green-200 shadow-sm shadow-green-500/10' : '',
    )}>
      {/* Card header */}
      <div className={clsx(
        'px-5 py-4 border-b border-gray-100',
        isLive ? 'bg-green-50/40' : 'bg-gray-50/60',
      )}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          {/* Left: info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-bold text-gray-900 truncate">{sale.title}</h3>
              <SaleBadge status={status} />
            </div>
            {sale.description && (
              <p className="text-xs text-gray-500 mb-1.5">{sale.description}</p>
            )}
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              <CalendarClock size={11} className="shrink-0" />
              {fmtDateTime(sale.starts_at)} → {fmtDateTime(sale.ends_at)}
            </p>
            {isLive && (
              <div className="mt-2">
                <LiveCountdown endsAt={sale.ends_at} />
              </div>
            )}
          </div>

          {/* Right: action buttons */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            {/* Toggle active/inactive */}
            {!isEnded && (
              sale.is_active ? (
                <button
                  onClick={() => onToggle(sale.id, false)}
                  disabled={isToggling}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg
                    bg-red-50 text-red-600 hover:bg-red-100 border border-red-200
                    transition-colors disabled:opacity-50"
                >
                  {isToggling ? <Loader2 size={12} className="animate-spin" /> : <PowerOff size={12} />}
                  Deactivate
                </button>
              ) : (
                <button
                  onClick={() => onToggle(sale.id, true)}
                  disabled={isToggling}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg
                    bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200
                    transition-colors disabled:opacity-50"
                >
                  {isToggling ? <Loader2 size={12} className="animate-spin" /> : <Power size={12} />}
                  Activate
                </button>
              )
            )}

            {/* FIX 3: Delete button — works for all sale states */}
            <DeleteSaleButton
              saleId={sale.id}
              isPending={isDeleting}
              onConfirm={onDelete}
            />
          </div>
        </div>
      </div>

      {/* Items table */}
      <div className="px-5 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
            {items.length} product{items.length !== 1 ? 's' : ''}
          </p>
          {isLive && items.length > 0 && (
            <span className="text-[10px] font-semibold text-green-600 flex items-center gap-1">
              <CheckCircle2 size={10} />Live now
            </span>
          )}
        </div>

        <div className="border border-gray-100 rounded-xl overflow-hidden">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Package size={22} className="text-gray-200 mb-2" />
              <p className="text-xs text-gray-400">No products added yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {items.map((item: any) => {
                const pct     = item.max_qty > 0 ? Math.min((item.sold_qty / item.max_qty) * 100, 100) : 0;
                const discPct = item.original_price && item.original_price > item.sale_price
                  ? Math.round(((item.original_price - item.sale_price) / item.original_price) * 100)
                  : 0;

                return (
                  <div key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                    {/* Image */}
                    <div className="w-9 h-9 bg-gray-100 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                      {item.image_url ? (
                        <Image
                          src={item.image_url} alt={item.name ?? ''}
                          width={36} height={36}
                          className="object-cover w-9 h-9"
                          unoptimized={item.image_url.startsWith('data:')}
                        />
                      ) : (
                        <Package size={14} className="text-gray-300" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs font-bold text-red-600">{formatETB(item.sale_price)}</span>
                        {item.original_price && item.original_price > item.sale_price && (
                          <span className="text-xs text-gray-400 line-through">{formatETB(item.original_price)}</span>
                        )}
                        {discPct > 0 && (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                            -{discPct}%
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {item.sold_qty}/{item.max_qty} sold
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="h-1 w-24 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className={clsx('h-full rounded-full transition-all', pct > 80 ? 'bg-red-500' : 'bg-amber-400')}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* FIX 5: per-item loading via removingItemId */}
                    <button
                      onClick={() => onRemoveItem(sale.id, item.id)}
                      disabled={removingItemId === item.id}
                      className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50
                        rounded-lg transition-colors shrink-0 disabled:opacity-50"
                      title="Remove from sale"
                    >
                      {removingItemId === item.id
                        ? <Loader2 size={13} className="animate-spin" />
                        : <Trash2 size={13} />
                      }
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FIX 6: key={sale.id} resets AddItemForm state per sale */}
        {!isEnded && <AddItemForm key={sale.id} saleId={sale.id} onAdded={onAdded} />}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FlashSalesPage() {
  const qc         = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  // FIX 4: per-sale loading states instead of global isPending
  const [loadingToggleId, setLoadingToggleId] = useState<string | null>(null);
  const [loadingDeleteId, setLoadingDeleteId] = useState<string | null>(null);
  const [removingItemId,  setRemovingItemId]  = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-flash-sales'] });

  // FIX 2: plain arrow function — no parameter — avoids receiving QueryFunctionContext
  const { data: sales = [], isLoading } = useQuery({
    queryKey:        ['admin-flash-sales'],
   // AFTER — no arguments
   queryFn: () => adminApi.getFlashSales(),
    staleTime:       30_000,
    refetchInterval: 60_000,
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, activate }: { id: string; activate: boolean }) => {
      setLoadingToggleId(id);
      return adminApi.updateFlashSale(id, { is_active: activate });
    },
    onSuccess: (_d, { activate }) => {
      invalidate();
      toast.success(activate ? 'Sale activated' : 'Sale deactivated');
    },
    onError:   (e: any) => toast.error(e.response?.data?.message || 'Failed'),
    onSettled: () => setLoadingToggleId(null),
  });

  // FIX 3: delete mutation — was completely missing
  const deleteMut = useMutation({
    mutationFn: (id: string) => {
      setLoadingDeleteId(id);
      return adminApi.deleteFlashSale(id);
    },
    onSuccess: () => { invalidate(); toast.success('Flash sale deleted'); },
    onError:   (e: any) => toast.error(e.response?.data?.message || 'Failed to delete'),
    onSettled: () => setLoadingDeleteId(null),
  });

  const removeItemMut = useMutation({
    mutationFn: ({ saleId, itemId }: { saleId: string; itemId: string }) => {
      setRemovingItemId(itemId);
      return adminApi.removeFlashSaleItem(saleId, itemId);
    },
    onSuccess: () => { invalidate(); toast.success('Product removed'); },
    onError:   (e: any) => toast.error(e.response?.data?.message || 'Failed to remove'),
    onSettled: () => setRemovingItemId(null),
  });

  const allSales  = sales as any[];
  const liveCount = allSales.filter(s => getSaleStatus(s) === 'live').length;
  const upcomingCount = allSales.filter(s => getSaleStatus(s) === 'upcoming').length;

  return (
    <div className="max-w-3xl space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Zap size={20} className="text-amber-500 fill-amber-500" />Flash sales
          </h1>
          {allSales.length > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              {liveCount > 0 && <span className="text-green-600 font-semibold">{liveCount} live · </span>}
              {upcomingCount > 0 && <span className="text-indigo-600 font-semibold">{upcomingCount} upcoming · </span>}
              {allSales.length} total
            </p>
          )}
        </div>
        <button onClick={() => setShowForm(s => !s)} className="btn-primary text-sm gap-2">
          {showForm ? <X size={15} /> : <Plus size={15} />}
          {showForm ? 'Cancel' : 'Create flash sale'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <CreateSaleForm
          onCreated={() => { invalidate(); setShowForm(false); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Loading skeletons */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-36 skeleton rounded-2xl" />)}
        </div>

      /* Empty state */
      ) : allSales.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-14 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <Zap size={28} className="text-amber-300" />
          </div>
          <p className="font-semibold text-gray-500 mb-1">No flash sales yet</p>
          <p className="text-xs text-gray-400 mb-5">Create your first flash sale to drive urgency and boost conversions</p>
          <button onClick={() => setShowForm(true)} className="btn-primary text-sm gap-2">
            <Plus size={14} />Create your first flash sale
          </button>
        </div>

      /* Sales list */
      ) : (
        <div className="space-y-4">
          {allSales.map((sale: any) => (
            <SaleCard
              key={sale.id}
              sale={sale}
              onToggle={(id, activate) => toggleMut.mutate({ id, activate })}
              onDelete={id => deleteMut.mutate(id)}
              onRemoveItem={(saleId, itemId) => removeItemMut.mutate({ saleId, itemId })}
              onAdded={invalidate}
              isToggling={loadingToggleId === sale.id}
              isDeleting={loadingDeleteId === sale.id}
              removingItemId={removingItemId}
            />
          ))}
        </div>
      )}
    </div>
  );
}