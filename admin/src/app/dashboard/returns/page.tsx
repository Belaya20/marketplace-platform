'use client';
// src/app/dashboard/returns/page.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { returnsApi } from '@/lib/api';
import {
  RotateCcw, ChevronDown, ChevronUp, CheckCircle2,
  XCircle, Clock, RefreshCw, Loader2, AlertCircle,
  Package, User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatETB } from '@/lib/utils';
import clsx from 'clsx';

// ── Exact DB enum values ──────────────────────────────────────────────────────
// returns.status: requested | under_review | approved | rejected | completed
// returns.resolution: refund | replacement | store_credit

const STATUS_CFG: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
  requested:    { label: 'New request',  icon: Clock,        color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200'   },
  under_review: { label: 'Under review', icon: RefreshCw,    color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200'    },
  approved:     { label: 'Approved',     icon: CheckCircle2, color: 'text-emerald-700',bg: 'bg-emerald-50', border: 'border-emerald-200' },
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

// ── Update modal ──────────────────────────────────────────────────────────────
function UpdateModal({ ret, onClose }: { ret: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState(ret.status);
  const [note,   setNote]   = useState(ret.admin_note ?? '');

  const mutation = useMutation({
    mutationFn: () => returnsApi.update(ret.id, status, note.trim() || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-returns'] });
      toast.success('Return updated');
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Update failed'),
  });

  const STATUS_OPTIONS = [
    { value: 'requested',    label: 'New request'  },
    { value: 'under_review', label: 'Under review' },
    { value: 'approved',     label: 'Approve'      },
    { value: 'rejected',     label: 'Reject'       },
    { value: 'completed',    label: 'Complete'      },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <p className="font-bold text-gray-900">Update return request</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {ret.product_name} · Order {ret.order_number}
          </p>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Customer info */}
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Customer</span>
              <span className="font-medium text-gray-900">{ret.first_name} {ret.last_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Reason</span>
              <span className="font-medium text-gray-900 text-right max-w-[60%]">{ret.reason}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Amount</span>
              <span className="font-bold text-gray-900">{formatETB(Number(ret.line_total ?? 0))}</span>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2 block">
              Update status *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map(o => (
                <button key={o.value} onClick={() => setStatus(o.value)}
                  className={clsx('px-3 py-2.5 rounded-xl border text-sm font-medium text-left transition-all',
                    status === o.value
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300')}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Admin note */}
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5 block">
              Admin note
              <span className="text-gray-400 font-normal normal-case ml-1">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              className="input text-sm resize-none"
              placeholder="Instructions for customer, resolution details…"
            />
          </div>

          {/* Warning for rejection */}
          {status === 'rejected' && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
              <AlertCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-600">
                Rejecting a return will notify the customer. Add a note explaining why.
              </p>
            </div>
          )}
        </div>

        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="btn-primary flex-1 text-sm gap-2 disabled:opacity-50"
          >
            {mutation.isPending
              ? <><Loader2 size={13} className="animate-spin" />Updating…</>
              : 'Save changes'
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Return row ────────────────────────────────────────────────────────────────
function ReturnRow({ ret, onUpdate }: { ret: any; onUpdate: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CFG[ret.status] ?? STATUS_CFG['requested'];

  return (
    <div className={clsx('card overflow-hidden border-l-4', cfg.border)}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
            <Package size={16} className="text-gray-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="font-bold text-sm text-gray-900">{ret.product_name ?? 'Product'}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Order <span className="font-mono">{ret.order_number}</span>
                  {' · '}{ret.first_name} {ret.last_name}
                  {' · '}{ret.email}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  ×{ret.quantity} · {formatETB(Number(ret.line_total ?? 0))}
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg">
                    {ret.reason}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(ret.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <StatusBadge status={ret.status} />
                {ret.resolution && (
                  <p className="text-xs text-gray-500 mt-1 capitalize">
                    {ret.resolution.replace(/_/g, ' ')}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 mt-3">
              <button onClick={() => setExpanded(e => !e)}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors">
                {expanded ? <><ChevronUp size={11} />Less</> : <><ChevronDown size={11} />Details</>}
              </button>
              <button onClick={onUpdate}
                className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg transition-colors ml-auto">
                Update status
              </button>
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-2 text-xs bg-gray-50/50">
          {ret.seller_note && (
            <div>
              <p className="text-gray-500 font-semibold uppercase tracking-wide mb-1">Seller response</p>
              <p className="text-gray-700">{ret.seller_note}</p>
            </div>
          )}
          {ret.admin_note && (
            <div>
              <p className="text-gray-500 font-semibold uppercase tracking-wide mb-1">Admin note</p>
              <p className="text-gray-700">{ret.admin_note}</p>
            </div>
          )}
          {ret.resolved_at && (
            <p className="text-gray-400">
              Resolved: {new Date(ret.resolved_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
          <div className="flex justify-between pt-1">
            <span className="text-gray-400">Return ID</span>
            <span className="font-mono text-gray-600">{ret.id.slice(0, 8)}…</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ReturnsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [activeReturn, setActiveReturn] = useState<any | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-returns', statusFilter],
    queryFn:  () => returnsApi.list(statusFilter ? { status: statusFilter } : {}),
    select:   (r: any) => r.data?.data ?? [],
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const list = (data ?? []) as any[];
  const openCount = list.filter(r => ['requested', 'under_review'].includes(r.status)).length;

  const STATUS_FILTERS = [
    { id: '',             label: 'All'          },
    { id: 'requested',    label: 'New'          },
    { id: 'under_review', label: 'Under review' },
    { id: 'approved',     label: 'Approved'     },
    { id: 'rejected',     label: 'Rejected'     },
    { id: 'completed',    label: 'Completed'    },
  ];

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <RotateCcw size={20} className="text-indigo-600" />
            Return requests
          </h1>
          {openCount > 0 && (
            <p className="text-sm text-amber-600 font-medium mt-0.5 flex items-center gap-1.5">
              <AlertCircle size={13} />
              {openCount} {openCount === 1 ? 'request' : 'requests'} awaiting review
            </p>
          )}
        </div>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ['admin-returns'] })}
          className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {STATUS_FILTERS.map(t => (
          <button key={t.id} onClick={() => setStatusFilter(t.id)}
            className={clsx('px-3 py-1.5 text-xs rounded-lg font-semibold transition-all',
              statusFilter === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-28 skeleton rounded-xl" />)}
        </div>
      ) : list.length === 0 ? (
        <div className="card p-14 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <RotateCcw size={24} className="text-gray-300" />
          </div>
          <p className="font-semibold text-gray-500">
            {statusFilter ? `No ${statusFilter.replace('_', ' ')} returns` : 'No return requests yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(ret => (
            <ReturnRow key={ret.id} ret={ret} onUpdate={() => setActiveReturn(ret)} />
          ))}
        </div>
      )}

      {activeReturn && (
        <UpdateModal ret={activeReturn} onClose={() => setActiveReturn(null)} />
      )}
    </div>
  );
}