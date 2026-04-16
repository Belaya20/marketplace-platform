'use client';
 
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { paymentApi } from '@/lib/api';
import { CreditCard, ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

// ── Inline formatter (avoids wrong import path for formatETB) ─────────────────
function fmt(amount: number): string {
  return new Intl.NumberFormat('en-ET', {
    style:                 'currency',
    currency:              'ETB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ── Date formatter — consistent across all browsers and locales ───────────────
function fmtDate(iso: string): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-ET', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  }).format(new Date(iso));
}

// ── Status badge ──────────────────────────────────────────────────────────────
// Covers all Chapa payment statuses plus any unknown values.
function StatusBadge({ status }: { status: string }) {
  const s = (status || '').toLowerCase();
  return (
    <span className={clsx(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize',
      s === 'success'   && 'bg-green-100  text-green-700',
      s === 'failed'    && 'bg-red-100    text-red-700',
      s === 'pending'   && 'bg-yellow-100 text-yellow-700',
      s === 'abandoned' && 'bg-orange-100 text-orange-600',
      !['success', 'failed', 'pending', 'abandoned'].includes(s) && 'bg-gray-100 text-gray-600',
    )}>
      {status || 'unknown'}
    </span>
  );
}

// ── Mobile payment card ───────────────────────────────────────────────────────
// Shown below sm breakpoint in place of the table.
function PaymentCard({ p }: { p: any }) {
  return (
    <div className="card p-4 space-y-3">
      {/* Row 1: order number + status */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold text-gray-800 truncate">
          {p.order_number || '—'}
        </span>
        <StatusBadge status={p.status} />
      </div>

      {/* Row 2: amount */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-400">Amount</span>
        <span className="font-semibold text-gray-900 text-sm">{fmt(p.amount)}</span>
      </div>

      {/* Row 3: tx ref */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-gray-400 shrink-0">Tx ref</span>
        <span className="font-mono text-xs text-gray-500 truncate max-w-[200px] text-right" title={p.chapa_tx_ref}>
          {p.chapa_tx_ref || '—'}
        </span>
      </div>

      {/* Row 4: date */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-50">
        <span className="text-xs text-gray-400">Date</span>
        <span className="text-xs text-gray-500">{fmtDate(p.initiated_at)}</span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PaymentsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey:        ['admin-payments', page],
    queryFn:         () => paymentApi.getLogs(page),
    placeholderData: (prev: any) => prev,
  });

  const payments   = (data?.data    ?? []) as any[];
  const total      = data?.meta?.total      ?? 0;
  const totalPages = data?.meta?.total_pages ?? 1;

  // ── Navigation helper ───────────────────────────────────────────────────
  const goTo = (next: number) => {
    setPage(next);
    // Scroll to top on page change so user sees fresh rows
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="h-7 w-40 skeleton rounded" />
        {/* Mobile cards skeleton */}
        <div className="sm:hidden space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-32 skeleton rounded-xl" />
          ))}
        </div>
        {/* Desktop table skeleton */}
        <div className="hidden sm:block card overflow-hidden p-0">
          <div className="space-y-0 divide-y divide-gray-50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 skeleton" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <CreditCard size={20} className="text-violet-600 shrink-0" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Payment logs</h1>
          {total > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">{total} transaction{total !== 1 ? 's' : ''} total</p>
          )}
        </div>
      </div>

      {/* Empty state */}
      {payments.length === 0 ? (
        <div className="card p-12 text-center">
          <CreditCard size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium text-sm">No payments yet</p>
          <p className="text-gray-400 text-xs mt-1">
            Completed Chapa transactions will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* ── Mobile: cards (< sm) ──────────────────────────────────────── */}
          <div className="sm:hidden space-y-3">
            {payments.map((p: any) => (
              <PaymentCard key={p.id} p={p} />
            ))}
          </div>

          {/* ── Desktop: table (sm+) ─────────────────────────────────────── */}
          <div className="hidden sm:block card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">
                      Order
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">
                      Tx ref
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">
                      Amount
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">
                      Status
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {payments.map((p: any) => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      {/* Order number */}
                      <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">
                        {p.order_number || '—'}
                      </td>
                      {/* Tx ref — truncated with full value in title for hover */}
                      <td className="px-4 py-3">
                        <span
                          className="font-mono text-xs text-gray-500 block max-w-[180px] truncate cursor-default"
                          title={p.chapa_tx_ref}
                        >
                          {p.chapa_tx_ref || '—'}
                        </span>
                      </td>
                      {/* Amount */}
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                        {fmt(p.amount)}
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={p.status} />
                      </td>
                      {/* Date */}
                      <td className="px-4 py-3 text-right text-xs text-gray-400 whitespace-nowrap">
                        {fmtDate(p.initiated_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 pt-1">
              {/* Context label */}
              <p className="text-xs text-gray-400 hidden sm:block">
                Page {page} of {totalPages} · {total} total
              </p>
              <p className="text-xs text-gray-400 sm:hidden">
                {page} / {totalPages}
              </p>

              {/* Prev / Next */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => goTo(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 btn-secondary px-3 py-2 text-sm disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={14} />
                  <span className="hidden sm:inline">Prev</span>
                </button>

                {/* Page numbers — show up to 5 page buttons on desktop */}
                <div className="hidden sm:flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    // Show pages around current
                    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                    const num   = start + i;
                    if (num > totalPages) return null;
                    return (
                      <button
                        key={num}
                        onClick={() => goTo(num)}
                        className={clsx(
                          'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                          num === page
                            ? 'bg-violet-600 text-white'
                            : 'text-gray-600 hover:bg-gray-100',
                        )}
                      >
                        {num}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => goTo(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 btn-secondary px-3 py-2 text-sm disabled:opacity-40"
                  aria-label="Next page"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}