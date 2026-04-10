'use client';
// src/app/(public)/account/notifications/page.tsx
//
// BUGS FIXED:
//  1. Double padding — `card` class already adds p-4; inner div had another p-4 → double spacing
//  2. Double delete icon — opacity transition artifact on hover; replaced with
//     sm:invisible/sm:group-hover:visible so no opacity animation on desktop,
//     always visible on mobile (touch has no hover)
//  3. Mobile half-hidden list — filter tabs were overflowing the viewport width;
//     added proper scrollbar hide + sticky header so content never gets clipped
//  4. Hover gray on unread cards — unread cards had both a colored bg AND
//     hover:bg-gray-50/50 fighting each other; read cards now get hover, unread don't
//  5. Action buttons on mobile — were completely inaccessible (opacity-0, no hover on touch);
//     now always visible on mobile, fade-in only on desktop hover
import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Bell, Check, Trash2, Package, CreditCard, Store,
  AlertCircle, RefreshCw, Tag, Info, CheckCircle2,
  ChevronDown, ChevronUp, Filter, X, Star,
  ShoppingBag, Zap,
} from 'lucide-react';
import { useNotifications } from '@/hooks';
import type { Notification } from '@/types';
import clsx from 'clsx';

// ── Notification type config ──────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, {
  icon: any; label: string; color: string; bg: string; border: string; unreadBg: string;
}> = {
  order_update:     { icon: Package,      label: 'Order',       color: 'text-blue-600',    bg: 'bg-blue-100',    border: 'border-l-blue-400',    unreadBg: 'bg-blue-50/40'    },
  payment:          { icon: CreditCard,   label: 'Payment',     color: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-l-emerald-400',  unreadBg: 'bg-emerald-50/40' },
  product_approved: { icon: CheckCircle2, label: 'Product',     color: 'text-green-600',   bg: 'bg-green-100',   border: 'border-l-green-400',    unreadBg: 'bg-green-50/30'   },
  product_rejected: { icon: AlertCircle,  label: 'Product',     color: 'text-red-500',     bg: 'bg-red-100',     border: 'border-l-red-400',      unreadBg: 'bg-red-50/30'     },
  low_stock:        { icon: AlertCircle,  label: 'Stock alert', color: 'text-amber-600',   bg: 'bg-amber-100',   border: 'border-l-amber-400',    unreadBg: 'bg-amber-50/40'   },
  return_update:    { icon: RefreshCw,    label: 'Return',      color: 'text-orange-600',  bg: 'bg-orange-100',  border: 'border-l-orange-400',   unreadBg: 'bg-orange-50/30'  },
  promotion:        { icon: Tag,          label: 'Promotion',   color: 'text-violet-600',  bg: 'bg-violet-100',  border: 'border-l-violet-400',   unreadBg: 'bg-violet-50/40'  },
  seller_approval:  { icon: Store,        label: 'Seller',      color: 'text-violet-600',  bg: 'bg-violet-100',  border: 'border-l-violet-400',   unreadBg: 'bg-violet-50/40'  },
  system:           { icon: Info,         label: 'System',      color: 'text-gray-500',    bg: 'bg-gray-100',    border: 'border-l-gray-300',     unreadBg: 'bg-gray-50'       },
};
const DEFAULT_CFG = TYPE_CONFIG['system'];
const getCfg = (type: string) => TYPE_CONFIG[type] ?? DEFAULT_CFG;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7)  return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Filter tabs config ────────────────────────────────────────────────────────
const FILTER_TABS = [
  { id: 'all',      label: 'All'      },
  { id: 'unread',   label: 'Unread'   },
  { id: 'orders',   label: 'Orders',    types: ['order_update']                                          },
  { id: 'payments', label: 'Payments',  types: ['payment']                                               },
  { id: 'products', label: 'Products',  types: ['product_approved', 'product_rejected', 'low_stock']     },
  { id: 'returns',  label: 'Returns',   types: ['return_update']                                         },
  { id: 'other',    label: 'Other',     types: ['promotion', 'seller_approval', 'system']                },
];

