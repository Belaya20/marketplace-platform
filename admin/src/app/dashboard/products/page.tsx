'use client';
// src/app/dashboard/products/page.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productApi } from '@/lib/api';
import { Check, X, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

export default function ProductsPage() {
  const [page,   setPage]   = useState(1);
  const [status, setStatus] = useState('pending_review');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-products', page, status],
    queryFn:  () => productApi.search({ page, limit: 20, status }),
    placeholderData: (prev: any) => prev,
  });

  const approveMut = useMutation({
    mutationFn: ({ id, approve, reason }: { id: string; approve: boolean; reason?: string }) =>
      productApi.approveProduct(id, approve, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-products'] }); toast.success('Updated'); },
  });

  const featureMut = useMutation({
    mutationFn: ({ id, is_featured }: { id: string; is_featured: boolean }) =>
      productApi.featureProduct(id, is_featured),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-products'] }),
  });

  const products   = (data?.data ?? []) as any[];
  const totalPages = data?.meta?.total_pages ?? 1;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-gray-900">Product management</h1>

      <div className="flex gap-2 flex-wrap">
        {['pending_review', 'active', 'rejected', 'archived'].map(s => (
          <button key={s} onClick={() => { setStatus(s); setPage(1); }}
            className={clsx('px-3 py-1.5 text-xs rounded-lg font-medium transition-colors',
              status === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 skeleton rounded-xl" />)}</div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Product</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Seller</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {products.map((p: any) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 line-clamp-1">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.category_name}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.seller_name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => featureMut.mutate({ id: p.id, is_featured: !p.is_featured })}
                        className={`p-1.5 rounded ${p.is_featured ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400'}`}>
                        <Star size={15} className={p.is_featured ? 'fill-amber-500' : ''} />
                      </button>
                      {p.status === 'pending_review' && (
                        <>
                          <button onClick={() => approveMut.mutate({ id: p.id, approve: true })}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Check size={15} /></button>
                          <button onClick={() => {
                            const r = prompt('Rejection reason:') || 'Did not meet standards';
                            approveMut.mutate({ id: p.id, approve: false, reason: r });
                          }} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><X size={15} /></button>
                        </>
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
        <div className="flex justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary px-4 py-2 text-sm disabled:opacity-40">Previous</button>
          <span className="text-sm text-gray-500 px-3 py-2">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary px-4 py-2 text-sm disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}