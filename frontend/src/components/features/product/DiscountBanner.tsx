'use client';
// src/components/features/product/DiscountBanner.tsx
// Shows applicable public discount codes on category/search pages.
// Fetches once, filters client-side by categorySlug or productSlug.
// Zero network overhead when no codes match.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tag, Copy, Check, Clock, Globe, FolderOpen } from 'lucide-react';
import api from '@/lib/api';

interface PublicCode {
  code:           string;
  type:           'percentage' | 'fixed_amount' | 'free_shipping';
  value:          number;
  min_order:      number;
  expires_at:     string;
  description:    string | null;
  category_name:  string | null;
  category_slug:  string | null;
  product_name:   string | null;
  product_slug:   string | null;
}

function expiresIn(date: string): string {
  const diff = new Date(date).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const days  = Math.floor(diff / 86_400_000);
  const hours = Math.floor(diff / 3_600_000);
  if (days > 1)  return `${days}d left`;
  if (hours > 0) return `${hours}h left`;
  return 'Expires soon';
}

function discountLabel(code: PublicCode): string {
  if (code.type === 'percentage')   return `${code.value}% off`;
  if (code.type === 'fixed_amount') return `ETB ${code.value} off`;
  return 'Free shipping';
}

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  return (
    <button
      onClick={copy}
      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
        copied
          ? 'bg-emerald-500 text-white'
          : 'bg-violet-600 text-white hover:bg-violet-700'
      }`}
    >
      {copied ? <><Check size={11} />Copied!</> : <><Copy size={11} />Copy</>}
    </button>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
// Pass categorySlug to show codes for a specific category.
// Pass nothing to show global codes only.
interface Props {
  categorySlug?: string;
  productSlug?:  string;
  title?:        string;
}

export function DiscountBanner({ categorySlug, productSlug, title }: Props) {
  const { data: allCodes = [] } = useQuery({
    queryKey:  ['public-discounts'],
    queryFn:   () => api.get('/discounts/public').then((r: any) => r.data.data ?? []),
    staleTime: 120_000,
  });

  // Filter: show global codes + codes scoped to this specific category/product
  const codes = (allCodes as PublicCode[]).filter(c => {
    if (!c.category_slug && !c.product_slug) return true;       // global
    if (categorySlug && c.category_slug === categorySlug) return true;
    if (productSlug  && c.product_slug  === productSlug)  return true;
    return false;
  });

  if (codes.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Tag size={14} className="text-violet-600" />
        <h3 className="text-sm font-semibold text-gray-700">
          {title ?? (categorySlug ? 'Discount codes for this category' : 'Available discount codes')}
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {codes.map(code => (
          <div key={code.code}
            className="group relative flex items-stretch rounded-xl overflow-hidden border border-dashed border-violet-200 hover:border-violet-400 bg-violet-50/40 hover:bg-violet-50 transition-all">
            {/* Left accent stripe */}
            <div className="w-1.5 bg-violet-500 shrink-0" />
            {/* Content */}
            <div className="flex-1 px-3 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="font-mono font-bold text-sm text-violet-700 tracking-widest">{code.code}</span>
                  {/* Scope badge */}
                  {code.category_slug ? (
                    <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                      <FolderOpen size={8} />{code.category_name}
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      <Globe size={8} />All products
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-gray-700">{discountLabel(code)}</p>
                {code.description && (
                  <p className="text-[11px] text-gray-500 truncate max-w-[160px]">{code.description}</p>
                )}
                {code.min_order > 0 && (
                  <p className="text-[10px] text-gray-400">Min. order ETB {code.min_order}</p>
                )}
                <div className="flex items-center gap-1 mt-1">
                  <Clock size={9} className="text-gray-400" />
                  <span className="text-[10px] text-gray-400">{expiresIn(code.expires_at)}</span>
                </div>
              </div>
              <CopyButton code={code.code} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DiscountBanner;