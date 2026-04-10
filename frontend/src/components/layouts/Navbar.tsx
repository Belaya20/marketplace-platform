'use client';
// src/components/layouts/Navbar.tsx
import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  ShoppingCart, Search, Bell, User, Menu, X,
  ChevronDown, Package, LogOut, Store,
  Check, Trash2, ExternalLink, Star,
  AlertCircle, CreditCard, RefreshCw, ArrowRight,
  CheckCircle2, Info, Tag, CheckCheck,
  Home, Heart, RotateCcw, Settings, FolderTree,
} from 'lucide-react';
import { useAuth, useCart, useSearch, useNotifications } from '@/hooks';
import { useUiStore } from '@/store';
import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '@/lib/api';
import type { Category, Notification } from '@/types';
import clsx from 'clsx';
import Logo from '@/components/ui/Logo';
import Image from 'next/image';

// ── Keyframes injected once ───────────────────────────────────────────────────
const DROPDOWN_STYLES = `
  @keyframes fadeDown {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes slideInRight {
    from { transform: translateX(100%); }
    to   { transform: translateX(0);    }
  }
`;

// ── Notification type config ──────────────────────────────────────────────────
function getNotifConfig(type: string) {
  const map: Record<string, { icon: any; color: string; bg: string; label: string }> = {
    order_update:     { icon: Package,      color: 'text-blue-600',    bg: 'bg-blue-100',    label: 'Order'   },
    payment:          { icon: CreditCard,   color: 'text-emerald-600', bg: 'bg-emerald-100', label: 'Payment' },
    product_approved: { icon: CheckCircle2, color: 'text-green-600',   bg: 'bg-green-100',   label: 'Product' },
    product_rejected: { icon: AlertCircle,  color: 'text-red-500',     bg: 'bg-red-100',     label: 'Product' },
    low_stock:        { icon: AlertCircle,  color: 'text-amber-600',   bg: 'bg-amber-100',   label: 'Stock'   },
    return_update:    { icon: RefreshCw,    color: 'text-orange-600',  bg: 'bg-orange-100',  label: 'Return'  },
    promotion:        { icon: Tag,          color: 'text-violet-600',  bg: 'bg-violet-100',  label: 'Promo'   },
    seller_approval:  { icon: Store,        color: 'text-violet-600',  bg: 'bg-violet-100',  label: 'Seller'  },
    system:           { icon: Info,         color: 'text-gray-500',    bg: 'bg-gray-100',    label: 'System'  },
  };
  return map[type] ?? { icon: Bell, color: 'text-gray-500', bg: 'bg-gray-100', label: 'Info' };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7)  return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ── Notification row ──────────────────────────────────────────────────────────
