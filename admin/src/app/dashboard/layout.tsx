'use client';
 
import Link from 'next/link';
import Logo from '@/components/layout/ui/Logo';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard, Users, Store, Package, ShoppingBag,
  FolderTree, CreditCard, BarChart2, FileText, Zap,
  Menu, X, LogOut, Star, ShoppingCart, Tag,
  Wallet, RotateCcw,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import clsx from 'clsx';

const NAV = [
  { href: '/dashboard',             label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/dashboard/users',       label: 'Users',       icon: Users           },
  { href: '/dashboard/sellers',     label: 'Sellers',     icon: Store           },
  { href: '/dashboard/products',    label: 'Products',    icon: Package         },
  { href: '/dashboard/orders',      label: 'Orders',      icon: ShoppingBag     },
  { href: '/dashboard/returns',     label: 'Returns',     icon: RotateCcw       },
  { href: '/dashboard/categories',  label: 'Categories',  icon: FolderTree      },
  { href: '/dashboard/brands',      label: 'Brands',      icon: ShoppingCart    },
  { href: '/dashboard/payments',    label: 'Payments',    icon: CreditCard      },
  { href: '/dashboard/withdrawals', label: 'Withdrawals', icon: Wallet          },
  { href: '/dashboard/reports',     label: 'Reports',     icon: BarChart2       },
  { href: '/dashboard/cms',         label: 'CMS',         icon: FileText        },
  { href: '/dashboard/attributes',  label: 'Attributes',  icon: Tag             },
  { href: '/dashboard/flash-sales', label: 'Flash sales', icon: Zap             },
  { href: '/dashboard/reviews',     label: 'Reviews',     icon: Star            },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const qc        = useQueryClient();
  const { user, isLoading, clearAuth } = useAuthStore();
  const [open, setOpen] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'admin')) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  const handleLogout = () => {
    clearAuth();
    qc.clear();
    router.replace('/login');
  };

  // While checking auth
  if (isLoading || !user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-6 h-6 rounded-full border-2 border-gray-200 border-t-violet-600 animate-spin" />
      </div>
    );
  }

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* ── Sidebar ── */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-50 w-60 bg-gray-900 text-gray-300 flex flex-col transition-transform duration-200',
        'lg:static lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>

        {/* Logo + badge */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <Logo size="sm" variant="dark" href="#" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-600 text-white uppercase tracking-wider">
              Admin
            </span>
            <button
              onClick={() => setOpen(false)}
              className="lg:hidden text-gray-400 hover:text-white p-1 rounded transition-colors"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive(item.href)
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
            >
              <item.icon size={16} className="shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-gray-800 shrink-0">
          <div className="px-3 py-2 mb-1 text-xs text-gray-500 truncate">{user.email}</div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-gray-800 rounded-lg w-full transition-colors"
          >
            <LogOut size={14} />Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shrink-0">
          <button onClick={() => setOpen(true)} className="text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors">
            <Menu size={20} />
          </button>
          <Logo size="sm" variant="light" href="#" />
          <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-600 text-white uppercase tracking-wider">
            Admin
          </span>
        </div>

        <main className="flex-1 overflow-auto p-4 sm:p-6">
          {children}
        </main>
      </div>

      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}