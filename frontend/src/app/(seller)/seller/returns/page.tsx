'use client';
// src/app/(seller)/seller/returns/page.tsx
import { useState } from 'react';
import Image from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatETB } from '@/hooks';
import {
  RotateCcw, Package, ChevronDown, ChevronUp,
  CheckCircle2, Clock, XCircle, Loader2,
  RefreshCw, MessageSquare, AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

// ── Exact enum values from DB ─────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
  requested:    { label: 'New request',  icon: Clock,        color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-300'   },
  under_review: { label: 'Under review', icon: RefreshCw,    color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-300'    },
  approved:     { label: 'Approved',     icon: CheckCircle2, color: 'text-emerald-700',bg: 'bg-emerald-50', border: 'border-emerald-300' },
  rejected:     { label: 'Rejected',     icon: XCircle,      color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200'     },
  completed:    { label: 'Completed',    icon: CheckCircle2, color: 'text-violet-700', bg: 'bg-violet-50',  border: 'border-violet-200'  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg  = STATUS_CFG[status] ?? STATUS_CFG['requested'];
  const Icon = cfg.icon;
  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border', cfg.color, cfg.bg, cfg.border)}>
      <Icon size={10} />{cfg.label}
    </span>
  );
}

// ── Respond modal ─────────────────────────────────────────────────────────────
function RespondModal({ ret, onClose }: { ret: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [status,       setStatus]      = useState<string>(ret.status === 'requested' ? 'under_review' : ret.status);
  const [resolution,   setResolution]  = useState<string>(ret.resolution ?? '');
  const [sellerNote,   setSellerNote]  = useState<string>(ret.seller_note ?? '');
  const [refundAmount, setRefundAmount]= useState<string>(ret.refund_amount ? String(ret.refund_amount) : '');

  const mutation = useMutation({
    mutationFn: () => api.patch(`/seller/returns/${ret.id}`, {
      status,
      resolution:    resolution  || undefined,
      seller_note:   sellerNote  || undefined,
      refund_amount: refundAmount ? Number(refundAmount) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seller-returns'] });
      toast.success('Return request updated');
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to update'),
  });

  const STATUS_OPTIONS = [
    { value: 'under_review', label: 'Mark as under review' },
    { value: 'approved',     label: 'Approve return'       },
    { value: 'rejected',     label: 'Reject return'        },
    { value: 'completed',    label: 'Mark as completed'    },
  ];

  const RESOLUTION_OPTIONS = [
    { value: 'refund',       label: 'Issue refund'          },
    { value: 'replacement',  label: 'Send replacement item' },
    { value: 'store_credit', label: 'Give store credit'     },
  ];

  const needsResolution = status === 'approved' || status === 'completed';
  const isRejecting     = status === 'rejected';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <p className="font-bold text-gray-900">Respond to return request</p>
          <p className="text-xs text-gray-500 mt-0.5">{ret.product_name} · Order {ret.order_number}</p>
        </div>

        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">

          {/* Customer reason */}
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Customer reason</p>
            <p className="text-sm text-gray-800 font-medium">{ret.reason}</p>
            {ret.customer_note && (
              <p className="text-xs text-gray-500 mt-1 italic">"{ret.customer_note}"</p>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2 block">
              Update status *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map(o => (
                <button key={o.value} onClick={() => setStatus(o.value)}
                  className={clsx(
                    'px-3 py-2.5 rounded-xl border text-sm font-medium text-left transition-all',
                    status === o.value
                      ? 'border-violet-600 bg-violet-50 text-violet-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  )}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Resolution (when approving) */}
          {needsResolution && (
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2 block">
                Resolution *
              </label>
              <div className="space-y-2">
                {RESOLUTION_OPTIONS.map(o => (
                  <button key={o.value} onClick={() => setResolution(o.value)}
                    className={clsx(
                      'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm text-left transition-all',
                      resolution === o.value
                        ? 'border-violet-600 bg-violet-50 text-violet-700 font-medium'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    )}>
                    <div className={clsx('w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center',
                      resolution === o.value ? 'border-violet-600 bg-violet-600' : 'border-gray-300')}>
                      {resolution === o.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    {o.label}
                  </button>
                ))}
              </div>

              {/* Refund amount (if refund selected) */}
              {resolution === 'refund' && (
                <div className="mt-3">
                  <label className="text-xs text-gray-500 mb-1.5 block">Refund amount (ETB)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">ETB</span>
                    <input
                      type="number"
                      value={refundAmount}
                      onChange={e => setRefundAmount(e.target.value)}
                      placeholder={String(ret.line_total ?? '')}
                      className="input pl-12 font-mono"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Original amount: {formatETB(ret.line_total ?? 0)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Seller note */}
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5 block">
              Message to customer
              {isRejecting && <span className="text-red-500 ml-1">*</span>}
              {!isRejecting && <span className="text-gray-400 font-normal normal-case ml-1">(optional)</span>}
            </label>
            <textarea
              value={sellerNote}
              onChange={e => setSellerNote(e.target.value)}
              rows={3}
              maxLength={500}
              className="input text-sm resize-none"
              placeholder={
                isRejecting
                  ? 'Explain why this return is being rejected…'
                  : 'Any instructions or notes for the customer…'
              }
            />
          </div>

          {isRejecting && !sellerNote.trim() && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
              <AlertCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-600">Please provide a reason when rejecting a return request.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={
              mutation.isPending ||
              (needsResolution && !resolution) ||
              (isRejecting && !sellerNote.trim())
            }
            className="btn-primary flex-1 text-sm gap-2 disabled:opacity-50"
          >
            {mutation.isPending
              ? <><Loader2 size={13} className="animate-spin" />Updating…</>
              : 'Save response'
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Return row ────────────────────────────────────────────────────────────────
function ReturnRow({ ret, onRespond }: { ret: any; onRespond: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const cfg    = STATUS_CFG[ret.status] ?? STATUS_CFG['requested'];
  const isOpen = ret.status === 'requested' || ret.status === 'under_review';

  return (
    <div className={clsx('card overflow-hidden border-l-4', cfg.border)}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden shrink-0">
            {ret.image_url
              ? <Image src={ret.image_url} alt={ret.product_name} width={48} height={48} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center"><Package size={16} className="text-gray-300" /></div>
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <p className="font-semibold text-sm text-gray-900">{ret.product_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Order <span className="font-mono">{ret.order_number}</span>
                  {' · '}{ret.first_name} {ret.last_name}
                  {' · '}{ret.email}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">×{ret.quantity} · {formatETB(ret.line_total)}</p>
              </div>
              <StatusBadge status={ret.status} />
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg">{ret.reason}</span>
              <span className="text-xs text-gray-400">
                {new Date(ret.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3">
          <button onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors">
            {expanded ? <><ChevronUp size={11} />Less</> : <><ChevronDown size={11} />Details</>}
          </button>
          {isOpen && (
            <button onClick={onRespond}
              className="flex items-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-800 px-3 py-1.5 bg-violet-50 border border-violet-200 rounded-lg transition-colors ml-auto">
              <MessageSquare size={11} />Respond
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-2">
          {ret.customer_note && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Customer note</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 border border-gray-100">{ret.customer_note}</p>
            </div>
          )}
          {ret.seller_note && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Your response</p>
              <p className="text-sm text-gray-700">{ret.seller_note}</p>
            </div>
          )}
          {ret.resolution && (
            <p className="text-xs text-emerald-700 font-semibold">
              Resolution: {ret.resolution.replace(/_/g, ' ')}
              {ret.refund_amount && ` · ${formatETB(ret.refund_amount)}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SellerReturnsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [activeReturn, setActiveReturn] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['seller-returns', statusFilter],
    queryFn:  () => api.get(`/seller/returns${statusFilter ? `?status=${statusFilter}` : ''}`).then((r: any) => r.data.data ?? []),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const list         = (data ?? []) as any[];
  const openCount    = list.filter(r => ['requested','under_review'].includes(r.status)).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <RotateCcw size={18} className="text-violet-600" />Return requests
          </h1>
          {openCount > 0 && (
            <p className="text-sm text-amber-600 font-medium mt-0.5 flex items-center gap-1.5">
              <AlertCircle size={13} />{openCount} {openCount === 1 ? 'request' : 'requests'} awaiting response
            </p>
          )}
        </div>
      </div>

      {/* Status filters */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {[
          { id: '',             label: 'All'         },
          { id: 'requested',    label: 'New'         },
          { id: 'under_review', label: 'Under review'},
          { id: 'approved',     label: 'Approved'    },
          { id: 'rejected',     label: 'Rejected'    },
          { id: 'completed',    label: 'Completed'   },
        ].map(t => (
          <button key={t.id} onClick={() => setStatusFilter(t.id)}
            className={clsx(
              'px-3 py-1.5 text-xs rounded-lg font-semibold transition-all',
              statusFilter === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 skeleton rounded-xl" />)}</div>
      ) : list.length === 0 ? (
        <div className="card p-14 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <RotateCcw size={24} className="text-gray-300" />
          </div>
          <p className="font-semibold text-gray-500">
            {statusFilter ? `No ${statusFilter} returns` : 'No return requests yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(ret => (
            <ReturnRow key={ret.id} ret={ret} onRespond={() => setActiveReturn(ret)} />
          ))}
        </div>
      )}

      {activeReturn && (
        <RespondModal ret={activeReturn} onClose={() => setActiveReturn(null)} />
      )}
    </div>
  );
}