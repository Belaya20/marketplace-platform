'use client';
// src/app/(public)/account/returns/page.tsx
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RotateCcw, Package, ChevronDown, ChevronUp,
  CheckCircle2, Clock, XCircle, Loader2, Eye,
  AlertTriangle, ArrowLeft, Send, Info, MessageSquare,
  RefreshCw, ShoppingBag,
} from 'lucide-react';
import api from '@/lib/api';
import { formatETB } from '@/hooks';
import toast from 'react-hot-toast';
import clsx from 'clsx';

// ── Exact enum values from DB ─────────────────────────────────────────────────
// returns.status: 'requested','under_review','approved','rejected','completed'
// returns.resolution: 'refund','replacement','store_credit'

const STATUS_CFG: Record<string, {
  label: string; icon: any; color: string; bg: string; border: string; unread?: boolean;
}> = {
  requested:    { label: 'Submitted',    icon: Clock,        color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-300',   unread: true  },
  under_review: { label: 'Under review', icon: RefreshCw,    color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-300',    unread: true  },
  approved:     { label: 'Approved',     icon: CheckCircle2, color: 'text-emerald-700',bg: 'bg-emerald-50', border: 'border-emerald-300'               },
  rejected:     { label: 'Rejected',     icon: XCircle,      color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-300'                   },
  completed:    { label: 'Completed',    icon: CheckCircle2, color: 'text-violet-700', bg: 'bg-violet-50',  border: 'border-violet-300'                },
};

const RESOLUTION_LABELS: Record<string, string> = {
  refund:       'Refund to original payment',
  replacement:  'Send replacement item',
  store_credit: 'Store credit issued',
};

const RETURN_REASONS = [
  'Item arrived damaged',
  'Wrong item received',
  'Item not as described',
  'Missing parts or accessories',
  'Changed my mind',
  'Quality not as expected',
  'Ordered by mistake',
  'Other',
];

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg  = STATUS_CFG[status] ?? STATUS_CFG['requested'];
  const Icon = cfg.icon;
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border',
      cfg.color, cfg.bg, cfg.border
    )}>
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

// ── Return card ───────────────────────────────────────────────────────────────
function ReturnCard({ ret }: { ret: any }) {
  const [expanded, setExpanded] = useState(false);
  const cfg    = STATUS_CFG[ret.status] ?? STATUS_CFG['requested'];
  const isOpen = ret.status === 'requested' || ret.status === 'under_review';

  return (
    <div className={clsx('card overflow-hidden border-l-4 transition-all', cfg.border)}>
      <div className="p-4">
        <div className="flex items-start gap-3">

          {/* Product image */}
          <div className="w-14 h-14 rounded-xl bg-gray-100 overflow-hidden shrink-0">
            {ret.image_url
              ? <Image src={ret.image_url} alt={ret.product_name} width={56} height={56}
                  className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center">
                  <Package size={18} className="text-gray-300" />
                </div>
            }
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-gray-900 leading-snug truncate">
                  {ret.product_name ?? 'Product'}
                </p>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{ret.sku}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Order <span className="font-mono font-medium">{ret.order_number}</span>
                  {' · '}×{ret.quantity}
                  {ret.line_total > 0 && ` · ${formatETB(ret.line_total)}`}
                </p>
              </div>
              <StatusBadge status={ret.status} />
            </div>

            {/* Reason + date */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-lg">
                {ret.reason}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(ret.created_at).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </span>
            </div>

            {/* Resolution badge if resolved */}
            {ret.resolution && (
              <div className="mt-2">
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                  {RESOLUTION_LABELS[ret.resolution] ?? ret.resolution}
                </span>
              </div>
            )}
            {ret.refund_amount && Number(ret.refund_amount) > 0 && (
              <p className="text-xs font-bold text-emerald-600 mt-1">
                Refund amount: {formatETB(Number(ret.refund_amount))}
              </p>
            )}
          </div>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-800 mt-3 transition-colors"
        >
          {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          {expanded ? 'Show less' : 'View details'}
        </button>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">

          {/* Customer note (stored in evidence_urls.note) */}
          {ret.customer_note && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <MessageSquare size={11} />Your note
              </p>
              <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-xl p-3 border border-gray-100">
                {ret.customer_note}
              </p>
            </div>
          )}

          {/* Seller response */}
          {ret.seller_note && (
            <div className={clsx('rounded-xl p-3 border', cfg.bg, cfg.border)}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <MessageSquare size={11} />Seller response
              </p>
              <p className="text-sm text-gray-700 leading-relaxed">{ret.seller_note}</p>
              {ret.seller_name && (
                <p className="text-xs text-gray-400 mt-1">— {ret.seller_name}</p>
              )}
            </div>
          )}

          {/* Admin note */}
          {ret.admin_note && (
            <div className="rounded-xl p-3 border bg-violet-50 border-violet-200">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Support note
              </p>
              <p className="text-sm text-gray-700 leading-relaxed">{ret.admin_note}</p>
            </div>
          )}

          {/* Status info for open returns */}
          {isOpen && !ret.seller_note && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
              <Info size={13} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 leading-relaxed">
                Your return is being reviewed. The seller will respond within 2 business days.
              </p>
            </div>
          )}

          {/* Resolved date */}
          {ret.resolved_at && (
            <p className="text-xs text-gray-400">
              Resolved on {new Date(ret.resolved_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── New return form (2 steps) ─────────────────────────────────────────────────
function NewReturnForm({ onSuccess }: { onSuccess: () => void }) {
  const [step,        setStep]        = useState<1 | 2>(1);
  const [selected,    setSelected]    = useState<any | null>(null);
  const [reason,      setReason]      = useState('');
  const [note,        setNote]        = useState('');
  const qc = useQueryClient();

  // Eligible delivered items not yet returned
  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['returns-eligible'],
    queryFn:  () => api.get('/returns/eligible').then((r: any) => r.data.data ?? []),
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: () => api.post('/returns', {
      order_item_id: selected?.order_item_id,
      reason,
      // note is stored inside evidence_urls.note in the backend
      note: note.trim() || undefined,
    }),
    onSuccess: () => {
      toast.success('Return request submitted! The seller will review it shortly.');
      qc.invalidateQueries({ queryKey: ['my-returns'] });
      qc.invalidateQueries({ queryKey: ['returns-eligible'] });
      onSuccess();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to submit return'),
  });

  return (
    <div className="card p-5">
      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-5">
        {[
          { n: 1, label: 'Select item' },
          { n: 2, label: 'Details'     },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <div className={clsx(
              'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all',
              step >= s.n
                ? 'bg-violet-600 text-white'
                : 'bg-gray-200 text-gray-500'
            )}>
              {step > s.n ? <CheckCircle2 size={13} className="text-white" /> : s.n}
            </div>
            <span className={clsx('text-xs font-medium', step >= s.n ? 'text-gray-900' : 'text-gray-400')}>
              {s.label}
            </span>
            {i < 1 && <div className={clsx('w-8 h-px', step > s.n ? 'bg-violet-600' : 'bg-gray-200')} />}
          </div>
        ))}
      </div>

      {/* ── Step 1: Select item ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-0.5">
              Which item do you want to return?
            </p>
            <p className="text-xs text-gray-400 mb-4">
              Only delivered items within the 7-day return window are shown.
            </p>

            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-gray-400 text-sm">
                <Loader2 size={15} className="animate-spin" />Loading your orders…
              </div>
            ) : (items as any[]).length === 0 ? (
              <div className="py-10 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <ShoppingBag size={22} className="text-gray-300" />
                </div>
                <p className="text-sm font-semibold text-gray-500">No eligible items</p>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Items become eligible for return once they are delivered.
                  {error && ' (Could not load — please refresh the page.)'}
                </p>
                <Link href="/account/orders" className="btn-secondary text-sm mt-4 inline-flex gap-1.5">
                  <Package size={13} />View my orders
                </Link>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {(items as any[]).map((item: any) => (
                  <button
                    key={item.order_item_id}
                    onClick={() => setSelected(item)}
                    className={clsx(
                      'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                      selected?.order_item_id === item.order_item_id
                        ? 'border-violet-600 bg-violet-50 shadow-sm shadow-violet-500/10'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    )}
                  >
                    <div className="w-11 h-11 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                      {item.image_url
                        ? <Image src={item.image_url} alt={item.product_name} width={44} height={44}
                            className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center">
                            <Package size={14} className="text-gray-300" />
                          </div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{item.product_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Order <span className="font-mono">{item.order_number}</span> · ×{item.quantity}
                        {item.line_total > 0 && ` · ${formatETB(item.line_total)}`}
                      </p>
                    </div>
                    <div className={clsx(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                      selected?.order_item_id === item.order_item_id
                        ? 'border-violet-600 bg-violet-600'
                        : 'border-gray-300'
                    )}>
                      {selected?.order_item_id === item.order_item_id && (
                        <CheckCircle2 size={12} className="text-white" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selected && (
            <button onClick={() => setStep(2)} className="btn-primary w-full gap-2">
              Continue to details
            </button>
          )}
        </div>
      )}

      {/* ── Step 2: Reason + note ── */}
      {step === 2 && selected && (
        <div className="space-y-4">

          {/* Selected item chip */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
            <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0">
              {selected.image_url
                ? <Image src={selected.image_url} alt={selected.product_name} width={40} height={40}
                    className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center">
                    <Package size={14} className="text-gray-300" />
                  </div>
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{selected.product_name}</p>
              <p className="text-xs text-gray-400">Order {selected.order_number}</p>
            </div>
            <button
              onClick={() => { setStep(1); setReason(''); setNote(''); }}
              className="text-xs text-violet-600 hover:text-violet-800 font-medium px-2 py-1 rounded-lg hover:bg-violet-50 transition-colors shrink-0"
            >
              Change
            </button>
          </div>

          {/* Reason selection */}
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2 block">
              Reason for return *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {RETURN_REASONS.map(r => (
                <button key={r} onClick={() => setReason(r)}
                  className={clsx(
                    'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm text-left transition-all',
                    reason === r
                      ? 'border-violet-600 bg-violet-50 text-violet-700 font-semibold shadow-sm'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300 bg-white'
                  )}
                >
                  <div className={clsx(
                    'w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all',
                    reason === r ? 'border-violet-600 bg-violet-600' : 'border-gray-300'
                  )}>
                    {reason === r && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Optional note */}
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5 block">
              Additional details
              <span className="text-gray-400 font-normal normal-case ml-1">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              maxLength={500}
              className="input text-sm resize-none"
              placeholder="Describe the issue to help the seller process your return faster…"
            />
            <p className="text-xs text-gray-400 text-right mt-0.5">{note.length}/500</p>
          </div>

          {/* Policy notice */}
          <div className="flex items-start gap-2.5 p-3 bg-blue-50 border border-blue-100 rounded-xl">
            <AlertTriangle size={13} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 leading-relaxed">
              Returns must be requested within 7 days of delivery. The seller will review and respond within 2 business days. Approved returns will be processed as refund, replacement, or store credit.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="btn-secondary flex items-center gap-1.5 text-sm">
              <ArrowLeft size={13} />Back
            </button>
            <button
              onClick={() => {
                if (!reason) { toast.error('Please select a return reason'); return; }
                mutation.mutate();
              }}
              disabled={mutation.isPending || !reason}
              className="btn-primary flex-1 gap-2 text-sm disabled:opacity-50"
            >
              {mutation.isPending
                ? <><Loader2 size={13} className="animate-spin" />Submitting…</>
                : <><Send size={13} />Submit return request</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ReturnsPage() {
  const [tab, setTab] = useState<'returns' | 'new'>('returns');

  const { data: returns = [], isLoading } = useQuery({
    queryKey: ['my-returns'],
    queryFn:  () => api.get('/returns/mine').then((r: any) => r.data.data ?? []),
    staleTime: 60_000,
  });

  const list = returns as any[];

  const counts = {
    total:     list.length,
    open:      list.filter(r => ['requested','under_review'].includes(r.status)).length,
    approved:  list.filter(r => ['approved','completed'].includes(r.status)).length,
    rejected:  list.filter(r => r.status === 'rejected').length,
  };

  return (
    <div className="container-page py-8 max-w-2xl">

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <RotateCcw size={20} className="text-violet-600" />
            Returns & refunds
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage your return requests</p>
        </div>
        <Link href="/account/orders" className="btn-secondary text-sm flex items-center gap-1.5">
          <ArrowLeft size={13} />My orders
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total',    value: counts.total,    color: 'text-gray-900',    border: 'border-gray-300'   },
          { label: 'Open',     value: counts.open,     color: 'text-amber-600',   border: 'border-amber-300'  },
          { label: 'Approved', value: counts.approved, color: 'text-emerald-600', border: 'border-emerald-300'},
          { label: 'Rejected', value: counts.rejected, color: 'text-red-500',     border: 'border-red-300'    },
        ].map(s => (
          <div key={s.label} className={clsx('card p-3 text-center border-t-4', s.border)}>
            <p className={clsx('text-2xl font-black', s.color)}>{s.value}</p>
            <p className="text-[11px] text-gray-400 mt-0.5 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-5">
        {[
          { id: 'returns', label: 'My returns', count: list.length },
          { id: 'new',     label: 'New return',  count: 0          },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors',
              tab === t.id
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}>
            {t.label}
            {t.count > 0 && (
              <span className={clsx(
                'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                tab === t.id ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500'
              )}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* My returns tab */}
      {tab === 'returns' && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="card p-10 flex items-center justify-center gap-2 text-gray-400 text-sm">
              <Loader2 size={15} className="animate-spin" />Loading your returns…
            </div>
          ) : list.length === 0 ? (
            <div className="card p-14 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <RotateCcw size={28} className="text-gray-300" />
              </div>
              <p className="font-bold text-gray-500 mb-1">No returns yet</p>
              <p className="text-xs text-gray-400 mb-5 leading-relaxed">
                If something isn't right with an order, you can submit a return request for any delivered item.
              </p>
              <button onClick={() => setTab('new')} className="btn-primary text-sm gap-2 inline-flex">
                <RotateCcw size={14} />Request a return
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => setTab('new')}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-violet-300 text-sm font-semibold text-violet-600 hover:bg-violet-50 transition-colors mb-2"
              >
                <RotateCcw size={13} />Request another return
              </button>
              {list.map(ret => <ReturnCard key={ret.id} ret={ret} />)}
            </>
          )}
        </div>
      )}

      {/* New return tab */}
      {tab === 'new' && (
        <NewReturnForm onSuccess={() => setTab('returns')} />
      )}
    </div>
  );
}