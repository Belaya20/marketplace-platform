'use client';
// src/app/(public)/account/orders/page.tsx
 
import { useState } from 'react';
import Link from 'next/link';
import {
  Package, ChevronRight, Star, ChevronDown, ChevronUp,
  ShoppingBag, ArrowLeft, Clock, Loader2,
} from 'lucide-react';
import { useOrders, formatETB, ORDER_STATUS_COLORS } from '@/hooks';
import { useQuery } from '@tanstack/react-query';
import { orderApi } from '@/lib/api';
import type { Order } from '@/types';
import clsx from 'clsx';

// ── Delivered order items — shows items with review links ─────────────────────
function DeliveredOrderItems({ orderId }: { orderId: string }) {
  // orderApi.getOrder uses the `d` helper → returns r.data.data directly
  // so `order` is the unwrapped order object, not the axios response
  const { data: order, isLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn:  () => orderApi.getOrder(orderId),
    staleTime: 120_000,
  });

  if (isLoading) return (
    <div className="px-4 pb-4 pt-3 space-y-2 border-t border-gray-100">
      {[1, 2].map(i => <div key={i} className="h-12 skeleton rounded-xl" />)}
    </div>
  );

  // FIX: `order` is already unwrapped — access items directly
  const items: any[] = (order as any)?.items ?? [];

  if (items.length === 0) return (
    <div className="px-4 pb-4 pt-3 border-t border-gray-100">
      <p className="text-xs text-gray-400 text-center py-2">No item details available</p>
    </div>
  );

  return (
    <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-2">
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
        Rate your items
      </p>
      {items.map((item: any) => (
        // FIX: item.store_slug is the SELLER'S store slug, not a product slug.
        // Product slug is not returned in order items — link to reviews page instead.
        <Link
          key={item.id}
          href={`/account/reviews`}
          className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50
            hover:bg-violet-50 border border-transparent hover:border-violet-100
            transition-all group"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate group-hover:text-violet-700 transition-colors">
              {item.product_name_snapshot}
            </p>
            <p className="text-xs text-gray-400 font-mono mt-0.5">
              {item.sku_snapshot} · ×{item.quantity}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} size={12}
                  className="text-gray-300 group-hover:text-amber-400 transition-colors" />
              ))}
            </div>
            <span className="text-xs text-violet-600 font-semibold group-hover:underline whitespace-nowrap">
              Write review
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── Order status badge ─────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  return (
    <span className={clsx(
      'inline-flex items-center text-[11px] font-bold px-2.5 py-0.5 rounded-full capitalize',
      ORDER_STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600'
    )}>
      {status}
    </span>
  );
}

// ── Payment status label ───────────────────────────────────────────────────────
function PaymentLabel({ status, method }: { status: string; method?: string }) {
  // FIX: COD orders are always 'unpaid' until delivery — don't show alarming yellow
  const isCOD = method === 'cod';
  if (status === 'paid')   return <span className="text-[11px] font-medium text-green-600">Paid</span>;
  if (isCOD)               return <span className="text-[11px] font-medium text-gray-500">Pay on delivery</span>;
  return <span className="text-[11px] font-medium text-amber-600">Payment pending</span>;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const { data, isLoading } = useOrders();
  const orders = (data?.data ?? []) as Order[];
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="container-page py-6 sm:py-8 max-w-3xl">

      {/* Header */}
      <div className="flex items-center justify-between mb-5 sm:mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My orders</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {orders.length > 0 ? `${orders.length} order${orders.length !== 1 ? 's' : ''}` : 'No orders yet'}
          </p>
        </div>
        <Link
          href="/account/reviews"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600
            hover:text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-2 rounded-xl transition-colors"
        >
          <Star size={14} className="fill-amber-400 text-amber-400" />
          My reviews
        </Link>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 skeleton rounded-2xl" />
          ))}
        </div>

      /* Empty */
      ) : orders.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-14 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Package size={28} className="text-gray-300" />
          </div>
          <p className="font-semibold text-gray-500 mb-1">No orders yet</p>
          <p className="text-xs text-gray-400 mb-5">Your orders will appear here once you start shopping</p>
          <Link href="/" className="btn-primary text-sm gap-2 inline-flex">
            <ShoppingBag size={14} />Start shopping
          </Link>
        </div>

      /* Order list */
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const isDelivered = order.status === 'delivered';
            const isExpanded  = expandedId === order.id;

            return (
              <div
                key={order.id}
                className={clsx(
                  'bg-white border rounded-2xl overflow-hidden transition-all',
                  isDelivered ? 'border-emerald-200' : 'border-gray-200',
                  'hover:shadow-sm'
                )}
              >
                {/* Main row */}
                <div className="p-4 flex items-start gap-3 sm:gap-4">

                  {/* Left: order info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="font-mono text-sm font-bold text-gray-900">
                        {order.order_number}
                      </span>
                      <StatusBadge status={order.status} />
                      {isDelivered && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold
                          text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          <Star size={9} className="fill-amber-500 text-amber-500" />
                          Rate this order
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(order.placed_at).toLocaleDateString('en-GB', {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })}
                    </p>
                  </div>

                  {/* Right: amount + actions */}
                  {/* FIX: separated amount and action button to prevent overlap on mobile */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <p className="text-sm font-bold text-gray-900">{formatETB(order.total)}</p>
                    <PaymentLabel
                      status={order.payment_status}
                      method={(order as any).payment_method}
                    />
                  </div>

                  {/* Action button — separate from amount */}
                  {isDelivered ? (
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : order.id)}
                      className={clsx(
                        'p-2 rounded-xl transition-colors shrink-0',
                        isExpanded
                          ? 'text-violet-600 bg-violet-50'
                          : 'text-gray-400 hover:text-violet-600 hover:bg-violet-50'
                      )}
                      aria-label={isExpanded ? 'Collapse' : 'Expand items to review'}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  ) : (
                    <Link
                      href={`/account/orders/${order.id}`}
                      className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors shrink-0"
                      aria-label="View order details"
                    >
                      <ChevronRight size={16} />
                    </Link>
                  )}
                </div>

                {/* Expandable items (delivered only) */}
                {isDelivered && isExpanded && (
                  <DeliveredOrderItems orderId={order.id} />
                )}

                {/* Footer link for delivered orders */}
                {isDelivered && (
                  <div className="px-4 pb-3 flex justify-end border-t border-gray-50">
                    <Link
                      href={`/account/orders/${order.id}`}
                      className="text-xs text-gray-400 hover:text-violet-600 hover:underline transition-colors mt-2"
                    >
                      View full order details →
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}