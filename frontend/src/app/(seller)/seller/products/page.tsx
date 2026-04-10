'use client';
// src/app/(seller)/seller/products/page.tsx
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productApi } from '@/lib/api';
import { formatETB } from '@/hooks';
import { Plus, Pencil, Trash2, Package, Eye, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const STATUS_COLORS: Record<string, string> = {
  active:         'bg-green-100 text-green-700',
  pending_review: 'bg-yellow-100 text-yellow-700',
  draft:          'bg-gray-100 text-gray-600',
  rejected:       'bg-red-100 text-red-700',
  archived:       'bg-gray-100 text-gray-400',
};

export default function SellerProductsPage() {
  const [page,   setPage]   = useState(1);
  const [status, setStatus] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['seller-products', page, status],
    queryFn:  () => productApi.getMyProducts({ page, limit: 20, status: status || undefined }),
    placeholderData: (prev: any) => prev,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => productApi.deleteProduct(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['seller-products'] }); toast.success('Product archived'); },
  });

  const products   = (data?.data ?? []) as any[];
  const totalPages = data?.meta?.total_pages ?? 1;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Products</h1>
        <Link href="/seller/products/new" className="btn-primary gap-2"><Plus size={15} />Add product</Link>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {['', 'active', 'pending_review', 'draft', 'rejected'].map(s => (
          <button key={s} onClick={() => { setStatus(s); setPage(1); }}
            className={clsx('px-3 py-1.5 text-xs rounded-lg font-medium capitalize transition-colors',
              status === s ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
            {s.replace('_', ' ') || 'All'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 skeleton rounded-xl" />)}</div>
      ) : products.length === 0 ? (
        <div className="text-center py-16">
          <Package size={48} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">No products yet</p>
          <Link href="/seller/products/new" className="btn-primary">Add your first product</Link>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Product</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Price</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Sold</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map((p: any) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 max-w-[240px]">
                      <p className="font-medium text-gray-900 truncate">{p.name}</p>
                      {p.rejection_reason && (
                        <p className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
                          <AlertCircle size={11} />{p.rejection_reason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge text-xs ${STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {p.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{p.price ? formatETB(p.price) : '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{p.total_sold ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/product/${p.slug}`} target="_blank" className="p-1.5 text-gray-400 hover:text-violet-600 rounded" title="View"><Eye size={14} /></Link>
                        <Link href={`/seller/products/${p.id}/edit`} className="p-1.5 text-gray-400 hover:text-violet-600 rounded" title="Edit"><Pencil size={14} /></Link>
                        <button onClick={() => { if (confirm('Archive this product?')) deleteMut.mutate(p.id); }}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded" title="Archive"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary px-4 py-2 text-sm disabled:opacity-40">Previous</button>
              <span className="text-sm text-gray-500 px-3 py-2">Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary px-4 py-2 text-sm disabled:opacity-40">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
