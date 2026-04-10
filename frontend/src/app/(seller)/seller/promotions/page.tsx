'use client';
// src/app/(seller)/seller/promotions/page.tsx
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { flashSaleApi, productApi, catalogApi } from '@/lib/api';
import api from '@/lib/api';
import {
  Tag, Zap, Plus, Loader2, Copy, Check, Trash2,
  ChevronDown, Calendar, Percent, DollarSign,
  Truck, Clock, ShoppingBag, AlertCircle, X, Search,
  TrendingDown, Package, RefreshCw, Globe, FolderOpen,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatETB } from '@/hooks';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DiscountCode {
  id: string; code: string;
  type: 'percentage' | 'fixed_amount' | 'free_shipping';
  value: number; min_order: number;
  starts_at: string; expires_at: string;
  usage_count: number; usage_limit: number | null;
  is_active: boolean;
  category_id: string | null; product_id: string | null; description: string | null;
  category_name?: string; product_name?: string;
}
interface ProductVariant {
  id: string; sku: string; price: number; stock_qty: number;
  product: { name: string; images?: { url: string }[] };
}
interface FlashSale {
  id: string; title: string; description?: string;
  starts_at: string; ends_at: string;
  items?: any[];
}

// ── API ───────────────────────────────────────────────────────────────────────
const discountApi = {
  getMine:  ()           => api.get('/seller/discounts').then((r: any) => r.data.data ?? []),
  create:   (body: any)  => api.post('/seller/discounts', body).then((r: any) => r.data.data),
  toggle:   (id: string) => api.patch(`/seller/discounts/${id}/toggle`).then((r: any) => r.data.data),
  remove:   (id: string) => api.delete(`/seller/discounts/${id}`),
};

const TYPE_META = {
  percentage:    { label: 'Percentage off', icon: Percent,    color: 'text-violet-600 bg-violet-50' },
  fixed_amount:  { label: 'Fixed amount',   icon: DollarSign, color: 'text-blue-600 bg-blue-50' },
  free_shipping: { label: 'Free shipping',  icon: Truck,      color: 'text-emerald-600 bg-emerald-50' },
} as const;

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function timeLeft(end: string) {
  const diff = new Date(end).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 48) return `${Math.floor(h / 24)}d left`;
  if (h > 0)  return `${h}h ${m}m left`;
  return `${m}m left`;
}

