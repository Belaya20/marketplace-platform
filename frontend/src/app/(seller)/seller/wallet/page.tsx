'use client';
// src/app/(seller)/seller/wallet/page.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { walletApi } from '@/lib/api';
import { formatETB } from '@/hooks';
import {
  Wallet, ArrowDownToLine, Clock, TrendingUp,
  ArrowUpRight, ArrowDownLeft, RefreshCw,
  Loader2, CheckCircle2, XCircle, AlertCircle,
  ChevronDown, ChevronUp, Info, Building2,
  Hash, User, X, CreditCard,
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

// ── Transaction config — color driven by TYPE, not sign ──────────────────────
// net_amount is always >= 0 (DB constraint: wallet_tx_net_non_neg)
// The TYPE column tells us whether money came in or went out:
//   commission_credit → money IN  (green)
//   withdrawal_debit  → money OUT (red)
//   refund_debit      → money IN  (returned, blue)
//   adjustment        → neutral   (gray)
const TX_CFG: Record<string, {
  label:  string;
  icon:   any;
  color:  string;
  bg:     string;
  amtColor: string;   // color of the amount number
  sign:   string;     // prefix to show before the amount
}> = {
  commission_credit: {
    label:    'Sale earnings',
    icon:     ArrowDownLeft,
    color:    'text-emerald-600',
    bg:       'bg-emerald-100',
    amtColor: 'text-emerald-600',
    sign:     '+',
  },
  withdrawal_debit: {
    label:    'Withdrawal',
    icon:     ArrowUpRight,
    color:    'text-red-500',
    bg:       'bg-red-100',
    amtColor: 'text-red-500',
    sign:     '-',   // display with minus prefix even though net_amount is positive
  },
  refund_debit: {
    label:    'Withdrawal returned',
    icon:     RefreshCw,
    color:    'text-blue-600',
    bg:       'bg-blue-100',
    amtColor: 'text-blue-600',
    sign:     '+',
  },
  adjustment: {
    label:    'Adjustment',
    icon:     RefreshCw,
    color:    'text-gray-500',
    bg:       'bg-gray-100',
    amtColor: 'text-gray-700',
    sign:     '',
  },
};

function getTxCfg(type: string) {
  return TX_CFG[type] ?? TX_CFG['adjustment'];
}

// ── Withdrawal status badge ───────────────────────────────────────────────────
function WithdrawalBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    pending:  { label: 'Pending',  color: 'text-amber-700',  bg: 'bg-amber-50  border-amber-200',   icon: Clock        },
    approved: { label: 'Approved', color: 'text-emerald-700',bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
    rejected: { label: 'Rejected', color: 'text-red-700',    bg: 'bg-red-50    border-red-200',     icon: XCircle      },
    paid:     { label: 'Paid',     color: 'text-violet-700', bg: 'bg-violet-50  border-violet-200',  icon: CheckCircle2 },
  };
  const cfg  = map[status] ?? map['pending'];
  const Icon = cfg.icon;
  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border', cfg.color, cfg.bg)}>
      <Icon size={11} />{cfg.label}
    </span>
  );
}

// ── Ethiopian banks ───────────────────────────────────────────────────────────
const BANKS = [
  'Commercial Bank of Ethiopia (CBE)',
  'Dashen Bank', 'Awash Bank', 'Bank of Abyssinia',
  'Cooperative Bank of Oromia', 'Nib International Bank',
  'United Bank', 'Oromia International Bank',
  'Bunna International Bank', 'Berhan International Bank',
  'Wegagen Bank', 'Zemen Bank', 'Enat Bank',
  'Telebirr', 'M-Pesa',
];

