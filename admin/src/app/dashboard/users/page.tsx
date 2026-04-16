'use client';
// admin/src/app/dashboard/users/page.tsx

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import {
  UserX, UserCheck, Search, Users,
  CheckCircle, XCircle, Clock, Shield,
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminUser {
  id:             string;
  first_name:     string;
  last_name:      string;
  email:          string;
  role:           'admin' | 'seller' | 'customer';
  is_active:      boolean;
  is_suspended:   boolean;
  email_verified: boolean;
  created_at:     string;
  seller_status?: 'pending' | 'approved' | 'rejected' | 'suspended';
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: AdminUser['role'] }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold', {
      'bg-purple-100 text-purple-700': role === 'admin',
      'bg-teal-100   text-teal-700':   role === 'seller',
      'bg-gray-100   text-gray-600':   role === 'customer',
    })}>
      {role === 'admin' && <Shield size={9} />}
      {role}
    </span>
  );
}

function StatusBadge({ user }: { user: AdminUser }) {
  if (user.is_suspended) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700">
        <XCircle size={9} />Suspended
      </span>
    );
  }
  if (user.role === 'seller' && user.seller_status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">
        <Clock size={9} />Pending
      </span>
    );
  }
  if (user.role === 'seller' && user.seller_status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700">
        <XCircle size={9} />Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">
      <CheckCircle size={9} />Active
    </span>
  );
}

function VerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium', {
      'bg-green-50 text-green-600': verified,
      'bg-gray-100 text-gray-400':  !verified,
    })}>
      {verified ? <CheckCircle size={9} /> : <XCircle size={9} />}
      {verified ? 'Verified' : 'Unverified'}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const [page,      setPage]      = useState(1);
  const [search,    setSearch]    = useState('');
  const [role,      setRole]      = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey:        ['admin-users', page, search, role],
    queryFn:         () => adminApi.getUsers({ page, q: search || undefined, role: role || undefined }),
    placeholderData: (prev: any) => prev,
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, suspend }: { id: string; suspend: boolean }) =>
      adminApi.toggleUser(id, suspend),
    onMutate: ({ id }) => setTogglingId(id),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(vars.suspend ? 'User suspended' : 'User activated');
    },
    onError: () => toast.error('Action failed. Please try again.'),
    onSettled: () => setTogglingId(null),
  });

  const users      = (data?.data ?? []) as AdminUser[];
  const totalPages = data?.meta?.total_pages ?? 1;
  const totalUsers = data?.meta?.total ?? 0;

  const handleToggle = (u: AdminUser) => {
    toggleMut.mutate({ id: u.id, suspend: !u.is_suspended });
  };

  return (
    <div className="space-y-4 sm:space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Users</h1>
          {totalUsers > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">{totalUsers.toLocaleString()} total</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg">
          <Users size={13} />
          <span className="hidden sm:inline">User management</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="input pl-8 text-sm w-full"
            placeholder="Search by email or name…"
          />
        </div>
        <select
          value={role}
          onChange={e => { setRole(e.target.value); setPage(1); }}
          className="input w-auto text-sm"
        >
          <option value="">All roles</option>
          <option value="customer">Customer</option>
          <option value="seller">Seller</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 skeleton rounded-xl" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <Users size={32} className="text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No users found</p>
          {(search || role) && (
            <button
              onClick={() => { setSearch(''); setRole(''); setPage(1); }}
              className="text-xs text-violet-600 hover:text-violet-800 mt-2 font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile: Card list (hidden on sm+) */}
          <div className="sm:hidden space-y-2">
            {users.map(u => (
              <div key={u.id} className="card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">
                      {u.first_name} {u.last_name}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <RoleBadge role={u.role} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge user={u} />
                  <VerifiedBadge verified={u.email_verified} />
                </div>

                {u.role !== 'admin' && (
                  <button
                    onClick={() => handleToggle(u)}
                    disabled={togglingId === u.id}
                    className={clsx(
                      'w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      u.is_suspended
                        ? 'bg-green-50 text-green-700 hover:bg-green-100 active:bg-green-200'
                        : 'bg-red-50   text-red-700   hover:bg-red-100   active:bg-red-200',
                    )}
                  >
                    {togglingId === u.id ? (
                      <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : u.is_suspended ? (
                      <><UserCheck size={14} />Activate account</>
                    ) : (
                      <><UserX size={14} />Suspend account</>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Desktop: Table (hidden below sm) */}
          <div className="hidden sm:block card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 whitespace-nowrap">User</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 whitespace-nowrap">Role</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 whitespace-nowrap">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 whitespace-nowrap">Email</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 whitespace-nowrap">Joined</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map(u => (
                    <tr
                      key={u.id}
                      className={clsx('hover:bg-gray-50 transition-colors', {
                        'opacity-60': togglingId === u.id,
                      })}
                    >
                      <td className="px-4 py-3 min-w-[180px]">
                        <p className="font-medium text-gray-900">{u.first_name} {u.last_name}</p>
                        <p className="text-xs text-gray-400 truncate max-w-[200px]">{u.email}</p>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <RoleBadge role={u.role} />
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge user={u} />
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <VerifiedBadge verified={u.email_verified} />
                      </td>

                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {new Date(u.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {u.role !== 'admin' ? (
                          <button
                            onClick={() => handleToggle(u)}
                            disabled={togglingId === u.id}
                            className={clsx(
                              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ml-auto transition-colors',
                              'disabled:opacity-50 disabled:cursor-not-allowed',
                              u.is_suspended
                                ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                : 'bg-red-50   text-red-700   hover:bg-red-100',
                            )}
                          >
                            {togglingId === u.id ? (
                              <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : u.is_suspended ? (
                              <><UserCheck size={12} />Activate</>
                            ) : (
                              <><UserX size={12} />Suspend</>
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary px-3 sm:px-4 py-2 text-xs sm:text-sm disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs sm:text-sm text-gray-500 px-2 sm:px-3 py-2 tabular-nums">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn-secondary px-3 sm:px-4 py-2 text-xs sm:text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}