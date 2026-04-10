'use client';
// src/app/(seller)/seller/dashboard/page.tsx
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { sellerApi } from '@/lib/api';
import { formatETB } from '@/hooks';
import {
  ShoppingBag, Clock, TrendingUp, Wallet,
  AlertTriangle, Package, ArrowUpRight,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer,
} from 'recharts';
import clsx from 'clsx';

// ── Format XAxis tick by period ───────────────────────────────────────────────
// daily   → "2026-03-01"           → "01 Mar"
// weekly  → "2026-03-01T00:00:00Z" → "W12 '26"
// monthly → "2026-03-01T00:00:00Z" → "Mar '26"
function fmtTick(value: string, period: string): string {
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    if (period === 'daily')
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    if (period === 'weekly') {
      const jan1  = new Date(d.getFullYear(), 0, 1);
      const week  = Math.ceil((((d.getTime() - jan1.getTime()) / 86400000) + jan1.getDay() + 1) / 7);
      return `W${week}`;
    }
    if (period === 'monthly')
      return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    return '';
  } catch { return ''; }
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, period, metric }: any) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value ?? 0;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xl px-3 py-2.5 text-xs min-w-[130px]">
      <p className="font-semibold text-gray-500 mb-1.5">{fmtTick(label, period)}</p>
      <p className="font-bold text-gray-900">
        {metric === 'revenue' ? formatETB(val) : val}
      </p>
    </div>
  );
}

// ── Chart component ───────────────────────────────────────────────────────────
const METRICS = [
  { key: 'revenue' as const,    label: 'Revenue',    color: '#7c3aed' },
  { key: 'orders' as const,     label: 'Orders',     color: '#2563eb' },
  { key: 'units_sold' as const, label: 'Units sold', color: '#059669' },
];

