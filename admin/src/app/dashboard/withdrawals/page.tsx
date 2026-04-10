'use client';
// src/app/dashboard/withdrawals/page.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { withdrawalsApi } from '@/lib/api';
import { formatETB } from '@/lib/utils';
import {
  Wallet, CheckCircle2, XCircle, Clock, Loader2,
  Building2, AlertCircle, ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
    pending:  { label: 'Pending',  color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200',   icon: Clock        },
    approved: { label: 'Approved', color: 'text-emerald-700',bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle2 },
    rejected: { label: 'Rejected', color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200',     icon: XCircle      },
    paid:     { label: 'Paid',     color: 'text-violet-700', bg: 'bg-violet-50',  border: 'border-violet-200',  icon: CheckCircle2 },
  };
  const cfg  = map[status] ?? map['pending'];
  const Icon = cfg.icon;
  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border', cfg.color, cfg.bg, cfg.border)}>
      <Icon size={11} />{cfg.label}
    </span>
  );
}

function ActionModal({ wr, action, onClose }: { wr: any; action: 'approve' | 'reject'; onClose: () => void }) {
  const [note, setNote] = useState('');
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => withdrawalsApi.process(wr.id, action === 'approve' ? 'approved' : 'rejected', note.trim() || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-withdrawals'] });
      toast.success(action === 'approve' ? 'Withdrawal approved' : 'Withdrawal rejected — funds returned to seller');
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Action failed'),
  });

  const isApprove = action === 'approve';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className={clsx('px-6 py-4 border-b', isApprove ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100')}>
          <div className="flex items-center gap-3">
            <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', isApprove ? 'bg-emerald-100' : 'bg-red-100')}>
              {isApprove ? <CheckCircle2 size={20} className="text-emerald-600" /> : <XCircle size={20} className="text-red-600" />}
            </div>
            <div>
              <p className="font-bold text-gray-900">{isApprove ? 'Approve withdrawal' : 'Reject withdrawal'}</p>
              <p className="text-xs text-gray-500 mt-0.5">{isApprove ? 'Confirm funds sent to seller' : 'Funds returned to seller wallet'}</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Seller</span><span className="font-semibold">{wr.business_name}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-black text-base">{formatETB(Number(wr.amount))}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Bank</span><span className="font-medium">{wr.bank_name}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Account</span><span className="font-mono">{wr.account_number}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Name</span><span className="font-medium">{wr.account_name}</span></div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">
              Note {!isApprove && <span className="text-red-500">*</span>}
              {isApprove && <span className="text-gray-400 font-normal normal-case ml-1">(optional)</span>}
            </label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
              className="input text-sm resize-none"
              placeholder={isApprove ? 'Transfer reference…' : 'Reason for rejection…'} />
          </div>
          {isApprove && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
              <AlertCircle size={13} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">Only approve after confirming the bank transfer.</p>
            </div>
          )}
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || (!isApprove && !note.trim())}
            className={clsx('flex-1 text-sm font-bold py-2.5 px-4 rounded-xl transition-all gap-2 flex items-center justify-center disabled:opacity-50',
              isApprove ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white')}>
            {mutation.isPending ? <><Loader2 size={14} className="animate-spin" />Processing…</> : isApprove ? 'Confirm approve' : 'Confirm reject'}
          </button>
        </div>
      </div>
    </div>
  );
}

function WithdrawalRow({ wr, onAction }: { wr: any; onAction: (wr: any, a: 'approve' | 'reject') => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="card overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
            <Building2 size={16} className="text-gray-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="font-bold text-gray-900 text-sm">{wr.business_name}</p>
                <p className="text-xs text-gray-400">{wr.email}</p>
                <p className="text-xs text-gray-500 mt-1">{wr.bank_name} · <span className="font-mono">{wr.account_number}</span> · {wr.account_name}</p>
                <p className="text-[11px] text-gray-400 mt-1">
                  {new Date(wr.requested_at).toLocaleDateString('en-GB', { day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit' })}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-black text-gray-900">{formatETB(Number(wr.amount))}</p>
                <div className="mt-1"><StatusBadge status={wr.status} /></div>
              </div>
            </div>
            <button onClick={() => setExpanded(e => !e)}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 mt-2 transition-colors">
              {expanded ? <><ChevronUp size={11} />Less</> : <><ChevronDown size={11} />Details</>}
            </button>
          </div>
        </div>
        {wr.status === 'pending' && (
          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
            <button onClick={() => onAction(wr, 'approve')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm font-semibold hover:bg-emerald-100 transition-colors">
              <CheckCircle2 size={14} />Approve
            </button>
            <button onClick={() => onAction(wr, 'reject')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors">
              <XCircle size={14} />Reject
            </button>
          </div>
        )}
      </div>
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 bg-gray-50/50 space-y-2 text-xs">
          <div className="flex justify-between"><span className="text-gray-500">Request ID</span><span className="font-mono text-gray-700">{wr.id.slice(0,8)}…</span></div>
          {wr.processed_at && <div className="flex justify-between"><span className="text-gray-500">Processed</span><span className="text-gray-700">{new Date(wr.processed_at).toLocaleDateString('en-GB')}</span></div>}
          {wr.admin_note && <div><span className="text-gray-500 block mb-1">Note</span><p className="text-gray-700 bg-white rounded-lg p-2 border border-gray-200">{wr.admin_note}</p></div>}
        </div>
      )}
    </div>
  );
}

export default function WithdrawalsPage() {
  const [statusFilter, setStatusFilter] = useState('pending');
  const [modal, setModal] = useState<{ wr: any; action: 'approve' | 'reject' } | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-withdrawals', statusFilter],
    queryFn:  () => withdrawalsApi.list(statusFilter ? { status: statusFilter } : {}),
    select:   (r: any) => r.data?.data ?? [],
    refetchInterval: 30_000,
  });

  const list         = (data ?? []) as any[];
  const pendingCount = list.filter((w: any) => w.status === 'pending').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Wallet size={20} className="text-indigo-600" />Withdrawal requests
          </h1>
          {pendingCount > 0 && (
            <p className="text-sm text-amber-600 font-medium mt-0.5 flex items-center gap-1.5">
              <AlertCircle size={13} />{pendingCount} pending {pendingCount === 1 ? 'request' : 'requests'} awaiting action
            </p>
          )}
        </div>
        <button onClick={() => qc.invalidateQueries({ queryKey: ['admin-withdrawals'] })}
          className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[{id:'pending',label:'Pending'},{id:'approved',label:'Approved'},{id:'rejected',label:'Rejected'},{id:'',label:'All'}].map(t => (
          <button key={t.id} onClick={() => setStatusFilter(t.id)}
            className={clsx('px-4 py-2 text-sm font-semibold rounded-lg transition-all',
              statusFilter === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-28 skeleton rounded-xl" />)}</div>
      ) : list.length === 0 ? (
        <div className="card p-14 text-center">
          <Wallet size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="font-semibold text-gray-500">{statusFilter === 'pending' ? 'No pending requests' : 'No requests found'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((wr: any) => <WithdrawalRow key={wr.id} wr={wr} onAction={(w, a) => setModal({ wr: w, action: a })} />)}
        </div>
      )}

      {modal && <ActionModal wr={modal.wr} action={modal.action} onClose={() => setModal(null)} />}
    </div>
  );
}