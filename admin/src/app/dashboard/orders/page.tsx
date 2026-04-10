'use client';
// src/app/dashboard/orders/page.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orderApi } from '@/lib/api';
import { formatETB, ORDER_STATUS_COLORS } from '@/lib/utils';
import { ShoppingBag, Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const ALL_STATUSES = [
  'pending', 'confirmed', 'processing',
  'shipped', 'delivered', 'cancelled', 'returned',
];

export default function OrdersPage() {
  const [page,   setPage]   = useState(1);
  const [status, setStatus] = useState('');

  // FIX: track which order is being updated so only THAT row's select is disabled
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const qc = useQueryClient();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin-orders', page, status],
    queryFn:  () => orderApi.getAllOrders({ status: status || undefined, page }),
    placeholderData: (prev: any) => prev,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status: s }: { id: string; status: string }) =>
      orderApi.adminUpdateStatus(id, s),
    onMutate: ({ id }) => setUpdatingId(id),
    onSettled: () => setUpdatingId(null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Status updated');
    },
    // FIX: onError was missing — silent failure left the UI out of sync.
    // Invalidate so the select reverts to the real server state.
    onError: (e: any) => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.error(e.response?.data?.message || 'Failed to update status');
    },
  });

  const orders     = (data?.data ?? []) as any[];
  const totalPages = data?.meta?.total_pages ?? 1;
  const totalCount = data?.meta?.total ?? null;

  // FIX: isFetching is true during background refetches (placeholderData in use)
  // Show a subtle top-bar indicator so admin knows the data is refreshing
  const isRefreshing = isFetching && !isLoading;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">All orders</h1>
          {/* FIX: show total count from meta */}
          {totalCount !== null && (
            <p className="text-sm text-gray-400 mt-0.5">
              {totalCount.toLocaleString()} order{totalCount !== 1 ? 's' : ''}
              {status && <> · filtered by <span className="font-medium capitalize text-gray-600">{status}</span></>}
            </p>
          )}
        </div>
        {/* FIX: isFetching indicator — visible when background refresh is happening */}
        {isRefreshing && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <RefreshCw size={12} className="animate-spin" />
            Refreshing…
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {['', ...ALL_STATUSES].map(s => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1); }}
            className={clsx(
              'px-3 py-1.5 text-xs rounded-lg font-semibold capitalize transition-colors',
              status === s
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 skeleton rounded-xl" />
          ))}
        </div>

      ) : orders.length === 0 ? (
        // FIX: empty state — was previously an empty table body which looks broken
        <div className="card p-14 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <ShoppingBag size={24} className="text-gray-300" />
          </div>
          <p className="font-semibold text-gray-500 mb-1">
            {status ? `No ${status} orders` : 'No orders yet'}
          </p>
          <p className="text-sm text-gray-400">
            {status
              ? `There are no orders with status "${status}".`
              : 'Orders placed by customers will appear here.'}
          </p>
        </div>

      ) : (
        // FIX: overflow-x-auto wrapper prevents table from overflowing
        // its card container on narrow screens.
        <div className={clsx(
          'card overflow-hidden p-0 transition-opacity duration-200',
          isRefreshing && 'opacity-60'
        )}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Order
                  </th>
                  {/* FIX: hide Customer sub-detail (email) on small screens */}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Customer
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Total
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Update
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-50">
                {orders.map((o: any) => {
                  const isUpdating = updatingId === o.id;
                  return (
                    <tr key={o.id} className={clsx(
                      'transition-colors',
                      isUpdating ? 'bg-indigo-50/40' : 'hover:bg-gray-50/60'
                    )}>

                      {/* Order number + date */}
                      <td className="px-4 py-3">
                        <p className="font-mono text-sm font-semibold text-gray-900 whitespace-nowrap">
                          {o.order_number}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(o.placed_at).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </p>
                      </td>

                      {/* Customer — email hidden on small, visible md+ */}
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-800 whitespace-nowrap">
                          {o.first_name} {o.last_name}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 hidden md:block truncate max-w-[180px]">
                          {o.email}
                        </p>
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-gray-900 whitespace-nowrap">
                          {formatETB(o.total)}
                        </span>
                      </td>

                      {/* Current status badge */}
                      <td className="px-4 py-3 text-center">
                        <span className={clsx(
                          'badge text-xs capitalize whitespace-nowrap',
                          ORDER_STATUS_COLORS[o.status] ?? 'bg-gray-100 text-gray-600'
                        )}>
                          {o.status}
                        </span>
                      </td>

                      {/* Status update select
                          FIX 1: value={o.status} makes this CONTROLLED — the select
                          always reflects the server's current status after refetch.
                          Previously defaultValue only set the initial render and
                          became stale after mutations + refetches.

                          FIX 2: guard `if (newStatus === o.status) return` prevents
                          a spurious mutation when admin selects the current status.

                          FIX 3: disabled when THIS order is being updated (per-row),
                          not when any mutation is pending. */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isUpdating && (
                            <Loader2 size={12} className="animate-spin text-indigo-500 shrink-0" />
                          )}
                          <select
                            key={`${o.id}-${o.status}`}   // remount if status changes externally
                            value={o.status}
                            disabled={isUpdating}
                            onChange={e => {
                              const next = e.target.value;
                              if (next === o.status) return; // guard: no-op if same
                              updateMut.mutate({ id: o.id, status: next });
                            }}
                            className={clsx(
                              'input text-xs py-1 w-auto cursor-pointer',
                              isUpdating && 'opacity-50 cursor-not-allowed'
                            )}
                          >
                            {ALL_STATUSES.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary px-4 py-2 text-sm disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500 tabular-nums px-3 py-2">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn-secondary px-4 py-2 text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}