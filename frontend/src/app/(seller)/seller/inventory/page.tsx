'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sellerApi, productApi } from '@/lib/api';
import { AlertTriangle, History, Pencil, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

// --- Types ---
interface InventoryItem {
  id: string;
  product_name: string;
  sku: string;
  stock_status: 'out_of_stock' | 'low_stock' | 'in_stock';
  stock_qty: number;
}

interface InventoryResponse {
  data: InventoryItem[];
  meta: {
    total_pages: number;
  };
}

interface StockHistoryItem {
  id: string;
  qty_change: number;
  qty_before: number;
  qty_after: number;
  reason: string;
  created_at: string;
}

interface StockHistoryResponse {
  variant?: {
    sku: string;
  };
  history: StockHistoryItem[];
}

export default function SellerInventoryPage() {
  const [page, setPage] = useState(1);
  const [editId, setEditId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState(0);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const qc = useQueryClient();

  // 1. Fetch Inventory
  const { data, isLoading } = useQuery<InventoryResponse>({
    queryKey: ['seller-inventory', page],
    queryFn: async () => {
      const res = await sellerApi.getInventory(page);
      return res as InventoryResponse;
    },
  });

  // 2. Fetch History
  const { data: historyData } = useQuery<StockHistoryResponse>({
    queryKey: ['stock-history', historyId],
    queryFn: async () => {
      const res = await sellerApi.getStockHistory(historyId!);
      return res as StockHistoryResponse;
    },
    enabled: !!historyId,
  });

  // 3. Update Mutation
  const updateMut = useMutation({
    mutationFn: ({ variantId, qty }: { variantId: string; qty: number }) =>
      productApi.updateStock(variantId, qty),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seller-inventory'] });
      setEditId(null);
      toast.success('Stock updated');
    },
    onError: () => {
      toast.error('Failed to update stock');
    }
  });

  const items = data?.data ?? [];
  const totalPages = data?.meta?.total_pages ?? 1;
  const lowCount = items.filter((i) => i.stock_status === 'low_stock').length;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-gray-900">Inventory management</h1>

      {lowCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-800 font-medium">
            {lowCount} variant{lowCount > 1 ? 's are' : ' is'} running low on stock.
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
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
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">
                    {item.product_name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.sku}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={clsx('px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide', {
                        'bg-red-100 text-red-700': item.stock_status === 'out_of_stock',
                        'bg-amber-100 text-amber-700': item.stock_status === 'low_stock',
                        'bg-green-100 text-green-700': item.stock_status === 'in_stock',
                      })}
                    >
                      {item.stock_status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editId === item.id ? (
                      <div className="flex items-center justify-center gap-2">
                        <input
                          type="number"
                          autoFocus
                          value={editQty}
                          onChange={(e) => setEditQty(Number(e.target.value))}
                          className="w-20 text-center text-sm py-1 border border-violet-300 rounded focus:ring-2 focus:ring-violet-500 outline-none"
                          min={0}
                        />
                        <button
                          onClick={() => updateMut.mutate({ variantId: item.id, qty: editQty })}
                          disabled={updateMut.isPending}
                          className="text-green-600 hover:text-green-800 p-1 disabled:opacity-50"
                        >
                          <Check size={16} />
                        </button>
                      </div>
                    ) : (
                      <span className="font-semibold text-gray-900">{item.stock_qty}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => {
                          setEditId(item.id);
                          setEditQty(item.stock_qty);
                        }}
                        className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded transition-colors"
                        title="Edit stock"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setHistoryId(historyId === item.id ? null : item.id)}
                        className={clsx(
                          'p-1.5 rounded transition-colors',
                          historyId === item.id ? 'text-violet-600 bg-violet-50' : 'text-gray-400 hover:text-violet-600'
                        )}
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
      )}

      {/* Stock history panel */}
      {historyId && historyData && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4 text-sm flex items-center justify-between">
            <span>Stock history — {historyData.variant?.sku ?? 'Unknown SKU'}</span>
            <button onClick={() => setHistoryId(null)} className="text-gray-400 hover:text-gray-600 text-xs">Close</button>
          </h3>
          {(!historyData.history || historyData.history.length === 0) ? (
            <p className="text-gray-400 text-sm italic">No adjustment history yet.</p>
          ) : (
            <div className="space-y-2">
              {historyData.history.map((h) => (
                <div key={h.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={clsx('font-bold w-10', h.qty_change > 0 ? 'text-green-600' : 'text-red-600')}>
                      {h.qty_change > 0 ? `+${h.qty_change}` : h.qty_change}
                    </span>
                    <span className="text-gray-600 capitalize">{h.reason.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-700 font-medium">
                      {h.qty_before} → {h.qty_after}
                    </p>
                    <p className="text-[10px] text-gray-400">{new Date(h.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            Previous
          </button>
          <span className="text-sm font-medium text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}