'use client';
// src/app/dashboard/reports/page.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { formatETB } from '@/lib/utils';
import { Download, Loader2, BarChart2, Store } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Cell, LineChart, Line,
} from 'recharts';
import toast from 'react-hot-toast';
import clsx from 'clsx';

function fmtTick(value: string, period: string): string {
  try {
    if (period === 'yearly') return String(value);
    if (period === 'monthly') { const d = new Date(value + '-01'); return isNaN(d.getTime()) ? value : d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }); }
    const d = new Date(value); return isNaN(d.getTime()) ? value : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch { return value; }
}

function RevenueTooltip({ active, payload, label, period }: any) {
  if (!active || !payload?.length) return null;
  const r = payload[0]?.payload ?? {};
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xl px-4 py-3 text-xs min-w-[160px]">
      <p className="font-bold text-gray-600 mb-2">{fmtTick(label, period)}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-6"><span className="text-gray-500">Revenue</span><span className="font-bold text-gray-900">{formatETB(r.revenue ?? 0)}</span></div>
        <div className="flex justify-between gap-6"><span className="text-gray-500">Orders</span><span className="font-bold text-gray-900">{Number(r.order_count ?? 0)}</span></div>
        <div className="flex justify-between gap-6"><span className="text-gray-500">Avg order</span><span className="font-medium text-gray-600">{formatETB(r.avg_order_value ?? 0)}</span></div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [tab,       setTab]      = useState<'sales' | 'sellers'>('sales');
  const [period,    setPeriod]   = useState<'daily' | 'monthly' | 'yearly'>('monthly');
  const [dateFrom,  setDateFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toISOString().split('T')[0]; });
  const [dateTo,    setDateTo]   = useState(() => new Date().toISOString().split('T')[0]);
  const [exporting, setExporting]= useState<'excel' | 'pdf' | null>(null);

  const { data: salesRaw = [], isLoading: salesLoading } = useQuery({
    queryKey: ['admin-sales-report', dateFrom, dateTo, period],
    queryFn:  () => adminApi.getSalesReport({ date_from: dateFrom, date_to: dateTo, period }),
    staleTime: 120_000,
  });

  const salesData = (salesRaw as any[]).map(r => ({
    period: r.period,
    revenue: Number(r.revenue ?? 0),
    order_count: Number(r.order_count ?? 0),
    avg_order_value: Number(r.avg_order_value ?? 0),
  }));

  const totalRevenue = salesData.reduce((s, r) => s + r.revenue, 0);
  const totalOrders  = salesData.reduce((s, r) => s + r.order_count, 0);
  const avgOrderVal  = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const { data: sellerRaw = [], isLoading: sellerLoading } = useQuery({
    queryKey: ['admin-seller-report'],
    queryFn:  adminApi.getSellerReport,
    enabled:  tab === 'sellers',
    staleTime: 120_000,
  });

  const sellerData = (sellerRaw as any[]).map(s => ({
    ...s,
    total_items_sold: Number(s.total_items_sold ?? 0),
    total_revenue:    Number(s.total_revenue    ?? 0),
    total_commission: Number(s.total_commission ?? 0),
    wallet_balance:   Number(s.wallet_balance   ?? 0),
    commission_rate:  Number(s.commission_rate  ?? 0),
  }));

  const handleExport = async (format: 'excel' | 'pdf') => {
    setExporting(format);
    try {
      const res  = await adminApi.exportReport(format, { date_from: dateFrom, date_to: dateTo, period });
      const blob = (res as any).data;
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a'); a.href = url;
      a.download = `sales-report.${format === 'excel' ? 'xlsx' : 'pdf'}`; a.click();
      URL.revokeObjectURL(url);
      toast.success('Report downloaded');
    } catch { toast.error('Export failed'); }
    finally { setExporting(null); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Reports & analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Revenue, orders and seller performance</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleExport('excel')} disabled={!!exporting || salesData.length === 0} className="btn-secondary text-sm py-2 gap-1.5 disabled:opacity-40">
            {exporting === 'excel' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}Excel
          </button>
          <button onClick={() => handleExport('pdf')} disabled={!!exporting || salesData.length === 0} className="btn-secondary text-sm py-2 gap-1.5 disabled:opacity-40">
            {exporting === 'pdf' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}PDF
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {[{ id: 'sales', label: 'Sales report' }, { id: 'sellers', label: 'Seller performance' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={clsx('px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors',
              tab === t.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sales' && (
        <div className="space-y-5">
          <div className="card p-4 flex items-center gap-3 flex-wrap">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              {(['daily', 'monthly', 'yearly'] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={clsx('px-3 py-1.5 text-xs rounded-lg font-semibold capitalize transition-all',
                    period === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                  {p}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <label className="text-xs font-medium text-gray-500">From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input w-auto text-sm py-1.5" />
              <label className="text-xs font-medium text-gray-500">To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input w-auto text-sm py-1.5" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="card p-4 border-l-4 border-emerald-400"><p className="text-xs text-gray-500 font-medium mb-1">Total revenue</p><p className="text-2xl font-black text-emerald-600">{formatETB(totalRevenue)}</p></div>
            <div className="card p-4 border-l-4 border-indigo-400"><p className="text-xs text-gray-500 font-medium mb-1">Total orders</p><p className="text-2xl font-black text-indigo-600">{totalOrders.toLocaleString()}</p></div>
            <div className="card p-4 border-l-4 border-blue-400"><p className="text-xs text-gray-500 font-medium mb-1">Avg order value</p><p className="text-2xl font-black text-blue-600">{formatETB(avgOrderVal)}</p></div>
          </div>

          {salesLoading ? (
            <div className="card p-5 h-64 flex items-center justify-center"><div className="w-6 h-6 rounded-full border-2 border-gray-200 border-t-indigo-600 animate-spin" /></div>
          ) : salesData.length === 0 ? (
            <div className="card p-14 text-center"><BarChart2 size={40} className="text-gray-200 mx-auto mb-3" /><p className="font-medium text-gray-500">No data for selected period</p></div>
          ) : (
            <>
              <div className="card p-5">
                <h3 className="font-bold text-gray-900 mb-4 text-sm">Revenue by {period}</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={salesData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => fmtTick(v, period)} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={56} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                    <Tooltip content={<RevenueTooltip period={period} />} cursor={{ fill: 'rgba(79,70,229,0.05)' }} />
                    <Bar dataKey="revenue" radius={[6,6,0,0]} maxBarSize={48}>
                      {salesData.map((_: any, i: number) => <Cell key={i} fill={i === salesData.length - 1 ? '#4f46e5' : '#a5b4fc'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card p-5">
                <h3 className="font-bold text-gray-900 mb-4 text-sm">Order volume trend</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={salesData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => fmtTick(v, period)} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip formatter={(v: any) => [v, 'Orders']} labelFormatter={(l: string) => fmtTick(l, period)} />
                    <Line type="monotone" dataKey="order_count" stroke="#4f46e5" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="card overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50"><h3 className="font-bold text-gray-900 text-sm">Detailed breakdown</h3></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-100">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Period</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Orders</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Revenue</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Avg order</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {salesData.map((r: any) => (
                        <tr key={r.period} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3 font-mono text-xs text-gray-700">{fmtTick(r.period, period)}</td>
                          <td className="px-5 py-3 text-right text-gray-700">{r.order_count.toLocaleString()}</td>
                          <td className="px-5 py-3 text-right font-semibold text-gray-900">{formatETB(r.revenue)}</td>
                          <td className="px-5 py-3 text-right text-gray-600">{formatETB(r.avg_order_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="border-t border-gray-200 bg-gray-50">
                      <td className="px-5 py-3 font-bold text-gray-900 text-xs uppercase">Total</td>
                      <td className="px-5 py-3 text-right font-bold text-gray-900">{totalOrders.toLocaleString()}</td>
                      <td className="px-5 py-3 text-right font-black text-emerald-600">{formatETB(totalRevenue)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-700">{formatETB(avgOrderVal)}</td>
                    </tr></tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'sellers' && (
        <div className="space-y-5">
          {sellerData.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="card p-4 border-l-4 border-teal-400"><p className="text-xs text-gray-500 font-medium mb-1">Total sellers</p><p className="text-2xl font-black text-teal-600">{sellerData.length}</p></div>
              <div className="card p-4 border-l-4 border-emerald-400"><p className="text-xs text-gray-500 font-medium mb-1">Combined revenue</p><p className="text-2xl font-black text-emerald-600">{formatETB(sellerData.reduce((s: number, r: any) => s + r.total_revenue, 0))}</p></div>
              <div className="card p-4 border-l-4 border-indigo-400"><p className="text-xs text-gray-500 font-medium mb-1">Total commission</p><p className="text-2xl font-black text-indigo-600">{formatETB(sellerData.reduce((s: number, r: any) => s + r.total_commission, 0))}</p></div>
            </div>
          )}
          {sellerLoading ? (
            <div className="card p-14 flex items-center justify-center gap-2 text-gray-400 text-sm"><Loader2 size={16} className="animate-spin" />Loading…</div>
          ) : sellerData.length === 0 ? (
            <div className="card p-14 text-center"><Store size={40} className="text-gray-200 mx-auto mb-3" /><p className="font-medium text-gray-500">No data available</p></div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Seller</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Items sold</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Revenue</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Commission</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rate</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Wallet</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {sellerData.map((s: any, i: number) => (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs font-black text-gray-300 w-5">{i + 1}</span>
                            <div><p className="font-semibold text-gray-900">{s.business_name}</p><p className="text-xs text-gray-400">{s.email}</p></div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right font-medium text-gray-700">{s.total_items_sold.toLocaleString()}</td>
                        <td className="px-5 py-3.5 text-right font-bold text-gray-900">{formatETB(s.total_revenue)}</td>
                        <td className="px-5 py-3.5 text-right font-semibold text-indigo-600">{formatETB(s.total_commission)}</td>
                        <td className="px-5 py-3.5 text-right"><span className="text-xs font-bold px-2 py-1 bg-gray-100 text-gray-700 rounded-lg">{s.commission_rate.toFixed(0)}%</span></td>
                        <td className="px-5 py-3.5 text-right"><span className={clsx('text-xs font-semibold', s.wallet_balance > 0 ? 'text-emerald-600' : 'text-gray-400')}>{formatETB(s.wallet_balance)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}