function NotifRow({ n, onMarkRead, onDelete, onNavigate }: {
  n: Notification;
  onMarkRead: (id: string) => void;
  onDelete:   (id: string) => void;
  onNavigate: () => void;
}) {
  const cfg  = getNotifConfig(n.type);
  const Icon = cfg.icon;

  const handleClick = () => {
    if (!n.is_read) onMarkRead(n.id);
    if (n.action_url) onNavigate();
  };

  return (
    <div className={clsx('transition-colors', !n.is_read ? 'bg-violet-50' : 'bg-white')}>
      <div
        className="group relative flex items-start gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50/80 transition-colors"
        onClick={handleClick}
      >
        {!n.is_read && (
          <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-violet-600 shrink-0" />
        )}

        <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5', cfg.bg)}>
          <Icon size={15} className={cfg.color} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-widest shrink-0', cfg.bg, cfg.color)}>
              {cfg.label}
            </span>
            <span className="text-[10px] text-gray-400 ml-auto shrink-0">{timeAgo(n.created_at)}</span>
          </div>
          <p className={clsx('text-[13px] leading-snug line-clamp-1',
            !n.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700')}>
            {n.title}
          </p>
          <p className="text-[12px] text-gray-400 line-clamp-1 mt-0.5 leading-relaxed">{n.body}</p>
        </div>

        <div className="flex flex-col items-center gap-1 shrink-0 pl-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-150">
          {!n.is_read && (
            <button
              onClick={e => { e.stopPropagation(); onMarkRead(n.id); }}
              title="Mark as read"
              className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
            >
              <Check size={13} />
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); onDelete(n.id); }}
            title="Delete"
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={13} />
          </button>
          {n.action_url && (
            <ExternalLink size={10} className="text-gray-300 mt-0.5" />
          )}
        </div>
      </div>
      <div className="h-px bg-gray-100 mx-4" />
    </div>
  );
}

// ── Notification dropdown ─────────────────────────────────────────────────────
function NotificationDropdown({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { notifications, unreadCount, markRead, markAllRead, deleteOne } = useNotifications();
  const recent = (notifications as Notification[]).slice(0, 8);

  const navigate = useCallback((url: string) => {
    onClose();
    router.push(url);
  }, [onClose, router]);

  const unread = recent.filter(n => !n.is_read);
  const read   = recent.filter(n => n.is_read);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div
        className={clsx(
          // Mobile: fixed below navbar
          'fixed left-4 right-4 top-[72px] z-50 rounded-2xl',
          // sm+: absolute, aligns to the right edge of the entire Actions Wrapper (Parallel to Profile)
          'sm:absolute sm:left-auto sm:right-0 sm:top-[calc(100%+8px)]',
          'sm:w-[360px]',
          // Visual
          'bg-white border border-gray-200 shadow-2xl shadow-black/10 overflow-hidden',
        )}
        style={{ animation: 'fadeDown 0.18s ease both' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/80">
          <div className="flex items-center gap-2">
            <Bell size={14} className="text-gray-500" />
            <span className="text-sm font-bold text-gray-900">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-violet-600 text-white leading-tight">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button onClick={() => markAllRead()}
                className="flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:text-violet-800 px-2 py-1 rounded-lg hover:bg-violet-50 transition-colors"
                title="Mark all as read">
                <CheckCheck size={12} />All read
              </button>
            )}
            <button onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: 'min(420px, 60vh)' }}>
          {recent.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Bell size={24} className="text-gray-300" />
              </div>
              <p className="text-sm font-semibold text-gray-500">All caught up!</p>
              <p className="text-xs text-gray-400 mt-1">No new notifications</p>
            </div>
          ) : (
            <>
              {unread.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 pt-3 pb-1">
                    Unread
                  </p>
                  {unread.map(n => (
                    <NotifRow key={n.id} n={n} onMarkRead={markRead} onDelete={deleteOne}
                      onNavigate={() => n.action_url && navigate(n.action_url)} />
                  ))}
                </div>
              )}
              {read.length > 0 && (
                <div>
                  {unread.length > 0 && (
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 pt-3 pb-1">
                      Earlier
                    </p>
                  )}
                  {read.map(n => (
                    <NotifRow key={n.id} n={n} onMarkRead={markRead} onDelete={deleteOne}
                      onNavigate={() => n.action_url && navigate(n.action_url)} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {(notifications as Notification[]).length > 0 && (
          <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-2.5">
            <Link href="/account/notifications" onClick={onClose}
              className="flex items-center justify-center gap-1.5 text-sm font-semibold text-violet-600 hover:text-violet-800 transition-colors py-0.5">
              View all {(notifications as Notification[]).length} notifications
              <ArrowRight size={13} />
            </Link>
          </div>
        )}
      </div>
    </>
  );
}

// ── Mobile slide-out panel ────────────────────────────────────────────────────
function MobilePanel({ open, onClose, user, categories, unreadCount, logout }: {
  open:        boolean;
  onClose:     () => void;
  user:        any;
  categories:  Category[];
  unreadCount: number;
  logout:      () => void;
}) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else      document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 sm:hidden" onClick={onClose} />
      <div
        className="fixed top-0 right-0 bottom-0 w-72 max-w-[85vw] bg-white z-50 flex flex-col shadow-2xl sm:hidden"
        style={{ animation: 'slideInRight 0.22s ease both' }}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <Logo size="sm" variant="light" href="/" />
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {user ? (
            <div className="px-4 py-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold shrink-0">
                  {(user.first_name?.[0] || user.email?.[0] || 'U').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {user.first_name ? `${user.first_name} ${user.last_name ?? ''}`.trim() : 'Account'}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-4 py-4 border-b border-gray-100 flex gap-2">
              <Link href="/login" onClick={onClose}
                className="flex-1 text-center py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                Sign in
              </Link>
              <Link href="/register/customer" onClick={onClose}
                className="flex-1 text-center py-2.5 bg-violet-600 rounded-xl text-sm font-semibold text-white hover:bg-violet-700 transition-colors">
                Sign up
              </Link>
            </div>
          )}

          {user && (
            <div className="py-2 border-b border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 pt-2 pb-1">Account</p>
              {[
                { href: '/account/orders',        icon: Package,    label: 'My orders'     },
                { href: '/account/notifications', icon: Bell,       label: 'Notifications', badge: unreadCount },
                { href: '/account/wishlist',      icon: Heart,      label: 'Wishlist'      },
                { href: '/account/returns',       icon: RotateCcw,  label: 'Returns'       },
                { href: '/account/profile',       icon: Settings,   label: 'Profile'       },
              ].map(item => (
                <Link key={item.href} href={item.href} onClick={onClose}
                  className="flex items-center justify-between px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <span className="flex items-center gap-3">
                    <item.icon size={16} className="text-gray-400" />
                    {item.label}
                  </span>
                  {item.badge ? <span className="text-xs font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{item.badge}</span> : null}
                </Link>
              ))}
              {user.role === 'seller' && (
                <Link href="/seller/dashboard" onClick={onClose}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <Store size={16} className="text-gray-400" />Seller dashboard
                </Link>
              )}
            </div>
          )}

          <div className="py-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 pt-2 pb-1">Shop by category</p>
            <Link href="/" onClick={onClose}
              className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              <Home size={16} className="text-gray-400" />All products
            </Link>
            {categories.slice(0, 12).map(cat => (
              <Link key={cat.id} href={`/category/${cat.slug}`} onClick={onClose}
                className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                <FolderTree size={16} className="text-gray-400" />{cat.name}
              </Link>
            ))}
          </div>

          <div className="py-2 border-t border-gray-100">
            {[
              { href: '/search?flash=1', icon: Tag,  label: 'Flash sales', color: 'text-red-500' },
              { href: '/search?sort=popular', icon: Star, label: 'Popular products', color: 'text-amber-500' },
            ].map(item => (
              <Link key={item.href} href={item.href} onClick={onClose}
                className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                <item.icon size={16} className={item.color} />{item.label}
              </Link>
            ))}
          </div>
        </div>

        {user && (
          <div className="p-4 border-t border-gray-100">
            <button onClick={() => { logout(); onClose(); }}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium">
              <LogOut size={15} />Sign out
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ── Main Navbar ───────────────────────────────────────────────────────────────
export default function Navbar() {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, logout }                 = useAuth();
  const { itemCount, openCart }          = useCart();
  const { unreadCount }                  = useNotifications();
  const { openMobileNav, closeMobileNav, mobileNavOpen } = useUiStore();
  const { query, setQuery, suggestions } = useSearch();

  const [showSug,      setShowSug]      = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen,    setNotifOpen]    = useState(false);

  const searchRef  = useRef<HTMLDivElement>(null);
  const notifRef   = useRef<HTMLDivElement>(null);
  const userRef    = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'], queryFn: catalogApi.getCategories, staleTime: 600_000,
  });

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))       setShowSug(false);
      if (notifRef.current  && !notifRef.current.contains(e.target as Node))        setNotifOpen(false);
      if (userRef.current   && !userRef.current.contains(e.target as Node))         setUserMenuOpen(false);
      if (mobileSearchRef.current && !mobileSearchRef.current.contains(e.target as Node)) setShowSug(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setNotifOpen(false); setUserMenuOpen(false); setShowSug(false); }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  useEffect(() => { closeMobileNav(); setNotifOpen(false); setUserMenuOpen(false); }, [pathname]);

  const doSearch = (q = query) => {
    if (!q.trim()) return;
    router.push(`/search?q=${encodeURIComponent(q.trim())}`);
    setShowSug(false);
    closeMobileNav();
  };

  const avatarInitial = (user?.first_name?.[0] || user?.email?.[0] || 'U').toUpperCase();
  const avatarUrl     = (user as any)?.profile_image_url as string | null | undefined;

  return (
    <>
      <style>{DROPDOWN_STYLES}</style>

      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="container-page">
          <div className="flex items-center gap-3 h-16">

            <Logo variant="light" size="md" href="/" />

            <div ref={searchRef} className="flex-1 max-w-xl relative hidden sm:block">
              <div className="flex">
                <input
                  className="input rounded-r-none border-r-0 flex-1"
                  placeholder="Search products, brands, SKUs..."
                  value={query}
                  onChange={e => { setQuery(e.target.value); setShowSug(true); }}
                  onKeyDown={e => e.key === 'Enter' && doSearch()}
                  onFocus={() => suggestions.length > 0 && setShowSug(true)}
                />
                <button className="btn-primary rounded-l-none px-4 py-2" onClick={() => doSearch()}>
                  <Search size={16} />
                </button>
              </div>
              {showSug && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-b-xl shadow-lg z-50 mt-0.5 overflow-hidden">
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => { setQuery(s); doSearch(s); }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700 transition-colors">
                      <Search size={12} className="text-gray-400 shrink-0" />{s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right actions */}
            {/* Added relative here so the dropdown perfectly aligns with the right edge (profile block) */}
            <div className="flex items-center gap-0.5 sm:gap-1 ml-auto relative">

              {/* Bell */}
              {user && (
                <div ref={notifRef}> {/* Removed relative class here */}
                  <button
                    onClick={() => { setNotifOpen(o => !o); setUserMenuOpen(false); }}
                    className={clsx(
                      'relative p-2.5 rounded-xl transition-colors',
                      notifOpen ? 'bg-violet-100 text-violet-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                    )}
                    aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                  >
                    <Bell size={20} />
                    {unreadCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                  {notifOpen && <NotificationDropdown onClose={() => setNotifOpen(false)} />}
                </div>
              )}

              {/* Cart */}
              <button onClick={openCart}
                className="relative p-2.5 text-gray-500 hover:text-gray-900 rounded-xl hover:bg-gray-100 transition-colors">
                <ShoppingCart size={20} />
                {itemCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 bg-violet-600 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none">
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                )}
              </button>

              {/* User menu (desktop only) */}
              {user ? (
                <div ref={userRef} className="relative hidden sm:block">
                  <button
                    onClick={() => { setUserMenuOpen(o => !o); setNotifOpen(false); }}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-gray-100 text-sm font-medium text-gray-700 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-violet-100 flex items-center justify-center text-violet-700 text-xs font-bold shrink-0">
                      {avatarUrl
                        ? <Image src={avatarUrl} alt={user.first_name || 'Profile'} width={28} height={28}
                            className="w-full h-full object-cover" unoptimized={avatarUrl.startsWith('data:')} />
                        : avatarInitial
                      }
                    </div>
                    <span className="hidden md:block max-w-[100px] truncate">{user.first_name || 'Account'}</span>
                    <ChevronDown size={14} className={clsx('transition-transform duration-200', userMenuOpen && 'rotate-180')} />
                  </button>

                  {userMenuOpen && (
                    <div
                      className="absolute right-0 top-[calc(100%+4px)] w-52 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1.5 overflow-hidden"
                      style={{ animation: 'fadeDown 0.15s ease both' }}
                      onClick={() => setUserMenuOpen(false)}
                    >
                      {user.role === 'seller' && (
                        <Link href="/seller/dashboard"
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                          <Store size={15} />Seller dashboard
                        </Link>
                      )}
                      <Link href="/account/orders"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        <Package size={15} />My orders
                      </Link>
                      <Link href="/account/notifications"
                        className="flex items-center justify-between gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        <span className="flex items-center gap-2.5"><Bell size={15} />Notifications</span>
                        {unreadCount > 0 && (
                          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                            {unreadCount}
                          </span>
                        )}
                      </Link>
                      <Link href="/account/profile"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        <User size={15} />Profile
                      </Link>
                      <hr className="my-1 border-gray-100" />
                      <button onClick={logout}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 w-full text-left transition-colors">
                        <LogOut size={15} />Sign out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="hidden sm:flex items-center gap-2">
                  <Link href="/login"             className="btn-secondary py-1.5 px-3 text-sm">Sign in</Link>
                  <Link href="/register/customer" className="btn-primary  py-1.5 px-3 text-sm">Sign up</Link>
                </div>
              )}

              {/* Hamburger — mobile only */}
              <button
                onClick={mobileNavOpen ? closeMobileNav : openMobileNav}
                className="sm:hidden p-2.5 text-gray-600 hover:text-gray-900 rounded-xl hover:bg-gray-100 transition-colors"
                aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
              >
                {mobileNavOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>

          {/* Desktop category nav */}
          <nav className="hidden sm:flex items-center gap-0 border-t border-gray-100 overflow-x-auto scrollbar-none">
            <Link href="/"
              className="shrink-0 px-3 py-2.5 text-sm text-gray-600 hover:text-violet-600 hover:bg-violet-50 transition-colors whitespace-nowrap">
              All
            </Link>
            {(categories as Category[]).slice(0, 10).map(cat => (
              <Link key={cat.id} href={`/category/${cat.slug}`}
                className="shrink-0 px-3 py-2.5 text-sm text-gray-600 hover:text-violet-600 hover:bg-violet-50 transition-colors whitespace-nowrap">
                {cat.name}
              </Link>
            ))}
          </nav>
        </div>

        {/* Mobile search bar */}
        <div ref={mobileSearchRef} className="sm:hidden px-4 pb-3 border-t border-gray-100 pt-3 relative">
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Search products..."
              value={query}
              onChange={e => { setQuery(e.target.value); setShowSug(true); }}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              onFocus={() => suggestions.length > 0 && setShowSug(true)}
            />
            <button className="btn-primary px-3 shrink-0" onClick={() => doSearch()}>
              <Search size={16} />
            </button>
          </div>
          {showSug && suggestions.length > 0 && (
            <div className="absolute top-full left-4 right-4 bg-white border border-gray-200 rounded-b-xl shadow-lg z-50 mt-0 overflow-hidden">
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => { setQuery(s); doSearch(s); }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700 transition-colors">
                  <Search size={12} className="text-gray-400 shrink-0" />{s}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <MobilePanel
        open={mobileNavOpen}
        onClose={closeMobileNav}
        user={user}
        categories={categories as Category[]}
        unreadCount={unreadCount}
        logout={logout}
      />
    </>
  );
}