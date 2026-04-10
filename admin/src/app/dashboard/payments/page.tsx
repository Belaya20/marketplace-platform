'use client';
// src/app/dashboard/payments/page.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { paymentApi } from '@/lib/api';
import { formatETB } from '@/lib/utils';
import clsx from 'clsx';

export default function PaymentsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-payments', page],
    queryFn:  () => paymentApi.getLogs(page),
    placeholderData: (prev: any) => prev,
  });

  const payments   = (data?.data ?? []) as any[];
  const totalPages = data?.meta?.total_pages ?? 1;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-gray-900">Payment logs</h1>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 skeleton rounded-xl" />)}</div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Order</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Tx ref</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Amount</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {payments.map((p: any) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{p.order_number}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 max-w-[140px] truncate">{p.chapa_tx_ref}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatETB(p.amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={clsx('badge text-xs', {
                      'bg-green-100 text-green-700':  p.status === 'success',
                      'bg-red-100 text-red-700':      p.status === 'failed',
                      'bg-yellow-100 text-yellow-700':p.status === 'pending',
                      'bg-gray-100 text-gray-600':    !['success','failed','pending'].includes(p.status),
                    })}>{p.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-400">
                    {new Date(p.initiated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary px-4 py-2 text-sm disabled:opacity-40">Previous</button>
          <span className="text-sm text-gray-500 px-3 py-2">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary px-4 py-2 text-sm disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}