'use client';
// src/components/layout/Sidebar.tsx
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Store, Package, ShoppingBag,
  FolderTree, CreditCard, BarChart2, FileText, Zap,
  Star, ShoppingCart, Tag, RotateCcw, Wallet,
  ChevronRight, X,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import clsx from 'clsx';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard',             label: 'Dashboard',     icon: LayoutDashboard },
    ],
  },
  {
    label: 'People',
    items: [
      { href: '/dashboard/users',       label: 'Users',         icon: Users       },
      { href: '/dashboard/sellers',     label: 'Sellers',       icon: Store       },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { href: '/dashboard/products',    label: 'Products',      icon: Package     },
      { href: '/dashboard/categories',  label: 'Categories',    icon: FolderTree  },
      { href: '/dashboard/brands',      label: 'Brands',        icon: ShoppingCart},
      { href: '/dashboard/attributes',  label: 'Attributes',    icon: Tag         },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { href: '/dashboard/orders',      label: 'Orders',        icon: ShoppingBag },
      { href: '/dashboard/returns',     label: 'Returns',       icon: RotateCcw   },
      { href: '/dashboard/reviews',     label: 'Reviews',       icon: Star        },
      { href: '/dashboard/flash-sales', label: 'Flash sales',   icon: Zap         },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/dashboard/payments',    label: 'Payments',      icon: CreditCard  },
      { href: '/dashboard/withdrawals', label: 'Withdrawals',   icon: Wallet      },
      { href: '/dashboard/reports',     label: 'Reports',       icon: BarChart2   },
    ],
  },
  {
    label: 'Content',
    items: [
      { href: '/dashboard/cms',         label: 'CMS',           icon: FileText    },
    ],
  },
];

interface SidebarProps {
  open:    boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuthStore();

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside className={clsx(
        'fixed inset-y-0 left-0 z-50 w-60 flex flex-col',
        'bg-gray-950 border-r border-gray-800/60',
        'transition-transform duration-200 ease-in-out',
        'lg:static lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>

        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <LayoutDashboard size={15} className="text-white" />
            </div>
            <div>
              <p className="text-white font-black text-sm tracking-tight">AddisMarket</p>
              <p className="text-indigo-400 text-[10px] font-bold uppercase tracking-widest">Admin</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-gray-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-600 px-2 mb-1.5">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const active = pathname === item.href ||
                    (item.href !== '/dashboard' && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={clsx(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
                        active
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                          : 'text-gray-400 hover:bg-gray-800/60 hover:text-white'
                      )}
                    >
                      <item.icon size={15} className={clsx(
                        'shrink-0 transition-transform group-hover:scale-110',
                        active ? 'text-white' : 'text-gray-500 group-hover:text-white'
                      )} />
                      <span className="flex-1">{item.label}</span>
                      {active && <ChevronRight size={12} className="opacity-60" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-3 py-3 border-t border-gray-800/60">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="w-7 h-7 rounded-full bg-indigo-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {user?.first_name?.[0]?.toUpperCase() ?? 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}