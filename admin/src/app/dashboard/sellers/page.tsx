'use client';
// admin/src/app/dashboard/sellers/page.tsx

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { formatETB } from '@/lib/utils';
import {
  Check, X, Loader2, Store, ChevronLeft, ChevronRight,
  Search, AlertCircle, BadgeCheck, Ban, Percent,
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Seller {
  id:              string;
  business_name:   string;
  email:           string;
  status:          'pending' | 'approved' | 'rejected';
  commission_rate: number;
  total_earned:    number;
  wallet_balance:  number;
  created_at:      string;
  business_address?: string;
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CLASS: Record<string, string> = {
  pending:  'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100   text-red-700',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium capitalize', STATUS_CLASS[status] ?? 'bg-gray-100 text-gray-600')}>
      {status}
    </span>
  );
}

// ── Inline rejection panel ────────────────────────────────────────────────────
// Replaces window.prompt — renders below the seller row/card when active.

interface RejectPanelProps {
  sellerId:  string;
  onConfirm: (reason: string) => void;
  onCancel:  () => void;
  loading:   boolean;
}

function RejectPanel({ onConfirm, onCancel, loading }: RejectPanelProps) {
  const [reason, setReason] = useState('');
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3 mt-2">
      <p className="text-sm font-medium text-red-800">Provide a rejection reason (optional)</p>
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        rows={2}
        autoFocus
        placeholder="e.g. Incomplete business information, invalid registration…"
        className="w-full text-sm border border-red-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none bg-white placeholder-gray-400"
      />
      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onConfirm(reason.trim() || 'Did not meet requirements')}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-60"
        >
          {loading ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
          Reject seller
        </button>
      </div>
    </div>
  );
}

// ── Inline commission edit ────────────────────────────────────────────────────
// Replaces window.prompt — renders as an inline input next to the commission value.

interface CommissionEditProps {
  current:   number;
  onSave:    (rate: number) => void;
  onCancel:  () => void;
  loading:   boolean;
}