function CountdownBadge({ end }: { end: string }) {
  const [label, setLabel] = useState(timeLeft(end));
  useEffect(() => { const id = setInterval(() => setLabel(timeLeft(end)), 30000); return () => clearInterval(id); }, [end]);
  const over = label === 'Ended';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${over ? 'bg-gray-100 text-gray-400' : 'bg-amber-50 text-amber-700'}`}>
      <Clock size={10} />{label}
    </span>
  );
}

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button onClick={copy} className="flex items-center gap-1.5 group">
      <span className="font-mono font-bold text-sm tracking-widest text-gray-900">{code}</span>
      <span className={`transition-all ${copied ? 'text-emerald-500' : 'text-gray-300 group-hover:text-gray-500'}`}>
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </span>
    </button>
  );
}

function UsageBar({ used, limit }: { used: number; limit: number | null }) {
  if (!limit) return <span className="text-xs text-gray-400">{used} uses · unlimited</span>;
  const pct = Math.min((used / limit) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-400"><span>{used}/{limit} uses</span><span>{Math.round(pct)}%</span></div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${pct > 80 ? 'bg-red-400' : pct > 50 ? 'bg-amber-400' : 'bg-violet-400'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Scope badge ───────────────────────────────────────────────────────────────
function ScopeBadge({ code }: { code: DiscountCode }) {
  if (code.category_id && code.category_name) return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
      <FolderOpen size={10} />{code.category_name}
    </span>
  );
  if (code.product_id && code.product_name) return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
      <Package size={10} />{code.product_name}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
      <Globe size={10} />All products
    </span>
  );
}

// ── Discount card ─────────────────────────────────────────────────────────────
function DiscountCard({ code, onToggle, onDelete }: {
  code: DiscountCode; onToggle: (id: string) => void; onDelete: (id: string) => void;
}) {
  const meta    = TYPE_META[code.type];
  const Icon    = meta.icon;
  const expired = new Date(code.expires_at) < new Date();

  return (
    <div className={`card p-4 transition-all ${!code.is_active || expired ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.color}`}><Icon size={15} /></div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CopyCode code={code.code} />
            <div className="flex items-center gap-2">
              {expired ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">Expired</span>
              ) : (
                <button onClick={() => onToggle(code.id)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${code.is_active ? 'bg-violet-500' : 'bg-gray-200'}`}>
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${code.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              )}
              <button onClick={() => onDelete(code.id)} className="p-1 text-gray-300 hover:text-red-400 transition-colors rounded"><Trash2 size={13} /></button>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${meta.color}`}>
              {code.type === 'percentage' && `${code.value}% off`}
              {code.type === 'fixed_amount' && `${formatETB(code.value)} off`}
              {code.type === 'free_shipping' && 'Free shipping'}
            </span>
            {code.min_order > 0 && <span className="text-xs text-gray-400">Min. {formatETB(code.min_order)}</span>}
            <ScopeBadge code={code} />
          </div>
          {code.description && <p className="text-xs text-gray-500 italic">"{code.description}"</p>}
          <div className="flex items-center gap-1 text-xs text-gray-400"><Calendar size={10} /><span>{fmtDate(code.starts_at)} — {fmtDate(code.expires_at)}</span></div>
          <UsageBar used={code.usage_count} limit={code.usage_limit} />
        </div>
      </div>
    </div>
  );
}

// ── Variant picker ────────────────────────────────────────────────────────────
function VariantPicker({ open, onSelect, onClose }: {
  open: boolean; onSelect: (v: ProductVariant) => void; onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['seller-products-with-variants'],
    queryFn:  () => api.get('/seller/products-with-variants').then((r: any) => r.data.data ?? []),
    enabled:  open, staleTime: 60_000,
  });
  const variants: ProductVariant[] = (products as any[]).flatMap((p: any) =>
    (p.variants ?? []).map((v: any) => ({ ...v, product: { name: p.name, images: p.primary_image ? [{ url: p.primary_image }] : [] } }))
  );
  const filtered = variants.filter(v =>
    v.product.name.toLowerCase().includes(search.toLowerCase()) || v.sku.toLowerCase().includes(search.toLowerCase())
  );
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-sm text-gray-900">Select a variant</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 rounded-lg"><X size={16} /></button>
        </div>
        <div className="px-4 py-2.5 border-b border-gray-100">
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
            <Search size={13} className="text-gray-400" />
            <input autoFocus className="bg-transparent text-sm flex-1 outline-none placeholder:text-gray-400"
              placeholder="Search products or SKU…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="overflow-y-auto max-h-72 divide-y divide-gray-50">
          {isLoading && <div className="flex items-center justify-center py-10 text-gray-400 gap-2"><Loader2 size={18} className="animate-spin" />Loading…</div>}
          {!isLoading && filtered.length === 0 && <div className="py-10 text-center text-sm text-gray-400">No variants found</div>}
          {filtered.map(v => (
            <button key={v.id} onClick={() => { onSelect(v); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left transition-colors">
              <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                {v.product.images?.[0]?.url
                  ? <img src={v.product.images[0].url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><Package size={14} className="text-gray-300" /></div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{v.product.name}</p>
                <p className="text-xs text-gray-400 font-mono">{v.sku}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold">{formatETB(v.price)}</p>
                <p className="text-xs text-gray-400">{v.stock_qty} in stock</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Flash sale join form ──────────────────────────────────────────────────────
function FlashSaleJoinForm({ sale, onSuccess }: { sale: FlashSale; onSuccess: () => void }) {
  const [open,     setOpen]    = useState(false);
  const [pickerOpen, setPicker] = useState(false);
  const [selected, setSelected] = useState<ProductVariant | null>(null);
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<{ sale_price: string; max_qty: string }>({ defaultValues: { sale_price: '', max_qty: '' } });
  const salePrice = watch('sale_price');
  const discount  = selected && salePrice ? Math.round(((selected.price - Number(salePrice)) / selected.price) * 100) : null;
  const mutation  = useMutation({
    mutationFn: (body: any) => api.post(`/seller/flash-sales/${sale.id}/join`, body).then((r: any) => r.data.data),
    onSuccess: () => { toast.success('Joined flash sale!'); reset(); setSelected(null); setOpen(false); onSuccess(); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to join flash sale'),
  });
  const onSubmit = (data: any) => {
    if (!selected) { toast.error('Pick a variant first'); return; }
    mutation.mutate({ variant_id: selected.id, sale_price: Number(data.sale_price), max_qty: Number(data.max_qty) });
  };
  return (
    <>
      <VariantPicker open={pickerOpen} onSelect={v => { setSelected(v); setValue('sale_price', String(Math.round(v.price * 0.8))); setPicker(false); }} onClose={() => setPicker(false)} />
      <div className="border-t border-gray-100 mt-3 pt-3">
        <button type="button" onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 text-sm font-medium text-violet-600 hover:text-violet-700">
          {open ? <><X size={14} />Cancel</> : <><Plus size={14} />Add my product to this sale<ChevronDown size={13} /></>}
        </button>
        {open && (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-3 space-y-3">
            <div>
              <label className="label text-xs">Product variant *</label>
              <button type="button" onClick={() => setPicker(true)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${selected ? 'border-violet-300 bg-violet-50/50' : 'border-dashed border-gray-300 hover:border-violet-300 bg-gray-50'}`}>
                {selected ? (
                  <>
                    <div className="w-9 h-9 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                      {selected.product.images?.[0]?.url ? <img src={selected.product.images[0].url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Package size={12} className="text-gray-300" /></div>}
                    </div>
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{selected.product.name}</p><p className="text-xs text-gray-400 font-mono">{selected.sku} · {formatETB(selected.price)}</p></div>
                    <span className="text-xs text-violet-500 font-medium shrink-0">Change</span>
                  </>
                ) : <div className="flex items-center gap-2 text-gray-400"><ShoppingBag size={14} /><span className="text-sm">Click to pick a variant…</span></div>}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">Sale price (ETB) *</label>
                <div className="relative">
                  <input type="number" step="0.01" {...register('sale_price', { required: 'Required', min: { value: 1, message: 'Must be > 0' }, validate: v => !selected || Number(v) < selected.price || 'Must be below regular price' })} className="input text-sm pr-16" placeholder="0.00" />
                  {discount !== null && discount > 0 && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">-{discount}%</span>}
                </div>
                {errors.sale_price && <p className="text-red-500 text-xs mt-1">{String(errors.sale_price.message)}</p>}
              </div>
              <div>
                <label className="label text-xs">Max qty *</label>
                <input type="number" {...register('max_qty', { required: 'Required', min: { value: 1, message: 'Min 1' } })} className="input text-sm" placeholder="100" />
                {errors.max_qty && <p className="text-red-500 text-xs mt-1">{String(errors.max_qty.message)}</p>}
              </div>
            </div>
            {selected && discount !== null && (
              <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl ${discount <= 0 ? 'bg-red-50 text-red-600' : discount >= 20 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                <TrendingDown size={12} />
                {discount <= 0 ? 'Sale price must be lower than the regular price' : `${discount}% off from regular price of ${formatETB(selected.price)}`}
              </div>
            )}
            <button type="submit" disabled={mutation.isPending} className="btn-primary text-sm gap-2">
              {mutation.isPending ? <><Loader2 size={13} className="animate-spin" />Joining…</> : <><Zap size={13} />Join flash sale</>}
            </button>
          </form>
        )}
      </div>
    </>
  );
}

