'use client';
// src/components/layout/TopBar.tsx
import { usePathname, useRouter } from 'next/navigation';
import { Menu, LogOut, ChevronRight, User, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

// ── Breadcrumb from pathname ──────────────────────────────────────────────────
function useBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  return segments.map((seg, i) => ({
    label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '),
    href:  '/' + segments.slice(0, i + 1).join('/'),
    last:  i === segments.length - 1,
  }));
}

interface TopBarProps { onMenuClick: () => void; }

export function TopBar({ onMenuClick }: TopBarProps) {
  const router       = useRouter();
  const qc           = useQueryClient();
  const { user, clearAuth } = useAuthStore();
  const breadcrumbs  = useBreadcrumbs();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* non-fatal */ }
    clearAuth();
    qc.clear();
    toast.success('Signed out');
    router.replace('/login');
  };

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-5 gap-4 sticky top-0 z-30">

      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <Menu size={18} />
      </button>

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm flex-1 min-w-0">
        {breadcrumbs.map((b, i) => (
          <span key={b.href} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight size={12} className="text-gray-400 shrink-0" />}
            <span className={clsx(
              'font-medium truncate',
              b.last ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
            )}>
              {b.label}
            </span>
          </span>
        ))}
      </nav>

      {/* Right side */}
      <div className="flex items-center gap-2 shrink-0 relative">

        {/* Refresh queries */}
        <button
          onClick={() => { qc.invalidateQueries(); toast.success('Data refreshed'); }}
          className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Refresh all data"
        >
          <RefreshCw size={15} />
        </button>

        {/* User menu */}
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {user?.first_name?.[0]?.toUpperCase() ?? 'A'}
          </div>
          <span className="hidden sm:block text-sm font-medium text-gray-700">
            {user?.first_name}
          </span>
        </button>

        {/* Dropdown */}
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-[calc(100%+4px)] w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-20 py-1.5 animate-fade-in">
              <div className="px-4 py-2.5 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-900">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5 truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={14} />Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}