// ── Withdrawal form ───────────────────────────────────────────────────────────
function WithdrawForm({ maxAmount, hasPending, onClose }: {
  maxAmount: number; hasPending: boolean; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    amount: '', bank_name: '', account_number: '', account_name: '',
  });
  const set = (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const mutation = useMutation({
    mutationFn: () => walletApi.withdraw({
      amount:         Number(form.amount),
      bank_name:      form.bank_name,
      account_number: form.account_number,
      account_name:   form.account_name,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['withdrawal-history'] });
      toast.success('Withdrawal request submitted! You\'ll be notified when processed.');
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to submit'),
  });

  const amt   = Number(form.amount);
  const valid = amt >= 100 && amt <= maxAmount
    && form.bank_name && form.account_number && form.account_name;

  if (hasPending) return (
    <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
      <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-amber-800">Pending withdrawal in progress</p>
        <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
          You have a pending withdrawal being processed. Submit a new request once it completes.
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5 block">
          Amount (ETB) *
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">ETB</span>
          <input
            type="number" value={form.amount} onChange={set('amount')}
            min={100} max={maxAmount} placeholder="0.00"
            className="input pl-12 font-mono text-lg"
          />
        </div>
        <div className="flex justify-between text-xs mt-1.5">
          <span className="text-gray-400">Minimum: ETB 100.00</span>
          <button
            onClick={() => setForm(f => ({ ...f, amount: maxAmount.toFixed(2) }))}
            className="text-violet-600 font-semibold hover:text-violet-800 transition-colors"
          >
            Max: {formatETB(maxAmount)}
          </button>
        </div>
        {amt > 0 && amt < 100 && (
          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
            <AlertCircle size={11} />Minimum withdrawal is ETB 100
          </p>
        )}
        {amt > maxAmount && (
          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
            <AlertCircle size={11} />Exceeds available balance
          </p>
        )}
      </div>

      <div className="h-px bg-gray-100" />
      <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Bank details</p>

      <div>
        <label className="text-xs text-gray-500 mb-1.5 block">Bank / payment method *</label>
        <div className="relative">
          <Building2 size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <select value={form.bank_name} onChange={set('bank_name')} className="input pl-9 appearance-none">
            <option value="">Select bank…</option>
            {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">Account number *</label>
          <div className="relative">
            <Hash size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={form.account_number} onChange={set('account_number')}
              placeholder="1000123456789" className="input pl-9 font-mono" />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">Account holder name *</label>
          <div className="relative">
            <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={form.account_name} onChange={set('account_name')}
              placeholder="Full name" className="input pl-9" />
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2.5 p-3 bg-blue-50 border border-blue-100 rounded-xl">
        <Info size={13} className="text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed">
          Withdrawals are processed within 1–3 business days. Ensure your bank details are correct.
        </p>
      </div>

      <div className="flex gap-3">
        <button onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
        <button
          onClick={() => mutation.mutate()}
          disabled={!valid || mutation.isPending}
          className="btn-primary flex-1 text-sm gap-2 disabled:opacity-50"
        >
          {mutation.isPending
            ? <><Loader2 size={13} className="animate-spin" />Submitting…</>
            : <><ArrowDownToLine size={13} />Request withdrawal</>
          }
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SellerWalletPage() {
  const [showForm,  setShowForm]  = useState(false);
  const [showAllTx, setShowAllTx] = useState(false);
  const [showAllWd, setShowAllWd] = useState(false);
  const qc = useQueryClient();

  const { data: walletData, isLoading } = useQuery({
    queryKey:        ['wallet'],
    queryFn:         walletApi.getSummary,
    refetchInterval: 30_000,
  });
  const { data: history = [] } = useQuery({
    queryKey: ['withdrawal-history'],
    queryFn:  walletApi.getHistory,
  });

  const w                  = walletData as any;
  const walletBalance      = Number(w?.wallet_balance   ?? 0);
  const pendingBalance     = Number(w?.pending_balance  ?? 0);
  const totalEarned        = Number(w?.total_earned     ?? 0);
  const transactions       = (w?.transactions           ?? []) as any[];
  const pendingWithdrawals = (w?.pending_withdrawals    ?? []) as any[];
  const hasPending         = pendingWithdrawals.length > 0;

  const visibleTx = showAllTx ? transactions : transactions.slice(0, 5);
  const visibleWd = showAllWd ? (history as any[]) : (history as any[]).slice(0, 4);

  if (isLoading) return (
    <div className="space-y-4 max-w-2xl">
      {[1, 2, 3].map(i => <div key={i} className="h-24 skeleton rounded-2xl" />)}
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Wallet & earnings</h1>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ['wallet'] })}
          className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-5 border-l-4 border-emerald-400">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Wallet size={16} className="text-emerald-600" />
            </div>
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Available
            </span>
          </div>
          <p className="text-2xl font-black text-gray-900 tracking-tight">{formatETB(walletBalance)}</p>
          <p className="text-xs text-gray-400 mt-1">Ready to withdraw</p>
        </div>

        <div className="card p-5 border-l-4 border-amber-400">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
              <Clock size={16} className="text-amber-600" />
            </div>
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              Pending
            </span>
          </div>
          <p className="text-2xl font-black text-gray-900 tracking-tight">{formatETB(pendingBalance)}</p>
          <p className="text-xs text-gray-400 mt-1">Processing withdrawal</p>
        </div>

        <div className="card p-5 border-l-4 border-violet-400">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
              <TrendingUp size={16} className="text-violet-600" />
            </div>
            <span className="text-[10px] font-bold text-violet-600 uppercase tracking-wider bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">
              All time
            </span>
          </div>
          <p className="text-2xl font-black text-gray-900 tracking-tight">{formatETB(totalEarned)}</p>
          <p className="text-xs text-gray-400 mt-1">Total earnings</p>
        </div>
      </div>

      {/* Pending withdrawal alert */}
      {hasPending && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <Clock size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Withdrawal in progress</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {formatETB(pendingWithdrawals[0]?.amount)} is being processed to {pendingWithdrawals[0]?.bank_name}. Usually 1–3 business days.
            </p>
          </div>
        </div>
      )}

      {/* Withdraw card */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-gray-900">Request withdrawal</h2>
            <p className="text-xs text-gray-400 mt-0.5">Transfer your earnings to your bank account</p>
          </div>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              disabled={walletBalance < 100}
              className="btn-primary text-sm py-2 px-4 gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              title={walletBalance < 100 ? 'Minimum balance of ETB 100 required' : ''}
            >
              <ArrowDownToLine size={14} />Withdraw
            </button>
          ) : (
            <button onClick={() => setShowForm(false)}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={16} />
            </button>
          )}
        </div>

        {showForm && (
          <WithdrawForm
            maxAmount={walletBalance}
            hasPending={hasPending}
            onClose={() => setShowForm(false)}
          />
        )}

        {!showForm && walletBalance < 100 && (
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl text-xs text-gray-500">
            <Info size={13} className="text-gray-400 shrink-0" />
            You need at least ETB 100 in your available balance to request a withdrawal.
          </div>
        )}
      </div>

      {/* Transaction history */}
      <div className="card p-5">
        <h2 className="font-bold text-gray-900 mb-4">Transaction history</h2>

        {transactions.length === 0 ? (
          <div className="py-10 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <CreditCard size={20} className="text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-500">No transactions yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Earnings appear here when you mark items as delivered.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-0.5">
              {visibleTx.map((tx: any) => {
                const cfg  = getTxCfg(tx.type);
                const Icon = cfg.icon;
                const net  = Number(tx.net_amount ?? 0);

                return (
                  <div key={tx.id} className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
                    <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', cfg.bg)}>
                      <Icon size={15} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 leading-snug">{cfg.label}</p>
                      {tx.note && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{tx.note}</p>
                      )}
                      {/* Commission breakdown for earnings */}
                      {tx.type === 'commission_credit' && Number(tx.commission_amount) > 0 && (
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          Gross {formatETB(tx.gross_amount)} − commission {formatETB(tx.commission_amount)}
                        </p>
                      )}
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {new Date(tx.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {/* FIX: color from type, sign from type — net_amount is always positive */}
                      <p className={clsx('text-sm font-bold', cfg.amtColor)}>
                        {cfg.sign}{formatETB(net)}
                      </p>
                      {tx.status !== 'completed' && (
                        <span className="text-[10px] text-amber-600 font-medium">{tx.status}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {transactions.length > 5 && (
              <button
                onClick={() => setShowAllTx(v => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-800 mt-3 transition-colors"
              >
                {showAllTx
                  ? <><ChevronUp size={13} />Show less</>
                  : <><ChevronDown size={13} />Show all {transactions.length} transactions</>
                }
              </button>
            )}
          </>
        )}
      </div>

      {/* Withdrawal history */}
      <div className="card p-5">
        <h2 className="font-bold text-gray-900 mb-4">Withdrawal requests</h2>

        {(history as any[]).length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No withdrawal requests yet</p>
        ) : (
          <>
            <div className="space-y-0.5">
              {visibleWd.map((wr: any) => (
                <div key={wr.id} className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
                  <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                    <Building2 size={15} className="text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{wr.bank_name}</p>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">
                          {wr.account_number} · {wr.account_name}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-1">
                          {new Date(wr.requested_at).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </p>
                        {wr.admin_note && (
                          <p className="text-xs text-gray-500 mt-1 italic">Note: {wr.admin_note}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-gray-900">{formatETB(wr.amount)}</p>
                        <div className="mt-1"><WithdrawalBadge status={wr.status} /></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {(history as any[]).length > 4 && (
              <button
                onClick={() => setShowAllWd(v => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-800 mt-3 transition-colors"
              >
                {showAllWd
                  ? <><ChevronUp size={13} />Show less</>
                  : <><ChevronDown size={13} />Show all {(history as any[]).length} requests</>
                }
              </button>
            )}
          </>
        )}
      </div>

    </div>
  );
}