function SalesChart({ raw, period }: { raw: any[]; period: string }) {
  const [metric, setMetric] = useState<'revenue' | 'orders' | 'units_sold'>('revenue');

  // ROOT FIX: PostgreSQL SUM/COUNT return strings → coerce to Number
  const data = raw.map(r => ({
    period:     r.period,
    revenue:    Number(r.revenue    ?? 0),
    orders:     Number(r.orders     ?? 0),
    units_sold: Number(r.units_sold ?? 0),
  }));

  const totals = {
    revenue:    data.reduce((s, r) => s + r.revenue,    0),
    orders:     data.reduce((s, r) => s + r.orders,     0),
    units_sold: data.reduce((s, r) => s + r.units_sold, 0),
  };

  const active = METRICS.find(m => m.key === metric)!;

  return (
    <>
      {/* Metric tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {METRICS.map(m => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={clsx(
              'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-all',
              metric === m.key
                ? 'text-white border-transparent shadow-sm'
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
            )}
            style={metric === m.key ? { background: m.color } : {}}
          >
            {m.label}
            <span className={clsx(
              'text-xs font-bold px-1.5 py-0.5 rounded-lg',
              metric === m.key ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-600'
            )}>
              {m.key === 'revenue'
                ? formatETB(totals.revenue)
                : totals[m.key]
              }
            </span>
          </button>
        ))}
      </div>

      {data.length === 0 ? (
        <div className="h-52 flex flex-col items-center justify-center text-gray-400">
          <TrendingUp size={32} strokeWidth={1.5} className="mb-2 text-gray-200" />
          <p className="text-sm font-medium">No sales data for this period</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={active.color} stopOpacity={0.12} />
                <stop offset="95%" stopColor={active.color} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false} tickLine={false}
              tickFormatter={v => fmtTick(v, period)}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false} tickLine={false}
              width={metric === 'revenue' ? 52 : 28}
              tickFormatter={v =>
                metric === 'revenue'
                  ? v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                  : String(v)
              }
            />
            <Tooltip
              content={<ChartTooltip period={period} metric={metric} />}
              cursor={{ stroke: active.color, strokeWidth: 1, strokeDasharray: '4 2' }}
            />
            <Area
              type="monotone"
              dataKey={metric}
              stroke={active.color}
              strokeWidth={2.5}
              fill="url(#grad)"
              dot={false}
              activeDot={{ r: 5, strokeWidth: 0, fill: active.color }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SellerDashboardPage() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const { data: dashboard } = useQuery({
    queryKey: ['seller-dashboard'],
    queryFn:  sellerApi.getDashboard,
    staleTime: 60_000,
  });

  const { data: graphRaw = [], isLoading: graphLoading } = useQuery({
    queryKey: ['seller-graph', period],
    queryFn:  () => sellerApi.getSalesGraph(period),
    staleTime: 120_000,
  });

  const { data: topProducts = [] } = useQuery({
    queryKey: ['seller-top-products'],
    queryFn:  sellerApi.getProductPerformance,
    staleTime: 120_000,
  });

  const d = dashboard as any;


  const stats = [
    { label: 'Total revenue',   value: formatETB(d?.total_sales           ?? 0), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-400' },
    { label: 'Pending orders',  value: String(d?.pending_orders            ?? 0), icon: Clock,      color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-400'  },
    { label: 'Wallet balance',  value: formatETB(d?.profile?.wallet_balance  ?? 0), icon: Wallet,  color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-400' },
    { label: 'Pending balance', value: formatETB(d?.profile?.pending_balance ?? 0), icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-400' },
  ];

  const PERIOD_LABELS = {
    daily:   'Last 30 days',
    weekly:  'Last 12 weeks',
    monthly: 'Last 12 months',
  };

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Welcome back! Here&apos;s your store overview.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className={clsx('card p-4 border-l-4', s.border)}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500 font-medium">{s.label}</p>
              <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', s.bg)}>
                <s.icon size={15} className={s.color} />
              </div>
            </div>
            <p className="text-xl font-bold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Sales chart */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
          <div>
            <h2 className="font-bold text-gray-900">Sales overview</h2>
            <p className="text-xs text-gray-400 mt-0.5">{PERIOD_LABELS[period]}</p>
          </div>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {(['daily', 'weekly', 'monthly'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={clsx(
                  'px-3 py-1.5 text-xs rounded-lg font-semibold capitalize transition-all',
                  period === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                )}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {graphLoading ? (
          <div className="h-52 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-gray-200 border-t-violet-600 animate-spin" />
          </div>
        ) : (
          <SalesChart raw={graphRaw as any[]} period={period} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Top products */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Top products</h2>
            <Link href="/seller/products" className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1">
              View all <ArrowUpRight size={11} />
            </Link>
          </div>
          {(topProducts as any[]).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No products yet</p>
          ) : (
            <div className="space-y-3">
              {(topProducts as any[]).slice(0, 5).map((p: any, i: number) => (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="text-xs font-black text-gray-300 w-4 shrink-0 tabular-nums">{i + 1}</span>
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                    <Package size={14} className="text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">
                      {p.total_sold ?? 0} sold
                      {Number(p.avg_rating) > 0 && ` · ★ ${Number(p.avg_rating).toFixed(1)}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low stock */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-500" />Low stock
            </h2>
            <Link href="/seller/inventory" className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1">
              View all <ArrowUpRight size={11} />
            </Link>
          </div>
          {(d?.low_stock_alerts ?? []).length === 0 ? (
            <div className="text-center py-8">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center mx-auto mb-2">
                <Package size={18} className="text-green-500" />
              </div>
              <p className="text-sm font-medium text-gray-500">All stock levels healthy</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(d.low_stock_alerts as any[]).map((item: any) => (
                <div key={item.sku} className="flex items-center justify-between p-2.5 bg-amber-50 border border-amber-100 rounded-xl">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-500 font-mono">{item.sku}</p>
                  </div>
                  <span className={clsx('text-xs font-bold px-2 py-1 rounded-lg ml-2 shrink-0',
                    item.stock_qty === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
                    {item.stock_qty === 0 ? 'Out of stock' : `${item.stock_qty} left`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent orders */}
      {(d?.recent_orders ?? []).length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Recent orders</h2>
            <Link href="/seller/orders" className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1">
              View all <ArrowUpRight size={11} />
            </Link>
          </div>
          <div className="space-y-0.5">
            {(d.recent_orders as any[]).map((o: any) => (
              <div key={o.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium font-mono text-gray-900">{o.order_number}</p>
                  <p className="text-xs text-gray-400 truncate max-w-[200px]">{o.product_name_snapshot}</p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-sm font-semibold text-gray-900">{formatETB(o.line_total)}</p>
                  <span className={clsx('badge text-xs', {
                    'bg-yellow-100 text-yellow-800': o.status === 'pending',
                    'bg-blue-100   text-blue-800':   o.status === 'accepted',
                    'bg-indigo-100 text-indigo-800': o.status === 'shipped',
                    'bg-green-100  text-green-800':  o.status === 'delivered',
                    'bg-red-100    text-red-800':    o.status === 'rejected',
                    'bg-gray-100   text-gray-600':   !['pending','accepted','shipped','delivered','rejected'].includes(o.status),
                  })}>{o.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}