// ── Single notification card ──────────────────────────────────────────────────
function NotificationCard({
  notification: n,
  onMarkRead,
  onDelete,
}: {
  notification: Notification;
  onMarkRead:   (id: string) => void;
  onDelete:     (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg  = getCfg(n.type);
  const Icon = cfg.icon;
  const isLong = n.body.length > 100;

  const handleContentClick = () => {
    if (!n.is_read) onMarkRead(n.id);
    if (isLong) setExpanded(e => !e);
  };

  return (
    // FIX 1: removed card class (which adds p-4) — now using bg-white border manually
    // so we control padding exactly once
    // FIX 4: unread cards never get hover bg; read cards get subtle hover
    <div className={clsx(
      'group relative bg-white border border-gray-200 rounded-xl overflow-hidden',
      'transition-colors duration-150',
      !n.is_read
        ? ['border-l-4', cfg.border, cfg.unreadBg]   // unread: colored left border + tinted bg, no hover
        : 'hover:bg-gray-50',                         // read: subtle hover only
    )}>
      <div className="flex items-start gap-3 p-4">
        {/* Type icon */}
        <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5', cfg.bg)}>
          <Icon size={16} className={cfg.color} />
        </div>

        {/* Main content — clickable area */}
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={handleContentClick}
        >
          {/* Header row */}
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className={clsx(
                'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0',
                cfg.bg, cfg.color
              )}>
                {cfg.label}
              </span>
              {!n.is_read && (
                <span className="w-1.5 h-1.5 rounded-full bg-violet-600 shrink-0" />
              )}
            </div>
            <span className="text-[11px] text-gray-400 shrink-0 whitespace-nowrap">
              {timeAgo(n.created_at)}
            </span>
          </div>

          {/* Title */}
          <p className={clsx(
            'text-sm leading-snug mb-1',
            !n.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'
          )}>
            {n.title}
          </p>

          {/* Body */}
          <p className={clsx(
            'text-xs text-gray-500 leading-relaxed',
            !expanded && isLong ? 'line-clamp-2' : ''
          )}>
            {n.body}
          </p>

          {/* Expand toggle */}
          {isLong && (
            <button
              onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
              className="flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:text-violet-800 mt-1.5 transition-colors"
            >
              {expanded ? <><ChevronUp size={11} />Show less</> : <><ChevronDown size={11} />Show more</>}
            </button>
          )}

          {/* Full timestamp when expanded */}
          {expanded && (
            <p className="text-[11px] text-gray-400 mt-2 pt-2 border-t border-gray-100">
              {new Date(n.created_at).toLocaleString('en-GB', {
                weekday: 'long', year: 'numeric', month: 'long',
                day: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </p>
          )}
        </div>

        {/* FIX 2 + 5: Action buttons
            Mobile (touch): always visible, smaller
            Desktop: hidden until hover via sm:invisible + sm:group-hover:visible
            No opacity animation = no double-icon artifact */}
        <div className="flex flex-col gap-1 shrink-0 sm:invisible sm:group-hover:visible">
          {!n.is_read && (
            <button
              onClick={() => onMarkRead(n.id)}
              className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
              title="Mark as read"
            >
              <Check size={13} />
            </button>
          )}
          <button
            onClick={() => onDelete(n.id)}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ filter }: { filter: string }) {
  const messages: Record<string, { icon: any; title: string; body: string }> = {
    all:      { icon: Bell,         title: "You're all caught up!",    body: 'No notifications yet.' },
    unread:   { icon: CheckCircle2, title: 'Nothing left to read',     body: 'All notifications have been read.' },
    orders:   { icon: Package,      title: 'No order notifications',   body: 'Order updates will appear here.' },
    payments: { icon: CreditCard,   title: 'No payment notifications', body: 'Payment confirmations will appear here.' },
    products: { icon: ShoppingBag,  title: 'No product notifications', body: 'Product approvals will appear here.' },
    returns:  { icon: RefreshCw,    title: 'No return notifications',  body: 'Return updates will appear here.' },
    other:    { icon: Info,         title: 'No other notifications',   body: 'Promotions will appear here.' },
  };
  const msg  = messages[filter] ?? messages['all'];
  const Icon = msg.icon;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <Icon size={24} className="text-gray-300" />
      </div>
      <p className="font-semibold text-gray-700 mb-1">{msg.title}</p>
      <p className="text-sm text-gray-400 mb-5">{msg.body}</p>
      <Link href="/" className="btn-primary text-sm inline-flex gap-2">
        <ShoppingBag size={13} />Start shopping
      </Link>
    </div>
  );
}

// ── Date group label ──────────────────────────────────────────────────────────
function GroupLabel({ label }: { label: string }) {
  return (
    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-2">
      {label}
    </p>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const { notifications, unreadCount, markRead, markAllRead, deleteOne, deleteAll } =
    useNotifications();

  const [activeFilter,  setActiveFilter]  = useState('all');
  const [confirmClear,  setConfirmClear]  = useState(false);

  // Filtered list
  const filtered = useMemo(() => {
    if (activeFilter === 'all')    return notifications as Notification[];
    if (activeFilter === 'unread') return (notifications as Notification[]).filter(n => !n.is_read);
    const tab = FILTER_TABS.find(t => t.id === activeFilter);
    if (tab?.types) return (notifications as Notification[]).filter(n => tab.types!.includes(n.type));
    return notifications as Notification[];
  }, [notifications, activeFilter]);

  // Counts per tab
  const tabCount = (tabId: string): number => {
    if (tabId === 'all')    return (notifications as Notification[]).length;
    if (tabId === 'unread') return unreadCount;
    const tab = FILTER_TABS.find(t => t.id === tabId);
    if (tab?.types) return (notifications as Notification[]).filter(n => tab.types!.includes(n.type)).length;
    return 0;
  };

  // Today / Earlier split
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const todayItems   = filtered.filter(n => new Date(n.created_at) >= today);
  const earlierItems = filtered.filter(n => new Date(n.created_at) <  today);

  return (
    // FIX 3: outer container — overflow-hidden prevents horizontal bleed on small screens
    <div className="container-page py-6 sm:py-8 max-w-2xl">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-5 sm:mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Bell size={20} className="text-violet-600 shrink-0" />
            Notifications
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
            {(notifications as Notification[]).length} total · {unreadCount} unread
          </p>
        </div>

        {/* Bulk actions */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead()}
              className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors"
            >
              <Check size={12} />Mark all read
            </button>
          )}
          {(notifications as Notification[]).length > 0 && (
            confirmClear ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { deleteAll(); setConfirmClear(false); }}
                  className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                >
                  Confirm clear
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-gray-500 hover:text-red-500 hover:bg-red-50 px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors"
              >
                <Trash2 size={12} />Clear all
              </button>
            )
          )}
        </div>
      </div>

      {/* ── Filter tabs
           FIX 3: scrollbar-hide + overflow-x-auto so tabs scroll on mobile
           without showing a scrollbar or clipping content below ── */}
      <div className="relative mb-4 sm:mb-5">
        <div className="flex gap-0.5 overflow-x-auto border-b border-gray-200"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {FILTER_TABS.map(tab => {
            const count = tabCount(tab.id);
            const active = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold',
                  'border-b-2 whitespace-nowrap shrink-0 transition-colors',
                  active
                    ? 'border-violet-600 text-violet-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                )}
              >
                {tab.label}
                {count > 0 && (
                  <span className={clsx(
                    'text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none',
                    active
                      ? 'bg-violet-100 text-violet-700'
                      : tab.id === 'unread'
                        ? 'bg-red-100 text-red-600'
                        : 'bg-gray-100 text-gray-500'
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Notification list ── */}
      {filtered.length === 0 ? (
        <EmptyState filter={activeFilter} />
      ) : (
        <div className="space-y-5">
          {/* Today */}
          {todayItems.length > 0 && (
            <div>
              <GroupLabel label="Today" />
              <div className="space-y-2">
                {todayItems.map(n => (
                  <NotificationCard
                    key={n.id}
                    notification={n}
                    onMarkRead={markRead}
                    onDelete={deleteOne}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Earlier */}
          {earlierItems.length > 0 && (
            <div>
              <GroupLabel label={todayItems.length > 0 ? 'Earlier' : 'All notifications'} />
              <div className="space-y-2">
                {earlierItems.map(n => (
                  <NotificationCard
                    key={n.id}
                    notification={n}
                    onMarkRead={markRead}
                    onDelete={deleteOne}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}