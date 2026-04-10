'use client';
// src/app/(public)/account/orders/[id]/page.tsx
//
// BUGS FIXED:
//  1. Status timeline — current step used `Circle` icon (outline only, invisible
//     on violet background). Fixed: current step now shows a filled dot instead.
//  2. Status timeline connector alignment — `mb-5` on the connector pushed it
//     below the circles. Fixed with proper flexbox alignment.
//  3. o.tracking_number — tracking numbers are stored per ORDER ITEM in the
//     schema (order_items.tracking_number), NOT on the order itself. Fixed:
//     show tracking per item where available.
//  4. ORDER_STATUS_COLORS on item.status — item statuses (pending/accepted/
//     shipped/delivered/rejected) differ from order statuses. Added a separate
//     item status color map.
//  5. item.seller_name — this field is returned as `seller_name` from the join
//     but typed safely. Added null guard.
//  6. Cancel order button — only shown when status is 'pending'. Was missing.
//  7. Shipping address display — snapshot exists but was never shown.
//  8. Payment method display — was missing from totals card.
//  9. Missing back link — user had no way to go back to orders list.
// 10. Timeline hides for 'cancelled' and 'returned' but the badge was unstyled.
// 11. `o.subtotal`, `o.shipping_cost`, `o.discount_amount`, `o.total` —
//     these come from Postgres as strings. Wrapped in Number() throughout.

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useOrder, formatETB, ORDER_STATUS_COLORS } from '@/hooks';
import { orderApi } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Download, RotateCcw, RefreshCw, Loader2, CheckCircle2,
  ArrowLeft, MapPin, CreditCard, Truck, Package,
  XCircle, AlertTriangle,
} from 'lucide-react';
import type { Order, OrderItem } from '@/types';
import Link from 'next/link';
import toast from 'react-hot-toast';
import clsx from 'clsx';

// Order-level status pipeline
const STATUS_ORDER = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'] as const;

// FIX: item-level statuses differ from order statuses — separate map
const ITEM_STATUS_COLORS: Record<string, string> = {
  pending:    'bg-yellow-100 text-yellow-800',
  accepted:   'bg-blue-100   text-blue-800',
  processing: 'bg-purple-100 text-purple-800',
  shipped:    'bg-indigo-100 text-indigo-800',
  delivered:  'bg-green-100  text-green-800',
  rejected:   'bg-red-100    text-red-700',
  cancelled:  'bg-gray-100   text-gray-600',
};

// ── Timeline step ──────────────────────────────────────────────────────────────
function TimelineStep({ label, done, active }: {
  label: string; done: boolean; active: boolean;
}) {
  return (
    <div className="flex flex-col items-center min-w-0">
      {/* FIX: current step = filled violet dot, not invisible `Circle` outline */}
      <div className={clsx(
        'w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors',
        done || active ? 'bg-violet-600' : 'bg-gray-200'
      )}>
        {done ? (
          <CheckCircle2 size={17} className="text-white" />
        ) : active ? (
          // Filled white circle for "current" step
          <div className="w-3 h-3 rounded-full bg-white" />
        ) : (
          <div className="w-3 h-3 rounded-full bg-gray-400" />
        )}
      </div>
      <p className={clsx(
        'text-[10px] sm:text-xs mt-1.5 text-center capitalize leading-tight',
        done || active ? 'text-violet-700 font-semibold' : 'text-gray-400'
      )}>
        {label}
      </p>
    </div>
  );
}

