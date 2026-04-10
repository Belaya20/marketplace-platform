'use client';
// src/app/dashboard/sellers/page.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { formatETB } from '@/lib/utils';
import {
  Check, X, Loader2, Store, ChevronLeft, ChevronRight,
  Search, AlertCircle, BadgeCheck, Ban, DollarSign,
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const STATUS_COLORS: Record<string, string> = {
  pending:  'text-amber-600 bg-amber-50',
  approved: 'text-green-600 bg-green-50',
  rejected: 'text-red-600   bg-red-50',
};

export default function SellersPage() {
  const [tab,    setTab]    = useState<'pending' | 'all'>('pending');
  const [page,   setPage]   = useState(1);
  const [q,      setQ]      = useState('');
  const [status, setStatus] = useState('');
  const qc = useQueryClient();

  const { data: pending = [], isLoading: pendingLoading } = useQuery({
    queryKey: ['pending-sellers'],
    queryFn:  adminApi.getPendingSellers,
    staleTime: 30_000,
    enabled: tab === 'pending',
  });

  const { data: allData, isLoading: allLoading } = useQuery({
    queryKey: ['admin-sellers', page, q, status],
    queryFn:  () => adminApi.getAllSellers({ page, q: q || undefined, status: status || undefined }),
    staleTime: 30_000,
    placeholderData: (prev: any) => prev,
    enabled: tab === 'all',
  });

  const approveMut = useMutation({
    mutationFn: ({ id, approve, reason }: { id: string; approve: boolean; reason?: string }) =>
      adminApi.approveSeller(id, approve, reason),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['pending-sellers'] });
      qc.invalidateQueries({ queryKey: ['admin-sellers'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
      toast.success(vars.approve ? 'Seller approved' : 'Seller rejected');
    },
    onError: () => toast.error('Action failed'),
  });

  const commissionMut = useMutation({
    mutationFn: ({ id, rate }: { id: string; rate: number }) =>
      adminApi.updateCommission(id, rate),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-sellers'] }); toast.success('Commission updated'); },
  });

  const handleReject = (id: string) => {
    const reason = window.prompt('Rejection reason:');
    if (reason === null) return;
    approveMut.mutate({ id, approve: false, reason: reason || 'Did not meet requirements' });
  };

  const handleCommission = (id: string, current: number) => {
    const val = window.prompt('New commission rate (0-100%):', String(current));
    if (val === null) return;
    const rate = parseFloat(val);
    if (isNaN(rate) || rate < 0 || rate > 100) { toast.error('Invalid rate'); return; }
    commissionMut.mutate({ id, rate });
  };

  const pendingList  = pending as any[];
  const allSellers   = (allData as any)?.data ?? [];
  const totalPages   = (allData as any)?.meta?.total_pages ?? 1;
  const totalSellers = (allData as any)?.meta?.total ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Seller management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Approve sellers to allow them to list products</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {[
          { key: 'pending', label: 'Pending approval', badge: pendingList.length },
          { key: 'all',     label: 'All sellers',      badge: 0 },
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key as any); setPage(1); }}
            className={clsx('flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {t.label}
            {t.badge > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded-full font-semibold">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'pending' && (
        <div className="card overflow-hidden p-0">
          {pendingLoading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 skeleton rounded-lg" />)}</div>
          ) : pendingList.length === 0 ? (
            <div className="text-center py-16">
              <BadgeCheck size={48} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm font-medium">No pending applications</p>
            </div>
          ) : (
            <>
              <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-start gap-3">
                <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700"><strong>{pendingList.length}</strong> seller{pendingList.length !== 1 ? 's' : ''} waiting for review.</p>
              </div>
              <div className="divide-y divide-gray-50">
                {pendingList.map((seller: any) => (
                  <div key={seller.id} className="flex items-start justify-between px-5 py-4 hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Store size={15} className="text-gray-400 shrink-0" />
                        <p className="font-medium text-gray-900 truncate">{seller.business_name}</p>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5 ml-5">{seller.email}</p>
                      {seller.business_address && <p className="text-xs text-gray-400 mt-0.5 ml-5">{seller.business_address}</p>}
                      <p className="text-xs text-gray-400 mt-1 ml-5">Applied: {new Date(seller.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <button onClick={() => approveMut.mutate({ id: seller.id, approve: true })} disabled={approveMut.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors disabled:opacity-60">
                        {approveMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}Approve
                      </button>
                      <button onClick={() => handleReject(seller.id)} disabled={approveMut.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors disabled:opacity-60">
                        <X size={11} />Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'all' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }}
                placeholder="Search sellers…" className="input text-sm py-2 pl-9 pr-3 w-full" />
            </div>
            <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="input text-sm py-2 px-3">
              <option value="">All statuses</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
            <span className="text-xs text-gray-400">{totalSellers} total</span>
          </div>

          {allLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 skeleton rounded-xl" />)}</div>
          ) : (
            <div className="card overflow-hidden p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Seller</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 hidden md:table-cell">Email</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 hidden lg:table-cell">Earned</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 hidden lg:table-cell">Commission</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {allSellers.map((seller: any) => (
                    <tr key={seller.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                            <Store size={13} className="text-indigo-600" />
                          </div>
                          <p className="font-medium text-gray-900">{seller.business_name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-gray-600">{seller.email}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium capitalize', STATUS_COLORS[seller.status] || 'text-gray-600 bg-gray-100')}>
                          {seller.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell">
                        <span className="text-sm text-gray-700">{formatETB(Number(seller.total_earned || 0))}</span>
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell">
                        <button onClick={() => handleCommission(seller.id, seller.commission_rate)}
                          className="text-sm text-indigo-600 hover:underline">{seller.commission_rate}%</button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {seller.status === 'pending' && (
                            <button onClick={() => approveMut.mutate({ id: seller.id, approve: true })} disabled={approveMut.isPending}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Approve">
                              <Check size={15} />
                            </button>
                          )}
                          {seller.status === 'approved' && (
                            <button onClick={() => handleReject(seller.id)} disabled={approveMut.isPending}
                              className="p-1.5 text-red-400 hover:bg-red-50 rounded" title="Reject">
                              <Ban size={15} />
                            </button>
                          )}
                          {seller.status === 'rejected' && (
                            <button onClick={() => approveMut.mutate({ id: seller.id, approve: true })} disabled={approveMut.isPending}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Re-approve">
                              <Check size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-gray-500">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}