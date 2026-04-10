'use client';
// src/app/(seller)/seller/orders/page.tsx
//
// CHANGES FROM ORIGINAL — zero logic altered:
//  1. prompt() removed → RejectModal component (textarea + confirm button)
//  2. confirm() removed → DeliverButton two-step inline confirmation
//  3. Tracking modal upgraded (product name shown, info notice)
//  4. Per-item loadingId — only the active card shows spinner
//  5. Responsive card layout (stacks on mobile)
//  6. Status filter tabs scroll horizontally on mobile (no wrap)
//  7. Empty state per filter with clear-filter button
//  8. Order date + address city displayed on each card
//  9. Rejection reason displayed inline when present

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orderApi } from '@/lib/api';
import api from '@/lib/api';
import { formatETB } from '@/hooks';
import {
  Check, X, Truck, PackageCheck, Loader2,
  Package, ChevronLeft, ChevronRight,
  AlertTriangle, MapPin, Clock, User,
  ReceiptText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  pending:    { label: 'Pending',    bg: 'bg-yellow-100', color: 'text-yellow-800' },
  accepted:   { label: 'Accepted',   bg: 'bg-blue-100',   color: 'text-blue-800'   },
  processing: { label: 'Processing', bg: 'bg-purple-100', color: 'text-purple-800' },
  shipped:    { label: 'Shipped',    bg: 'bg-indigo-100', color: 'text-indigo-800' },
  delivered:  { label: 'Delivered',  bg: 'bg-green-100',  color: 'text-green-800'  },
  rejected:   { label: 'Rejected',   bg: 'bg-red-100',    color: 'text-red-700'    },
  cancelled:  { label: 'Cancelled',  bg: 'bg-gray-100',   color: 'text-gray-600'   },
};

const STATUS_FILTERS = ['', 'pending', 'accepted', 'shipped', 'delivered', 'rejected'] as const;

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, bg: 'bg-gray-100', color: 'text-gray-600' };
  return (
    <span className={clsx(
      'inline-flex items-center text-[11px] font-bold px-2.5 py-0.5 rounded-full capitalize',
      cfg.bg, cfg.color
    )}>
      {cfg.label}
    </span>
  );
}

