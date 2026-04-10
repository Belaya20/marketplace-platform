'use client';
// src/app/(seller)/layout.tsx
import Link from 'next/link';
import Logo from '@/components/ui/Logo';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Package, ShoppingBag, BarChart2,
  Wallet, Tag, Menu, X, LogOut, Store,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks';
import clsx from 'clsx';
import SellerReturnsPage from './seller/returns/page';

const NAV = [
  { href: '/seller/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/seller/products',   label: 'Products',   icon: Package },
  { href: '/seller/orders',     label: 'Orders',     icon: ShoppingBag },
  { href: '/seller/inventory',  label: 'Inventory',  icon: BarChart2 },
  { href: '/seller/wallet',     label: 'Wallet',     icon: Wallet },
  { href: '/seller/returns',    label: 'Returns',    icon: Tag },
  { href: '/seller/promotions', label: 'Promotions', icon: Tag },
];

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-50 w-60 bg-white border-r border-gray-200 flex flex-col transition-transform duration-200',
        'lg:static lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <Logo size="sm" variant="light" />
          <button onClick={() => setOpen(false)} className="lg:hidden text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-2">Seller panel</p>
        </div>

        <nav className="flex-1 px-3 pb-3 space-y-0.5">
          {NAV.map(item => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                pathname.startsWith(item.href)
                  ? 'bg-violet-50 text-violet-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}>
              <item.icon size={17} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-100">
          <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 text-xs font-bold flex-shrink-0">
              {(user?.first_name?.[0] ?? user?.email?.[0] ?? 'S').toUpperCase()}
            </div>
            <span className="text-sm text-gray-700 truncate">{user?.email}</span>
          </div>
          <button onClick={logout}
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg w-full">
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <button onClick={() => setOpen(true)} className="text-gray-600"><Menu size={20} /></button>
          <span className="font-semibold text-gray-900 text-sm">Seller dashboard</span>
        </div>
        <main className="flex-1 p-6">{children}</main>
      </div>

      {/* Backdrop */}
      {open && <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setOpen(false)} />}
    </div>
  );
}