function CommissionEdit({ current, onSave, onCancel, loading }: CommissionEditProps) {
  const [value, setValue] = useState(String(current));

  const save = () => {
    const rate = parseFloat(value);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error('Enter a value between 0 and 100');
      return;
    }
    onSave(rate);
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={e => setValue(e.target.value)}
          autoFocus
          min={0}
          max={100}
          step={0.5}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onCancel(); }}
          className="w-20 text-center text-sm py-1 border border-violet-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">%</span>
      </div>
      <button
        onClick={save}
        disabled={loading}
        className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
      </button>
      <button
        onClick={onCancel}
        className="p-1.5 text-gray-400 hover:bg-gray-100 rounded transition-colors"
      >
        <X size={13} />
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SellersPage() {
  const [tab,    setTab]    = useState<'pending' | 'all'>('pending');
  const [page,   setPage]   = useState(1);
  const [q,      setQ]      = useState('');
  const [status, setStatus] = useState('');

  // Per-seller loading state — avoids disabling unrelated rows
  const [approvingId,   setApprovingId]   = useState<string | null>(null);
  const [rejectingId,   setRejectingId]   = useState<string | null>(null);
  const [commissionId,  setCommissionId]  = useState<string | null>(null);

  const qc = useQueryClient();

  const { data: pending = [], isLoading: pendingLoading } = useQuery({
    queryKey: ['pending-sellers'],
    queryFn:  adminApi.getPendingSellers,
    staleTime: 30_000,
    enabled:   tab === 'pending',
  });

  const { data: allData, isLoading: allLoading } = useQuery({
    queryKey: ['admin-sellers', page, q, status],
    queryFn:  () => adminApi.getAllSellers({ page, q: q || undefined, status: status || undefined }),
    staleTime: 30_000,
    placeholderData: (prev: any) => prev,
    enabled:   tab === 'all',
  });

  const approveMut = useMutation({
    mutationFn: ({ id, approve, reason }: { id: string; approve: boolean; reason?: string }) =>
      adminApi.approveSeller(id, approve, reason),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['pending-sellers'] });
      qc.invalidateQueries({ queryKey: ['admin-sellers'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
      toast.success(vars.approve ? 'Seller approved' : 'Seller rejected');
      setRejectingId(null);
      setApprovingId(null);
    },
    onError: () => {
      toast.error('Action failed. Please try again.');
      setApprovingId(null);
    },
  });

  const commissionMut = useMutation({
    mutationFn: ({ id, rate }: { id: string; rate: number }) =>
      adminApi.updateCommission(id, rate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sellers'] });
      toast.success('Commission updated');
      setCommissionId(null);
    },
    onError: () => toast.error('Failed to update commission'),
  });

  const handleApprove = (id: string) => {
    setApprovingId(id);
    approveMut.mutate({ id, approve: true });
  };

  const handleRejectConfirm = (id: string, reason: string) => {
    approveMut.mutate({ id, approve: false, reason });
  };

  const pendingList  = pending as Seller[];
  const allSellers   = (allData as any)?.data ?? [] as Seller[];
  const totalPages   = (allData as any)?.meta?.total_pages ?? 1;
  const totalSellers = (allData as any)?.meta?.total ?? 0;

  return (
    <div className="space-y-4 sm:space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Sellers</h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Approve sellers to allow them to list products</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200 overflow-x-auto">
        {([
          { key: 'pending', label: 'Pending approval', badge: pendingList.length },
          { key: 'all',     label: 'All sellers',      badge: 0 },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setPage(1); setRejectingId(null); }}
            className={clsx(
              'flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
              tab === t.key
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {t.label}
            {t.badge > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] sm:text-xs bg-red-100 text-red-700 rounded-full font-semibold">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── PENDING TAB ── */}
      {tab === 'pending' && (
        <div className="card overflow-hidden p-0">
          {pendingLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 skeleton rounded-lg" />
              ))}
            </div>
          ) : pendingList.length === 0 ? (
            <div className="text-center py-16">
              <BadgeCheck size={48} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm font-medium">No pending applications</p>
              <p className="text-gray-300 text-xs mt-1">All seller applications have been reviewed</p>
            </div>
          ) : (
            <>
              <div className="px-4 sm:px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-start gap-3">
                <AlertCircle size={15} className="text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700">
                  <strong>{pendingList.length}</strong> seller{pendingList.length !== 1 ? 's' : ''} waiting for review.
                  Approved sellers will receive an email notification and can log in immediately.
                </p>
              </div>

              <div className="divide-y divide-gray-50">
                {pendingList.map((seller: Seller) => {
                  const isApproving = approvingId === seller.id && approveMut.isPending;
                  const isRejecting = rejectingId === seller.id;

                  return (
                    <div key={seller.id} className="px-4 sm:px-5 py-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                              <Store size={14} className="text-violet-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 text-sm truncate">{seller.business_name}</p>
                              <p className="text-xs text-gray-500 truncate">{seller.email}</p>
                            </div>
                          </div>
                          {seller.business_address && (
                            <p className="text-xs text-gray-400 mt-1.5 ml-10">{seller.business_address}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1 ml-10">
                            Applied {new Date(seller.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleApprove(seller.id)}
                            disabled={isApproving || (approveMut.isPending && approvingId === seller.id)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors disabled:opacity-60"
                          >
                            {isApproving
                              ? <Loader2 size={11} className="animate-spin" />
                              : <Check size={11} />
                            }
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectingId(isRejecting ? null : seller.id)}
                            className={clsx(
                              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                              isRejecting
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-700',
                            )}
                          >
                            <X size={11} />Reject
                          </button>
                        </div>
                      </div>

                      {/* Inline rejection panel */}
                      {isRejecting && (
                        <RejectPanel
                          sellerId={seller.id}
                          onConfirm={reason => handleRejectConfirm(seller.id, reason)}
                          onCancel={() => setRejectingId(null)}
                          loading={approveMut.isPending && rejectingId === seller.id}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── ALL SELLERS TAB ── */}
      {tab === 'all' && (
        <div className="space-y-4">

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                value={q}
                onChange={e => { setQ(e.target.value); setPage(1); }}
                placeholder="Search sellers…"
                className="input text-sm py-2 pl-8 pr-3 w-full"
              />
            </div>
            <select
              value={status}
              onChange={e => { setStatus(e.target.value); setPage(1); }}
              className="input text-sm py-2 w-auto"
            >
              <option value="">All statuses</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
            {totalSellers > 0 && (
              <span className="text-xs text-gray-400 ml-auto">{totalSellers} sellers</span>
            )}
          </div>

          {allLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 skeleton rounded-xl" />
              ))}
            </div>
          ) : allSellers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <Store size={36} className="text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-500">No sellers found</p>
              {(q || status) && (
                <button
                  onClick={() => { setQ(''); setStatus(''); setPage(1); }}
                  className="text-xs text-violet-600 hover:text-violet-800 mt-2 font-medium"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile: Cards */}
              <div className="sm:hidden space-y-2">
                {(allSellers as Seller[]).map(seller => {
                  const isRejectingThis = rejectingId === seller.id;
                  const isCommissionEdit = commissionId === seller.id;

                  return (
                    <div key={seller.id} className="card p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                            <Store size={15} className="text-violet-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate">{seller.business_name}</p>
                            <p className="text-xs text-gray-400 truncate">{seller.email}</p>
                          </div>
                        </div>
                        <StatusBadge status={seller.status} />
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-500 px-0.5">
                        <span>Earned: <strong className="text-gray-700">{formatETB(Number(seller.total_earned ?? 0))}</strong></span>
                        <span className="flex items-center gap-1">
                          <Percent size={10} />
                          {isCommissionEdit ? (
                            <CommissionEdit
                              current={seller.commission_rate}
                              onSave={rate => commissionMut.mutate({ id: seller.id, rate })}
                              onCancel={() => setCommissionId(null)}
                              loading={commissionMut.isPending}
                            />
                          ) : (
                            <button
                              onClick={() => setCommissionId(seller.id)}
                              className="font-semibold text-violet-600 hover:underline"
                            >
                              {seller.commission_rate}%
                            </button>
                          )}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        {seller.status === 'pending' && (
                          <button
                            onClick={() => handleApprove(seller.id)}
                            disabled={approvingId === seller.id && approveMut.isPending}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-60 transition-colors"
                          >
                            {approvingId === seller.id && approveMut.isPending
                              ? <Loader2 size={11} className="animate-spin" />
                              : <Check size={11} />
                            }
                            Approve
                          </button>
                        )}
                        {(seller.status === 'approved' || seller.status === 'pending') && (
                          <button
                            onClick={() => setRejectingId(isRejectingThis ? null : seller.id)}
                            className={clsx(
                              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors',
                              isRejectingThis
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-700',
                            )}
                          >
                            <Ban size={11} />
                            {seller.status === 'approved' ? 'Reject' : 'Reject'}
                          </button>
                        )}
                        {seller.status === 'rejected' && (
                          <button
                            onClick={() => handleApprove(seller.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors"
                          >
                            <Check size={11} />Re-approve
                          </button>
                        )}
                      </div>

                      {isRejectingThis && (
                        <RejectPanel
                          sellerId={seller.id}
                          onConfirm={reason => handleRejectConfirm(seller.id, reason)}
                          onCancel={() => setRejectingId(null)}
                          loading={approveMut.isPending && rejectingId === seller.id}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop: Table */}
              <div className="hidden sm:block card overflow-hidden p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 whitespace-nowrap">Seller</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 whitespace-nowrap hidden md:table-cell">Email</th>
                        <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 whitespace-nowrap">Status</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 whitespace-nowrap hidden lg:table-cell">Earned</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 whitespace-nowrap hidden lg:table-cell">Commission</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(allSellers as Seller[]).map(seller => {
                        const isRejectingThis  = rejectingId === seller.id;
                        const isCommissionEdit = commissionId === seller.id;

                        return (
                          <>
                            <tr key={seller.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                                    <Store size={13} className="text-violet-600" />
                                  </div>
                                  <p className="font-medium text-gray-900">{seller.business_name}</p>
                                </div>
                              </td>
                              <td className="px-4 py-3 hidden md:table-cell text-gray-500 text-xs">{seller.email}</td>
                              <td className="px-4 py-3 text-center">
                                <StatusBadge status={seller.status} />
                              </td>
                              <td className="px-4 py-3 text-right hidden lg:table-cell text-gray-700 text-sm">
                                {formatETB(Number(seller.total_earned ?? 0))}
                              </td>
                              <td className="px-4 py-3 text-right hidden lg:table-cell">
                                {isCommissionEdit ? (
                                  <div className="flex justify-end">
                                    <CommissionEdit
                                      current={seller.commission_rate}
                                      onSave={rate => commissionMut.mutate({ id: seller.id, rate })}
                                      onCancel={() => setCommissionId(null)}
                                      loading={commissionMut.isPending}
                                    />
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setCommissionId(seller.id)}
                                    className="inline-flex items-center gap-1 text-sm text-violet-600 hover:text-violet-800 hover:underline"
                                  >
                                    {seller.commission_rate}%
                                    <Percent size={11} />
                                  </button>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1">
                                  {seller.status === 'pending' && (
                                    <button
                                      onClick={() => handleApprove(seller.id)}
                                      disabled={approvingId === seller.id && approveMut.isPending}
                                      className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                                      title="Approve"
                                    >
                                      {approvingId === seller.id && approveMut.isPending
                                        ? <Loader2 size={14} className="animate-spin" />
                                        : <Check size={14} />
                                      }
                                    </button>
                                  )}
                                  {seller.status === 'rejected' && (
                                    <button
                                      onClick={() => handleApprove(seller.id)}
                                      className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                                      title="Re-approve"
                                    >
                                      <Check size={14} />
                                    </button>
                                  )}
                                  {(seller.status === 'approved' || seller.status === 'pending') && (
                                    <button
                                      onClick={() => setRejectingId(isRejectingThis ? null : seller.id)}
                                      className={clsx('p-1.5 rounded transition-colors',
                                        isRejectingThis
                                          ? 'text-red-600 bg-red-50'
                                          : 'text-red-400 hover:bg-red-50 hover:text-red-600')}
                                      title="Reject"
                                    >
                                      <Ban size={14} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {/* Inline rejection panel spans full table width */}
                            {isRejectingThis && (
                              <tr key={`${seller.id}-reject`}>
                                <td colSpan={6} className="px-4 pb-4">
                                  <RejectPanel
                                    sellerId={seller.id}
                                    onConfirm={reason => handleRejectConfirm(seller.id, reason)}
                                    onCancel={() => setRejectingId(null)}
                                    loading={approveMut.isPending && rejectingId === seller.id}
                                  />
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span className="text-xs sm:text-sm text-gray-500 tabular-nums">{page} / {totalPages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}