// ── Reject modal — replaces browser prompt() ──────────────────────────────────
function RejectModal({
  itemId, productName, onConfirm, onCancel, isPending,
}: {
  itemId: string; productName: string;
  onConfirm: (id: string, reason: string) => void;
  onCancel: () => void; isPending: boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
              <AlertTriangle size={17} className="text-red-600" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Reject order item</p>
              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[220px]">{productName}</p>
            </div>
          </div>
          <button onClick={onCancel}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="label text-xs">
              Reason <span className="text-gray-400 font-normal">(optional — shown to customer)</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3} maxLength={300} autoFocus
              className="input text-sm resize-none"
              placeholder="e.g. Item is out of stock, unable to fulfil this order…"
            />
            <p className="text-right text-xs text-gray-400 mt-1">{reason.length}/300</p>
          </div>
          <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-100 rounded-xl">
            <AlertTriangle size={13} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              The customer will be notified. If this is the only item, the order will be cancelled.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1 text-sm">Cancel</button>
          <button
            onClick={() => onConfirm(itemId, reason.trim())}
            disabled={isPending}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700
              text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
            Confirm rejection
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Ship modal — cleaner version of original trackModal ───────────────────────
function ShipModal({
  itemId, productName, onConfirm, onCancel, isPending,
}: {
  itemId: string; productName: string;
  onConfirm: (id: string, tracking: string) => void;
  onCancel: () => void; isPending: boolean;
}) {
  const [trackNo, setTrackNo] = useState('');
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
              <Truck size={17} className="text-blue-600" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Mark as shipped</p>
              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[220px]">{productName}</p>
            </div>
          </div>
          <button onClick={onCancel}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="label text-xs">
              Tracking number <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              value={trackNo}
              onChange={e => setTrackNo(e.target.value)}
              autoFocus className="input text-sm font-mono"
              placeholder="e.g. ET-1234567890"
            />
          </div>
          <div className="flex items-start gap-2.5 p-3 bg-blue-50 border border-blue-100 rounded-xl">
            <Truck size={13} className="text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800 leading-relaxed">
              The customer will be notified. Mark as delivered once the item arrives to release your earnings.
            </p>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1 text-sm">Cancel</button>
          <button
            onClick={() => onConfirm(itemId, trackNo.trim())}
            disabled={isPending}
            className="btn-primary flex-1 text-sm gap-2"
          >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <Truck size={13} />}
            Confirm shipped
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Deliver button — replaces browser confirm() with inline two-step ──────────
function DeliverButton({ itemId, isPending, onConfirm }: {
  itemId: string; isPending: boolean; onConfirm: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        disabled={isPending}
        className="inline-flex items-center justify-center gap-1.5 px-3 py-2
          bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl
          text-xs font-semibold hover:bg-emerald-100 transition-colors disabled:opacity-50 w-full"
      >
        <PackageCheck size={12} />Mark delivered
      </button>
    );
  }

  return (
    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
      <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
        <PackageCheck size={12} />Confirm delivery?
      </p>
      <p className="text-[11px] text-emerald-700 leading-snug">
        Earnings will be released and customer can leave a review.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => { setConfirming(false); onConfirm(itemId); }}
          disabled={isPending}
          className="flex-1 inline-flex items-center justify-center gap-1 py-1.5
            bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold
            rounded-lg transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
          Yes, delivered
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="flex-1 py-1.5 border border-emerald-300 text-emerald-700
            text-xs font-semibold rounded-lg hover:bg-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Order item card ───────────────────────────────────────────────────────────
function OrderCard({
  item, onAccept, onOpenReject, onOpenShip, onDeliver, loadingId,
}: {
  item:         any;
  onAccept:     (id: string) => void;
  onOpenReject: (id: string, name: string) => void;
  onOpenShip:   (id: string, name: string) => void;
  onDeliver:    (id: string) => void;
  loadingId:    string | null;
}) {
  const addr      = item.shipping_address_snapshot;
  const isLoading = loadingId === item.id;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-sm transition-all">
      {/* Card header row */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <ReceiptText size={13} className="text-gray-400 shrink-0" />
          <span className="font-mono text-sm font-bold text-gray-900 truncate">{item.order_number}</span>
          <StatusBadge status={item.status} />
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {item.placed_at && (
            <span className="flex items-center gap-1 text-[11px] text-gray-400">
              <Clock size={10} />
              {new Date(item.placed_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </span>
          )}
          <span className="text-sm font-bold text-violet-600">{formatETB(item.line_total)}</span>
        </div>
      </div>

      {/* Card body */}
      <div className="p-4 flex flex-col sm:flex-row gap-4">

        {/* Product + customer info */}
        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <p className="text-sm font-semibold text-gray-900 leading-snug">{item.product_name_snapshot}</p>
            <p className="text-xs text-gray-400 font-mono mt-0.5">SKU: {item.sku_snapshot}</p>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Package size={11} className="text-gray-400 shrink-0" />
              Qty: <strong className="text-gray-700 ml-0.5">{item.quantity}</strong>
            </span>
            <span className="flex items-center gap-1">
              <User size={11} className="text-gray-400 shrink-0" />
              {item.first_name} {item.last_name}
            </span>
            {addr?.city && (
              <span className="flex items-center gap-1">
                <MapPin size={11} className="text-gray-400 shrink-0" />
                {addr.city}
              </span>
            )}
          </div>

          {/* Tracking number display */}
          {item.tracking_number && (
            <div className="inline-flex items-center gap-1.5 text-xs bg-indigo-50 text-indigo-700
              px-2.5 py-1 rounded-lg border border-indigo-100">
              <Truck size={11} />
              Tracking: <span className="font-mono font-bold ml-0.5">{item.tracking_number}</span>
            </div>
          )}

          {/* Rejection reason display */}
          {item.rejection_reason && (
            <div className="flex items-start gap-1.5 text-xs bg-red-50 text-red-700
              px-2.5 py-2 rounded-lg border border-red-100">
              <X size={11} className="shrink-0 mt-0.5" />
              {item.rejection_reason}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-row sm:flex-col gap-2 sm:w-40 shrink-0">

          {item.status === 'pending' && (
            <>
              <button
                onClick={() => onAccept(item.id)}
                disabled={isLoading}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5
                  px-3 py-2 bg-green-50 text-green-700 border border-green-200
                  rounded-xl text-xs font-semibold hover:bg-green-100 transition-colors disabled:opacity-50"
              >
                {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Accept
              </button>
              <button
                onClick={() => onOpenReject(item.id, item.product_name_snapshot)}
                disabled={isLoading}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5
                  px-3 py-2 bg-red-50 text-red-700 border border-red-200
                  rounded-xl text-xs font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                <X size={12} />Reject
              </button>
            </>
          )}

          {item.status === 'accepted' && (
            <button
              onClick={() => onOpenShip(item.id, item.product_name_snapshot)}
              disabled={isLoading}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5
                px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200
                rounded-xl text-xs font-semibold hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Truck size={12} />}
              Mark shipped
            </button>
          )}

          {item.status === 'shipped' && (
            <DeliverButton
              itemId={item.id}
              isPending={isLoading}
              onConfirm={onDeliver}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SellerOrdersPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [page,         setPage]         = useState(1);
  const [rejectModal,  setRejectModal]  = useState<{ id: string; name: string } | null>(null);
  const [shipModal,    setShipModal]    = useState<{ id: string; name: string } | null>(null);
  const [loadingId,    setLoadingId]    = useState<string | null>(null);

  const qc         = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['seller-orders'] });

  const { data, isLoading } = useQuery({
    queryKey:        ['seller-orders', statusFilter, page],
    queryFn:         () => orderApi.getSellerOrders({ status: statusFilter || undefined, page }),
    refetchInterval: 30_000,
    placeholderData: (prev: any) => prev,
  });

  const acceptMut = useMutation({
    mutationFn: (itemId: string) => { setLoadingId(itemId); return orderApi.acceptItem(itemId); },
    onSuccess:  () => { invalidate(); toast.success('Order accepted'); },
    onError:    (e: any) => toast.error(e.response?.data?.message || 'Failed to accept'),
    onSettled:  () => setLoadingId(null),
  });

  const rejectMut = useMutation({
    mutationFn: ({ itemId, reason }: { itemId: string; reason: string }) => {
      setLoadingId(itemId); return orderApi.rejectItem(itemId, reason);
    },
    onSuccess:  () => { invalidate(); setRejectModal(null); toast.success('Order rejected'); },
    onError:    (e: any) => toast.error(e.response?.data?.message || 'Failed to reject'),
    onSettled:  () => setLoadingId(null),
  });

  const shipMut = useMutation({
    mutationFn: ({ itemId, trackingNumber }: { itemId: string; trackingNumber: string }) => {
      setLoadingId(itemId); return orderApi.shipItem(itemId, trackingNumber);
    },
    onSuccess:  () => { invalidate(); setShipModal(null); toast.success('Marked as shipped'); },
    onError:    (e: any) => toast.error(e.response?.data?.message || 'Failed'),
    onSettled:  () => setLoadingId(null),
  });

  const deliverMut = useMutation({
    mutationFn: (itemId: string) => {
      setLoadingId(itemId); return api.patch(`/seller/orders/${itemId}/deliver`);
    },
    onSuccess:  () => { invalidate(); toast.success('Marked as delivered — earnings released'); },
    onError:    (e: any) => toast.error(e.response?.data?.message || 'Failed'),
    onSettled:  () => setLoadingId(null),
  });

  const items      = (data?.data ?? []) as any[];
  const totalPages = data?.meta?.total_pages ?? 1;
  const totalItems = data?.meta?.total ?? items.length;

  return (
    <div className="max-w-3xl space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Orders</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          {totalItems > 0
            ? `${totalItems} item${totalItems !== 1 ? 's' : ''}${statusFilter ? ` · ${statusFilter}` : ''}`
            : 'No orders yet'
          }
        </p>
      </div>

      {/* Filter tabs — scrolls on mobile, no wrap */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={clsx(
              'shrink-0 px-3.5 py-1.5 text-xs rounded-xl font-semibold capitalize transition-all whitespace-nowrap',
              statusFilter === s
                ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/30'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {s || 'All orders'}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 skeleton rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-14 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Package size={26} className="text-gray-300" />
          </div>
          <p className="font-semibold text-gray-500">
            {statusFilter ? `No "${statusFilter}" orders` : 'No orders yet'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {statusFilter
              ? 'Try a different filter or check back later'
              : 'New orders will appear here once customers place them'
            }
          </p>
          {statusFilter && (
            <button
              onClick={() => { setStatusFilter(''); setPage(1); }}
              className="btn-secondary text-xs mt-4"
            >
              Clear filter
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item: any) => (
            <OrderCard
              key={item.id}
              item={item}
              onAccept={id => acceptMut.mutate(id)}
              onOpenReject={(id, name) => setRejectModal({ id, name })}
              onOpenShip={(id, name)   => setShipModal({ id, name })}
              onDeliver={id => deliverMut.mutate(id)}
              loadingId={loadingId}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="inline-flex items-center gap-1.5 btn-secondary text-sm px-3 py-2 disabled:opacity-40"
          >
            <ChevronLeft size={15} />Prev
          </button>
          <span className="text-sm font-medium text-gray-500">
            {page} <span className="text-gray-300">/</span> {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="inline-flex items-center gap-1.5 btn-secondary text-sm px-3 py-2 disabled:opacity-40"
          >
            Next<ChevronRight size={15} />
          </button>
        </div>
      )}

      {/* Modals */}
      {rejectModal && (
        <RejectModal
          itemId={rejectModal.id}
          productName={rejectModal.name}
          isPending={rejectMut.isPending}
          onConfirm={(id, reason) => rejectMut.mutate({ itemId: id, reason })}
          onCancel={() => setRejectModal(null)}
        />
      )}

      {shipModal && (
        <ShipModal
          itemId={shipModal.id}
          productName={shipModal.name}
          isPending={shipMut.isPending}
          onConfirm={(id, tracking) => shipMut.mutate({ itemId: id, trackingNumber: tracking })}
          onCancel={() => setShipModal(null)}
        />
      )}
    </div>
  );
}