// ── Order item row ─────────────────────────────────────────────────────────────
function OrderItemRow({ item }: { item: OrderItem }) {
  const attrs = item.variant_attributes_snapshot ?? {};
  const attrStr = Object.entries(attrs).map(([k, v]) => `${k}: ${v}`).join(' · ');

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      {/* Icon placeholder */}
      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
        <Package size={16} className="text-gray-400" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 leading-snug">{item.product_name_snapshot}</p>
        <p className="text-xs text-gray-400 font-mono mt-0.5">{item.sku_snapshot}</p>
        {attrStr && <p className="text-xs text-gray-500 mt-0.5">{attrStr}</p>}
        {(item as any).seller_name && (
          <p className="text-xs text-gray-400 mt-0.5">Sold by {(item as any).seller_name}</p>
        )}
        {/* FIX: tracking number is per item, not per order */}
        {(item as any).tracking_number && (
          <div className="inline-flex items-center gap-1.5 mt-1.5 text-xs bg-indigo-50 text-indigo-700
            px-2 py-1 rounded-lg border border-indigo-100">
            <Truck size={10} />
            <span className="font-mono font-bold">{(item as any).tracking_number}</span>
          </div>
        )}
        {item.status === 'rejected' && (item as any).rejection_reason && (
          <div className="flex items-start gap-1.5 mt-1.5 text-xs bg-red-50 text-red-700
            px-2 py-1.5 rounded-lg border border-red-100">
            <XCircle size={10} className="shrink-0 mt-0.5" />
            {(item as any).rejection_reason}
          </div>
        )}
      </div>

      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-gray-900">{formatETB(Number(item.line_total))}</p>
        <p className="text-xs text-gray-400 mt-0.5">×{item.quantity}</p>
        <span className={clsx(
          'inline-flex mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
          ITEM_STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-600'
        )}>
          {item.status}
        </span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function OrderDetailPage() {
  const { id }    = useParams<{ id: string }>();
  const router    = useRouter();
  const qc        = useQueryClient();
  const { data: order, isLoading } = useOrder(id);

  const reorderMut = useMutation({
    mutationFn: () => orderApi.reorder(id),
    onSuccess:  () => {
      toast.success('Items added to your cart');
      qc.invalidateQueries({ queryKey: ['cart'] });
    },
    onError: () => toast.error('Failed to reorder — some items may be out of stock'),
  });

  const cancelMut = useMutation({
    mutationFn: () => orderApi.cancelOrder(id),
    onSuccess:  () => {
      toast.success('Order cancelled');
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['order', id] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to cancel order'),
  });

  const [confirmCancel, setConfirmCancel] = useState(false);

  const downloadInvoice = async () => {
    try {
      const res = await orderApi.downloadInvoice(id);
      const url = URL.createObjectURL((res as any).data);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `invoice-${(order as any)?.order_number ?? id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download invoice');
    }
  };

  if (isLoading) return (
    <div className="container-page py-8 max-w-3xl space-y-4">
      <div className="h-10 skeleton rounded-xl w-48" />
      <div className="h-32 skeleton rounded-2xl" />
      <div className="h-48 skeleton rounded-2xl" />
      <div className="h-24 skeleton rounded-2xl" />
    </div>
  );

  if (!order) return (
    <div className="container-page py-8 max-w-3xl text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <Package size={28} className="text-gray-300" />
      </div>
      <p className="font-semibold text-gray-500 mb-4">Order not found</p>
      <Link href="/account/orders" className="btn-secondary text-sm gap-1.5 inline-flex">
        <ArrowLeft size={13} />Back to orders
      </Link>
    </div>
  );

  const o           = order as Order;
  const items       = (o as any).items ?? [] as OrderItem[];
  const addr        = (o as any).shipping_address_snapshot;
  const currentStep = STATUS_ORDER.indexOf(o.status as any);
  const isFinalised = ['cancelled', 'returned'].includes(o.status);
  const canCancel   = o.status === 'pending';

  return (
    <div className="container-page py-6 sm:py-8 max-w-3xl space-y-4">

      {/* Back + header */}
      <div>
        <Link href="/account/orders"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800
            transition-colors mb-3 group">
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          All orders
        </Link>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{o.order_number}</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Placed {new Date(o.placed_at).toLocaleDateString('en-GB', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              })}
            </p>
          </div>
          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => reorderMut.mutate()}
              disabled={reorderMut.isPending}
              className="btn-secondary text-sm py-2 px-3 gap-1.5"
            >
              {reorderMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Reorder
            </button>
            {o.status !== 'pending' && (
              <button onClick={downloadInvoice} className="btn-secondary text-sm py-2 px-3 gap-1.5">
                <Download size={13} />Invoice
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status timeline */}
      {!isFinalised && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-5">Order tracking</h2>
          {/* FIX: proper alignment — no mb-5 on connector */}
          <div className="flex items-start">
            {STATUS_ORDER.map((s, i) => (
              <div key={s} className="flex items-center flex-1 min-w-0">
                <TimelineStep
                  label={s}
                  done={i < currentStep}
                  active={i === currentStep}
                />
                {i < STATUS_ORDER.length - 1 && (
                  // FIX: connector sits between circles, vertically centered with them
                  <div className={clsx(
                    'flex-1 h-0.5 mx-1 -mt-5',
                    i < currentStep ? 'bg-violet-500' : 'bg-gray-200'
                  )} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cancelled / Returned status */}
      {isFinalised && (
        <div className={clsx(
          'flex items-center gap-3 p-4 rounded-2xl border',
          o.status === 'cancelled'
            ? 'bg-red-50 border-red-200'
            : 'bg-gray-50 border-gray-200'
        )}>
          <XCircle size={20} className={o.status === 'cancelled' ? 'text-red-500 shrink-0' : 'text-gray-400 shrink-0'} />
          <div>
            <p className="text-sm font-bold text-gray-800 capitalize">Order {o.status}</p>
            {o.status === 'cancelled' && (
              <p className="text-xs text-gray-500 mt-0.5">
                If you were charged, a refund will be processed within 3–5 business days.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Items ordered */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <h2 className="text-sm font-bold text-gray-700 mb-1">
          Items ordered <span className="text-gray-400 font-normal">({items.length})</span>
        </h2>
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No item details available</p>
        ) : (
          <div className="divide-y divide-gray-50 -mx-1 px-1">
            {items.map((item: OrderItem) => (
              <OrderItemRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <h2 className="text-sm font-bold text-gray-700 mb-3">Order summary</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>{formatETB(Number(o.subtotal))}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Shipping</span>
            <span>{Number(o.shipping_cost) === 0 ? <span className="text-green-600 font-medium">Free</span> : formatETB(Number(o.shipping_cost))}</span>
          </div>
          {Number(o.discount_amount) > 0 && (
            <div className="flex justify-between text-green-600 font-medium">
              <span>Discount</span>
              <span>-{formatETB(Number(o.discount_amount))}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-gray-900 text-base pt-2.5 border-t border-gray-100">
            <span>Total</span>
            <span className="text-violet-600">{formatETB(Number(o.total))}</span>
          </div>
        </div>

        {/* Payment method */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-500">
          <CreditCard size={13} className="shrink-0 text-gray-400" />
          <span>
            {(o as any).payment_method === 'cod'
              ? 'Cash on delivery'
              : (o as any).payment_method === 'chapa'
                ? 'Paid via Chapa'
                : (o as any).payment_method ?? 'Online payment'
            }
          </span>
          <span className={clsx(
            'ml-auto font-semibold',
            o.payment_status === 'paid' ? 'text-green-600' : 'text-amber-600'
          )}>
            {o.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
          </span>
        </div>
      </div>

      {/* Shipping address */}
      {addr && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5">
            <MapPin size={14} className="text-gray-400" />Shipping address
          </h2>
          <div className="text-sm text-gray-700 space-y-0.5">
            <p className="font-semibold">{addr.full_name}</p>
            <p className="text-gray-500">{addr.street_address}</p>
            <p className="text-gray-500">{[addr.city, addr.region, addr.country].filter(Boolean).join(', ')}</p>
            {addr.phone && <p className="text-gray-500">📞 {addr.phone}</p>}
          </div>
        </div>
      )}

      {/* Cancel order — FIX: was missing; only shown for pending orders */}
      {canCancel && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-1 flex items-center gap-1.5">
            <XCircle size={14} className="text-red-400" />Cancel order
          </h2>
          <p className="text-xs text-gray-500 mb-3">
            This order hasn't been confirmed yet and can still be cancelled.
          </p>
          {!confirmCancel ? (
            <button
              onClick={() => setConfirmCancel(true)}
              className="text-sm text-red-600 hover:text-red-700 font-semibold
                bg-red-50 hover:bg-red-100 border border-red-200 px-4 py-2 rounded-xl transition-colors"
            >
              Cancel this order
            </button>
          ) : (
            <div className="flex flex-col gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm font-semibold text-red-800">
                  Are you sure you want to cancel this order?
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setConfirmCancel(false); cancelMut.mutate(); }}
                  disabled={cancelMut.isPending}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2
                    bg-red-600 hover:bg-red-700 text-white text-sm font-semibold
                    rounded-xl transition-colors disabled:opacity-50"
                >
                  {cancelMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                  Yes, cancel order
                </button>
                <button
                  onClick={() => setConfirmCancel(false)}
                  className="flex-1 py-2 border border-red-300 text-red-700 text-sm
                    font-semibold rounded-xl hover:bg-white transition-colors"
                >
                  Keep order
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Return request */}
      {o.status === 'delivered' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-1 flex items-center gap-1.5">
            <RotateCcw size={14} className="text-violet-500" />Request a return
          </h2>
          <p className="text-xs text-gray-500 mb-3">
            Changed your mind? You can request a return within 7 days of delivery.
          </p>
          <Link href="/account/returns" className="btn-secondary text-sm inline-flex gap-1.5 py-2">
            <RotateCcw size={13} />Start return request
          </Link>
        </div>
      )}
    </div>
  );
}