'use client';
// src/app/dashboard/page.tsx
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, reportsApi } from '@/lib/api';
import {
  Users, Store, Package, ShoppingBag, TrendingUp,
  Clock, AlertCircle, ArrowUpRight, Star, BarChart2,
  Wallet,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Cell,
} from 'recharts';
import clsx from 'clsx';

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatETB(v: number) {
  return new Intl.NumberFormat('en-ET', {
    style: 'currency', currency: 'ETB',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(v);
}

function fmtTick(value: string, period: string): string {
  try {
    if (period === 'yearly') return String(value);
    if (period === 'monthly') {
      const d = new Date(value + '-01');
      if (isNaN(d.getTime())) return value;
      return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    }
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch { return value; }
}

function ChartTooltip({ active, payload, label, period }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xl px-3 py-2.5 text-xs min-w-[140px]">
      <p className="font-semibold text-gray-500 mb-1.5">{fmtTick(label, period)}</p>
      <p className="font-bold text-gray-900">{formatETB(payload[0]?.value ?? 0)}</p>
      {payload[0]?.payload?.order_count && (
        <p className="text-gray-400 mt-0.5">{Number(payload[0].payload.order_count)} orders</p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [period, setPeriod] = useState<'daily' | 'monthly' | 'yearly'>('monthly');

  const { data: dashboard } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn:  dashboardApi.get,
    staleTime: 60_000,
    select:    (r: any) => r.data.data,
  });

  const { data: salesRaw = [], isLoading: chartLoading } = useQuery({
    queryKey: ['admin-sales-report', period],
    queryFn:  () => reportsApi.sales({
      date_from: new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0],
      date_to:   new Date().toISOString().split('T')[0],
      period,
    }),
    staleTime: 120_000,
    select:    (r: any) => r.data.data ?? [],
  });

  // Coerce PostgreSQL strings to numbers
  const chartData = (salesRaw as any[]).map(r => ({
    period:      r.period,
    revenue:     Number(r.revenue      ?? 0),
    order_count: Number(r.order_count  ?? 0),
  }));

  const totalRevenue = chartData.reduce((s, r) => s + r.revenue,     0);
  const totalOrders  = chartData.reduce((s, r) => s + r.order_count, 0);

  const d = dashboard as any;

  const kpis = [
    { label: 'Total users',        value: d?.stats?.total_users        ?? 0,              icon: Users,      color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-400',   href: '/dashboard/users'       },
    { label: 'Active sellers',     value: d?.stats?.total_sellers      ?? 0,              icon: Store,      color: 'text-teal-600',   bg: 'bg-teal-50',   border: 'border-teal-400',   href: '/dashboard/sellers'     },
    { label: 'Active products',    value: d?.stats?.total_products     ?? 0,              icon: Package,    color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-400', href: '/dashboard/products'    },
    { label: 'Total orders',       value: d?.stats?.total_orders       ?? 0,              icon: ShoppingBag,color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-400',  href: '/dashboard/orders'      },
    { label: 'Total revenue',      value: formatETB(d?.stats?.total_revenue      ?? 0),   icon: TrendingUp, color: 'text-emerald-600',bg: 'bg-emerald-50',border: 'border-emerald-400',href: '/dashboard/reports'     },
    { label: 'Pending sellers',    value: d?.stats?.pending_sellers    ?? 0,              icon: Clock,      color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-400',    href: '/dashboard/sellers'     },
    { label: 'Pending products',   value: d?.stats?.pending_products   ?? 0,              icon: AlertCircle,color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-400', href: '/dashboard/products'    },
    { label: 'Pending withdrawals',value: d?.stats?.pending_withdrawals ?? 0,             icon: Wallet,     color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-400', href: '/dashboard/withdrawals' },
  ];

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-xl font-bold text-gray-900">Platform overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">Live snapshot of your marketplace.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {kpis.map(s => (
          <Link key={s.label} href={s.href}
            className={clsx('card p-4 border-l-4 hover:shadow-md transition-all group', s.border)}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500 font-medium">{s.label}</p>
              <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110', s.bg)}>
                <s.icon size={15} className={s.color} />
              </div>
            </div>
            <p className="text-xl font-bold text-gray-900">{s.value}</p>
          </Link>
        ))}
      </div>

      {/* Revenue chart */}
      <div className="card p-5">
        <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
          <div>
            <h2 className="font-bold text-gray-900">Revenue analytics</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {period === 'daily' ? 'Last 90 days' : period === 'monthly' ? 'Last 90 days by month' : 'All time by year'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              {(['daily', 'monthly', 'yearly'] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={clsx('px-3 py-1.5 text-xs rounded-lg font-semibold capitalize transition-all',
                    period === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                  {p}
                </button>
              ))}
            </div>
            <Link href="/dashboard/reports" className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
              Full report <ArrowUpRight size={11} />
            </Link>
          </div>
        </div>

        {chartData.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
              <p className="text-xs text-emerald-600 font-medium mb-0.5">Period revenue</p>
              <p className="text-lg font-black text-emerald-700">{formatETB(totalRevenue)}</p>
            </div>
            <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
              <p className="text-xs text-indigo-600 font-medium mb-0.5">Period orders</p>
              <p className="text-lg font-black text-indigo-700">{totalOrders.toLocaleString()}</p>
            </div>
          </div>
        )}

        {chartLoading ? (
          <div className="h-52 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-gray-200 border-t-indigo-600 animate-spin" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-52 flex flex-col items-center justify-center text-gray-400">
            <BarChart2 size={36} strokeWidth={1.5} className="mb-2 text-gray-200" />
            <p className="text-sm font-medium">No data for selected period</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                tickFormatter={v => fmtTick(v, period)} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={52}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
              <Tooltip content={<ChartTooltip period={period} />} cursor={{ fill: 'rgba(79,70,229,0.05)' }} />
              <Bar dataKey="revenue" radius={[6, 6, 0, 0]} maxBarSize={48}>
                {chartData.map((_: any, i: number) => (
                  <Cell key={i} fill={i === chartData.length - 1 ? '#4f46e5' : '#a5b4fc'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent orders */}
        {(d?.recent_orders ?? []).length > 0 && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Recent orders</h2>
              <Link href="/dashboard/orders" className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                View all <ArrowUpRight size={11} />
              </Link>
            </div>
            <div className="space-y-0.5">
              {(d.recent_orders as any[]).map((o: any) => (
                <div key={o.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium font-mono text-gray-900">{o.order_number}</p>
                    <p className="text-xs text-gray-400">{o.first_name} {o.last_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatETB(o.total)}</p>
                    <span className={clsx('badge text-xs', {
                      'bg-yellow-100 text-yellow-800': o.status === 'pending',
                      'bg-blue-100   text-blue-800':   o.status === 'confirmed',
                      'bg-purple-100 text-purple-800': o.status === 'processing',
                      'bg-indigo-100 text-indigo-800': o.status === 'shipped',
                      'bg-green-100  text-green-800':  o.status === 'delivered',
                      'bg-gray-100   text-gray-600':   !['pending','confirmed','processing','shipped','delivered'].includes(o.status),
                    })}>{o.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top products */}
        {(d?.top_products ?? []).length > 0 && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Top products</h2>
              <Link href="/dashboard/products" className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                View all <ArrowUpRight size={11} />
              </Link>
            </div>
            <div className="space-y-3">
              {(d.top_products as any[]).map((p: any, i: number) => (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="text-xs font-black text-gray-300 w-4 shrink-0">{i + 1}</span>
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                    <Package size={14} className="text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-gray-400">{Number(p.total_sold ?? 0)} sold</p>
                      {Number(p.avg_rating) > 0 && (
                        <p className="text-xs text-amber-500 flex items-center gap-0.5">
                          <Star size={10} className="fill-amber-400" />
                          {Number(p.avg_rating).toFixed(1)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}