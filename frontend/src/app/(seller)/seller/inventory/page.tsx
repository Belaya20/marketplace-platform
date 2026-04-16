'use client';
// frontend/src/app/seller/inventory/page.tsx

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sellerApi, productApi } from '@/lib/api';
import { AlertTriangle, History, Pencil, Check, X, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface InventoryItem {
  id:           string;
  product_name: string;
  sku:          string;
  stock_status: 'out_of_stock' | 'low_stock' | 'in_stock';
  stock_qty:    number;
}

interface StockHistoryItem {
  id:         string;
  qty_change: number;
  qty_before: number;
  qty_after:  number;
  reason:     string;
  created_at: string;
}

const STATUS_LABEL: Record<InventoryItem['stock_status'], string> = {
  out_of_stock: 'Out of stock',
  low_stock:    'Low stock',
  in_stock:     'In stock',
};

const STATUS_CLASS: Record<InventoryItem['stock_status'], string> = {
  out_of_stock: 'bg-red-100   text-red-700',
  low_stock:    'bg-amber-100 text-amber-700',
  in_stock:     'bg-green-100 text-green-700',
};

export default function SellerInventoryPage() {
  const [page,      setPage]      = useState(1);
  const [editId,    setEditId]    = useState<string | null>(null);
  const [editQty,   setEditQty]   = useState(0);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ data: InventoryItem[]; meta: { total_pages: number } }>({
    queryKey: ['seller-inventory', page],
    queryFn:  () => sellerApi.getInventory(page) as any,
  });

  const { data: historyData } = useQuery<{ variant?: { sku: string }; history: StockHistoryItem[] }>({
    queryKey: ['stock-history', historyId],
    queryFn:  () => sellerApi.getStockHistory(historyId!) as any,
    enabled:  !!historyId,
  });

  const updateMut = useMutation({
    mutationFn: ({ variantId, qty }: { variantId: string; qty: number }) =>
      productApi.updateStock(variantId, qty),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seller-inventory'] });
      setEditId(null);
      toast.success('Stock updated');
    },
    onError: () => toast.error('Failed to update stock'),
  });

  const startEdit = (item: InventoryItem) => {
    setEditId(item.id);
    setEditQty(item.stock_qty);
    setHistoryId(null);
  };

  const cancelEdit = () => setEditId(null);

  const submitEdit = (variantId: string) => {
    if (editQty < 0) { toast.error('Quantity cannot be negative'); return; }
    updateMut.mutate({ variantId, qty: editQty });
  };

  const toggleHistory = (id: string) =>
    setHistoryId(prev => (prev === id ? null : id));

  const items      = data?.data ?? [];
  const totalPages = data?.meta?.total_pages ?? 1;
  const lowCount   = items.filter(i => i.stock_status === 'low_stock').length;
  const outCount   = items.filter(i => i.stock_status === 'out_of_stock').length;

  return (
    <div className="space-y-4 sm:space-y-5">
      <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Inventory</h1>

      {/* Alerts */}
      {(lowCount > 0 || outCount > 0) && (
        <div className="space-y-2">
          {outCount > 0 && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-3 sm:p-4">
              <AlertTriangle size={16} className="text-red-500 shrink-0" />
              <p className="text-sm text-red-800 font-medium">
                {outCount} variant{outCount > 1 ? 's are' : ' is'} out of stock.
              </p>
            </div>
          )}
          {lowCount > 0 && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4">
              <AlertTriangle size={16} className="text-amber-500 shrink-0" />
              <p className="text-sm text-amber-800 font-medium">
                {lowCount} variant{lowCount > 1 ? 's are' : ' is'} running low.
              </p>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <Package size={36} className="text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No inventory items found</p>
          <p className="text-xs text-gray-400 mt-1">Add products to see them here</p>
        </div>
      ) : (
        <>
          {/* ── Mobile: Card list ── */}
          <div className="sm:hidden space-y-2">
            {items.map(item => (
              <div
                key={item.id}
                className={clsx('card p-4 space-y-3', {
                  'border-red-100':   item.stock_status === 'out_of_stock',
                  'border-amber-100': item.stock_status === 'low_stock',
                })}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm leading-snug truncate">
                      {item.product_name}
                    </p>
                    <p className="font-mono text-xs text-gray-400 mt-0.5">{item.sku}</p>
                  </div>
                  <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shrink-0', STATUS_CLASS[item.stock_status])}>
                    {STATUS_LABEL[item.stock_status]}
                  </span>
                </div>

                {editId === item.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      autoFocus
                      value={editQty}
                      onChange={e => setEditQty(Number(e.target.value))}
                      className="flex-1 text-center text-sm py-2 border border-violet-300 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none"
                      min={0}
                    />
                    <button
                      onClick={() => submitEdit(item.id)}
                      disabled={updateMut.isPending}
                      className="p-2.5 bg-green-500 text-white rounded-lg disabled:opacity-50 hover:bg-green-600 transition-colors"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="p-2.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      Stock: <span className="font-semibold text-gray-900">{item.stock_qty}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEdit(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors"
                      >
                        <Pencil size={12} />Edit stock
                      </button>
                      <button
                        onClick={() => toggleHistory(item.id)}
                        className={clsx('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                          historyId === item.id
                            ? 'text-violet-700 bg-violet-100'
                            : 'text-gray-500 bg-gray-100 hover:bg-gray-200')}
                      >
                        <History size={12} />History
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── Desktop: Table ── */}
          <div className="hidden sm:block bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">SKU</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-[220px] truncate">
                        {item.product_name}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                        {item.sku}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={clsx('px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide', STATUS_CLASS[item.stock_status])}>
                          {STATUS_LABEL[item.stock_status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {editId === item.id ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <input
                              type="number"
                              autoFocus
                              value={editQty}
                              onChange={e => setEditQty(Number(e.target.value))}
                              className="w-20 text-center text-sm py-1 border border-violet-300 rounded focus:ring-2 focus:ring-violet-500 outline-none"
                              min={0}
                            />
                            <button
                              onClick={() => submitEdit(item.id)}
                              disabled={updateMut.isPending}
                              className="text-green-600 hover:text-green-800 p-1 disabled:opacity-50"
                            >
                              <Check size={15} />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="text-gray-400 hover:text-gray-600 p-1"
                            >
                              <X size={15} />
                            </button>
                          </div>
                        ) : (
                          <span className="font-semibold text-gray-900">{item.stock_qty}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => startEdit(item)}
                            className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded transition-colors"
                            title="Edit stock"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => toggleHistory(item.id)}
                            className={clsx('p-1.5 rounded transition-colors',
                              historyId === item.id
                                ? 'text-violet-600 bg-violet-50'
                                : 'text-gray-400 hover:text-violet-600 hover:bg-violet-50')}
                            title="Stock history"
                          >
                            <History size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Stock history panel */}
      {historyId && historyData && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <History size={14} className="text-violet-600" />
              History — <span className="font-mono text-violet-700">{historyData.variant?.sku ?? 'Unknown'}</span>
            </h3>
            <button
              onClick={() => setHistoryId(null)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {(!historyData.history || historyData.history.length === 0) ? (
            <p className="text-gray-400 text-sm text-center py-4">No adjustment history yet.</p>
          ) : (
            <div className="space-y-1">
              {historyData.history.map(h => (
                <div
                  key={h.id}
                  className="flex items-center justify-between text-sm py-2.5 border-b border-gray-50 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className={clsx('font-bold font-mono text-sm w-10 tabular-nums',
                      h.qty_change > 0 ? 'text-green-600' : 'text-red-600')}>
                      {h.qty_change > 0 ? `+${h.qty_change}` : h.qty_change}
                    </span>
                    <span className="text-gray-600 capitalize text-xs sm:text-sm">
                      {h.reason.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-gray-700 font-medium text-xs sm:text-sm tabular-nums">
                      {h.qty_before} → {h.qty_after}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {new Date(h.created_at).toLocaleString('en-GB', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 pt-1">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 sm:px-4 py-2 text-xs sm:text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            Previous
          </button>
          <span className="text-xs sm:text-sm font-medium text-gray-500 tabular-nums">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 sm:px-4 py-2 text-xs sm:text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}