// ── Flash sale card ───────────────────────────────────────────────────────────
function FlashSaleCard({ sale, onRefresh }: { sale: FlashSale; onRefresh: () => void }) {
  const now        = new Date();
  const isLive     = new Date(sale.starts_at) <= now && new Date(sale.ends_at) >= now;
  const isUpcoming = new Date(sale.starts_at) > now;
  return (
    <div className="card overflow-hidden">
      <div className={`px-4 py-3 flex items-center justify-between border-b ${isLive ? 'bg-gradient-to-r from-red-50 to-orange-50 border-red-100' : isUpcoming ? 'bg-gradient-to-r from-violet-50 to-indigo-50 border-violet-100' : 'bg-gray-50 border-gray-100'}`}>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 text-sm">{sale.title}</h3>
            {isLive && <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500 text-white"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />LIVE</span>}
            {isUpcoming && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">UPCOMING</span>}
            {!isLive && !isUpcoming && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">ENDED</span>}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{fmtDate(sale.starts_at)} — {fmtDate(sale.ends_at)}</p>
          {sale.description && <p className="text-xs text-gray-500 mt-0.5">{sale.description}</p>}
        </div>
        <CountdownBadge end={sale.ends_at} />
      </div>
      <div className="p-4">
        {(sale.items ?? []).length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Your products in this sale</p>
            <div className="space-y-2">
              {(sale.items ?? []).map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{item.name ?? `Variant ${item.variant_id?.slice(0, 8)}…`}</p>
                    <p className="text-xs text-gray-400">Sale: <span className="font-semibold text-emerald-600">{formatETB(item.sale_price)}</span></p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium text-gray-700">{item.sold_qty}/{item.max_qty} sold</p>
                    <div className="w-16 h-1.5 bg-gray-200 rounded-full mt-1"><div className="h-full bg-violet-400 rounded-full" style={{ width: `${Math.min((item.sold_qty / item.max_qty) * 100, 100)}%` }} /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {(isLive || isUpcoming) && <FlashSaleJoinForm sale={sale} onSuccess={onRefresh} />}
      </div>
    </div>
  );
}

// ── Create discount form ──────────────────────────────────────────────────────
function CreateDiscountForm({ onSuccess }: { onSuccess: () => void }) {
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({
    defaultValues: { code: '', type: 'percentage', value: '', min_order: '', usage_limit: '', starts_at: '', expires_at: '', description: '', scope: 'global', category_id: '', product_id: '' },
  });
  const type  = watch('type');
  const code  = watch('code');
  const scope = watch('scope');

  // Load categories and seller's own products for scope selection
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: catalogApi.getCategories, staleTime: 600_000 });
  const { data: myProducts = [] } = useQuery({
    queryKey: ['my-products-for-discount'],
    queryFn:  () => api.get('/seller/products-with-variants').then((r: any) => r.data.data ?? []),
    staleTime: 120_000,
  });

  // Flatten category tree
  const flatCats: any[] = [];
  const flatten = (cats: any[], depth = 0) => cats.forEach((c: any) => { flatCats.push({ ...c, depth }); if (c.children?.length) flatten(c.children, depth + 1); });
  flatten(categories as any[]);

  const mutation = useMutation({
    mutationFn: discountApi.create,
    onSuccess: () => { toast.success('Discount code created!'); reset(); onSuccess(); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to create discount'),
  });

  const onSubmit = (data: any) => {
    mutation.mutate({
      code:        data.code.toUpperCase(),
      type:        data.type,
      value:       data.type !== 'free_shipping' ? Number(data.value) : 0,
      min_order:   data.min_order   ? Number(data.min_order)   : 0,
      usage_limit: data.usage_limit ? Number(data.usage_limit) : null,
      starts_at:   data.starts_at,
      expires_at:  data.expires_at,
      description: data.description || null,
      category_id: data.scope === 'category' ? data.category_id || null : null,
      product_id:  data.scope === 'product'  ? data.product_id  || null : null,
    });
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const rand  = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    reset({ ...watch(), code: rand });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Code */}
      <div>
        <label className="label text-xs">Discount code *</label>
        <div className="flex gap-2">
          <input {...register('code', { required: 'Code is required', minLength: { value: 3, message: 'Min 3 characters' }, pattern: { value: /^[A-Z0-9_-]+$/i, message: 'Letters, numbers, _ and - only' } })}
            className="input flex-1 font-mono uppercase text-sm tracking-widest" placeholder="SUMMER20" style={{ textTransform: 'uppercase' }} />
          <button type="button" onClick={generateCode} className="btn-secondary text-xs px-3 whitespace-nowrap">Generate</button>
        </div>
        {errors.code && <p className="text-red-500 text-xs mt-1">{String(errors.code.message)}</p>}
        {code && <div className="flex items-center gap-1.5 mt-1.5"><span className="text-xs text-gray-400">Preview:</span><span className="font-mono text-xs font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-md tracking-widest">{code.toUpperCase()}</span></div>}
      </div>

      {/* Description */}
      <div>
        <label className="label text-xs">Description (shown to shoppers)</label>
        <input {...register('description')} className="input text-sm" placeholder="e.g. New customer exclusive — 20% off all electronics" />
      </div>

      {/* Type */}
      <div>
        <label className="label text-xs">Discount type *</label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(TYPE_META) as [keyof typeof TYPE_META, typeof TYPE_META[keyof typeof TYPE_META]][]).map(([key, meta]) => {
            const Icon = meta.icon; const selected = type === key;
            return (
              <label key={key} className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border cursor-pointer transition-all ${selected ? 'border-violet-400 bg-violet-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input type="radio" value={key} {...register('type')} className="sr-only" />
                <Icon size={15} className={selected ? 'text-violet-600' : 'text-gray-400'} />
                <span className={`text-[11px] font-medium text-center leading-tight ${selected ? 'text-violet-700' : 'text-gray-500'}`}>{meta.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Value + min + limit */}
      <div className="grid grid-cols-2 gap-3">
        {type !== 'free_shipping' && (
          <div>
            <label className="label text-xs">{type === 'percentage' ? 'Percentage (%)' : 'Amount (ETB)'} *</label>
            <input type="number" step={type === 'percentage' ? '1' : '0.01'} {...register('value', { required: type !== 'free_shipping' ? 'Required' : false, min: { value: 0.01, message: 'Must be > 0' }, max: type === 'percentage' ? { value: 100, message: 'Max 100%' } : undefined })} className="input text-sm" placeholder={type === 'percentage' ? '20' : '100.00'} />
            {errors.value && <p className="text-red-500 text-xs mt-1">{String(errors.value.message)}</p>}
          </div>
        )}
        <div><label className="label text-xs">Min. order (ETB)</label><input type="number" step="0.01" {...register('min_order')} className="input text-sm" placeholder="0.00" /></div>
        <div><label className="label text-xs">Usage limit</label><input type="number" {...register('usage_limit')} className="input text-sm" placeholder="Unlimited" /></div>
      </div>

      {/* ── SCOPE — what products/categories this code applies to ── */}
      <div>
        <label className="label text-xs">Applies to</label>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { value: 'global',   label: 'All products',  icon: Globe },
            { value: 'category', label: 'A category',    icon: FolderOpen },
            { value: 'product',  label: 'One product',   icon: Package },
          ].map(s => {
            const Icon = s.icon; const sel = scope === s.value;
            return (
              <label key={s.value} className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border cursor-pointer transition-all ${sel ? 'border-violet-400 bg-violet-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input type="radio" value={s.value} {...register('scope')} className="sr-only" />
                <Icon size={15} className={sel ? 'text-violet-600' : 'text-gray-400'} />
                <span className={`text-[11px] font-medium text-center leading-tight ${sel ? 'text-violet-700' : 'text-gray-500'}`}>{s.label}</span>
              </label>
            );
          })}
        </div>

        {scope === 'category' && (
          <div>
            <label className="label text-xs">Select category *</label>
            <select {...register('category_id')} className="input text-sm">
              <option value="">Choose a category…</option>
              {flatCats.map((c: any) => <option key={c.id} value={c.id}>{'  '.repeat(c.depth)}{c.name}</option>)}
            </select>
          </div>
        )}

        {scope === 'product' && (
          <div>
            <label className="label text-xs">Select your product *</label>
            <select {...register('product_id')} className="input text-sm">
              <option value="">Choose a product…</option>
              {(myProducts as any[]).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label text-xs">Starts *</label><input type="datetime-local" {...register('starts_at', { required: 'Required' })} className="input text-sm" />{errors.starts_at && <p className="text-red-500 text-xs mt-1">{String(errors.starts_at.message)}</p>}</div>
        <div><label className="label text-xs">Expires *</label><input type="datetime-local" {...register('expires_at', { required: 'Required' })} className="input text-sm" />{errors.expires_at && <p className="text-red-500 text-xs mt-1">{String(errors.expires_at.message)}</p>}</div>
      </div>

      <button type="submit" disabled={mutation.isPending} className="btn-primary gap-2 text-sm">
        {mutation.isPending ? <><Loader2 size={13} className="animate-spin" />Creating…</> : <><Plus size={13} />Create discount code</>}
      </button>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SellerPromotionsPage() {
  const [tab, setTab] = useState<'discounts' | 'flash'>('discounts');

  const { data: flashSales = [], isLoading: flashLoading, refetch: refetchFlash } = useQuery({
    queryKey: ['flash-sales'], queryFn: flashSaleApi.getActive, refetchInterval: 60_000,
  });
  const { data: discounts = [], isLoading: discountsLoading, refetch: refetchDiscounts } = useQuery({
    queryKey: ['seller-discounts'], queryFn: discountApi.getMine,
  });

  const toggleMutation = useMutation({ mutationFn: discountApi.toggle, onSuccess: () => { toast.success('Updated'); refetchDiscounts(); }, onError: (e: any) => toast.error(e.response?.data?.message || 'Failed') });
  const deleteMutation = useMutation({ mutationFn: discountApi.remove, onSuccess: () => { toast.success('Deleted'); refetchDiscounts(); }, onError: (e: any) => toast.error(e.response?.data?.message || 'Failed') });

  const totalCodes  = (discounts as DiscountCode[]).length;
  const activeCodes = (discounts as DiscountCode[]).filter(d => d.is_active && new Date(d.expires_at) > new Date()).length;
  const totalUses   = (discounts as DiscountCode[]).reduce((s, d) => s + d.usage_count, 0);
  const liveFlash   = (flashSales as FlashSale[]).filter(s => new Date(s.starts_at) <= new Date() && new Date(s.ends_at) >= new Date()).length;

  return (
    <div className="max-w-2xl space-y-5">
      <div><h1 className="text-xl font-semibold text-gray-900">Promotions</h1><p className="text-sm text-gray-400 mt-0.5">Manage discount codes and join flash sale events</p></div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[{ label: 'Total codes', value: totalCodes, color: 'text-violet-600' }, { label: 'Active codes', value: activeCodes, color: 'text-emerald-600' }, { label: 'Total uses', value: totalUses, color: 'text-blue-600' }, { label: 'Live sales', value: liveFlash, color: 'text-red-500' }].map(s => (
          <div key={s.label} className="card p-3 text-center"><p className={`text-xl font-bold ${s.color}`}>{s.value}</p><p className="text-[11px] text-gray-400 mt-0.5 leading-tight">{s.label}</p></div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[{ id: 'discounts', label: 'Discount codes', icon: Tag, count: totalCodes }, { id: 'flash', label: 'Flash sales', icon: Zap, count: (flashSales as any[]).length }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-violet-600 text-violet-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <t.icon size={14} />{t.label}
            {t.count > 0 && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-0.5 ${tab === t.id ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500'}`}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Discounts tab */}
      {tab === 'discounts' && (
        <div className="space-y-4">
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3"><div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center"><Plus size={13} className="text-violet-600" /></div><h2 className="font-semibold text-gray-900 text-sm">Create discount code</h2></div>
            <CreateDiscountForm onSuccess={refetchDiscounts} />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-gray-700">Your codes</h3><div className="flex items-center gap-2"><span className="text-xs text-gray-400">{totalCodes} total</span><button onClick={() => refetchDiscounts()} className="p-1 text-gray-400 hover:text-gray-600"><RefreshCw size={12} /></button></div></div>
            {discountsLoading && <div className="card p-8 flex items-center justify-center text-gray-400 gap-2"><Loader2 size={16} className="animate-spin" />Loading…</div>}
            {!discountsLoading && (discounts as DiscountCode[]).length === 0 && <div className="card p-10 text-center"><Tag size={36} className="text-gray-200 mx-auto mb-3" /><p className="text-gray-500 text-sm font-medium">No discount codes yet</p><p className="text-xs text-gray-400 mt-1">Create your first code above.</p></div>}
            {(discounts as DiscountCode[]).map(code => <DiscountCard key={code.id} code={code} onToggle={id => toggleMutation.mutate(id)} onDelete={id => deleteMutation.mutate(id)} />)}
          </div>
        </div>
      )}

      {/* Flash sales tab */}
      {tab === 'flash' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl"><AlertCircle size={15} className="text-amber-500 shrink-0 mt-0.5" /><p className="text-xs text-amber-800 leading-relaxed">Flash sales are created by the platform admin. Join an active or upcoming event by selecting one of your approved product variants and setting a discounted price.</p></div>
          {flashLoading && <div className="card p-8 flex items-center justify-center text-gray-400 gap-2"><Loader2 size={16} className="animate-spin" />Loading…</div>}
          {!flashLoading && (flashSales as FlashSale[]).length === 0 && <div className="card p-12 text-center"><Zap size={40} className="text-gray-200 mx-auto mb-3" /><p className="text-gray-500 text-sm font-medium">No flash sales available</p><p className="text-xs text-gray-400 mt-1">Contact the admin to schedule a flash sale event.</p></div>}
          {(flashSales as FlashSale[]).map(sale => <FlashSaleCard key={sale.id} sale={sale} onRefresh={refetchFlash} />)}
        </div>
      )}
    </div>
  );
}
