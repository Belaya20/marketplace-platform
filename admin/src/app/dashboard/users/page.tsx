'use client';
// src/app/dashboard/users/page.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { UserX, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

export default function UsersPage() {
  const [page,   setPage]   = useState(1);
  const [search, setSearch] = useState('');
  const [role,   setRole]   = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, search, role],
    queryFn:  () => adminApi.getUsers({ page, q: search || undefined, role: role || undefined }),
    placeholderData: (prev: any) => prev,
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, suspend }: { id: string; suspend: boolean }) =>
      adminApi.toggleUser(id, suspend),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(vars.suspend ? 'User suspended' : 'User activated');
    },
  });

  const users      = (data?.data ?? []) as any[];
  const totalPages = data?.meta?.total_pages ?? 1;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-gray-900">User management</h1>

      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="input max-w-xs" placeholder="Search by email..." />
        <select value={role} onChange={e => { setRole(e.target.value); setPage(1); }} className="input w-auto">
          <option value="">All roles</option>
          <option value="customer">Customer</option>
          <option value="seller">Seller</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 skeleton rounded-xl" />)}</div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">User</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Role</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u: any) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{u.first_name} {u.last_name}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('badge text-xs capitalize', {
                      'bg-purple-100 text-purple-700': u.role === 'admin',
                      'bg-teal-100 text-teal-700':     u.role === 'seller',
                      'bg-gray-100 text-gray-600':     u.role === 'customer',
                    })}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={clsx('badge text-xs', u.is_suspended ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700')}>
                      {u.is_suspended ? 'Suspended' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.role !== 'admin' && (
                      <button onClick={() => toggleMut.mutate({ id: u.id, suspend: !u.is_suspended })}
                        className={clsx('flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium ml-auto',
                          u.is_suspended ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-red-50 text-red-700 hover:bg-red-100')}>
                        {u.is_suspended ? <><UserCheck size={12} />Activate</> : <><UserX size={12} />Suspend</>}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary px-4 py-2 text-sm disabled:opacity-40">Previous</button>
          <span className="text-sm text-gray-500 px-3 py-2">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary px-4 py-2 text-sm disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}