'use client';
// src/app/dashboard/categories/page.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { catalogApi } from '@/lib/api';
import type { Category } from '@/types';
import { Plus, Trash2, FolderTree } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CategoriesPage() {
  const [name,     setName]     = useState('');
  const [parentId, setParentId] = useState('');
  const qc = useQueryClient();

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn:  catalogApi.getCategories,
  });

  const createMut = useMutation({
    mutationFn: () => catalogApi.createCategory({ name, parent_id: parentId || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      setName(''); setParentId('');
      toast.success('Category created');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => catalogApi.deleteCategory(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); toast.success('Category deactivated'); },
  });

  const renderTree = (cats: Category[], depth = 0): React.ReactNode =>
    cats.map(cat => (
      <div key={cat.id}>
        <div className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg"
          style={{ paddingLeft: `${12 + depth * 20}px` }}>
          <div className="flex items-center gap-2">
            <FolderTree size={13} className="text-gray-400" />
            <span className="text-sm text-gray-800">{cat.name}</span>
            <span className="text-xs text-gray-400 font-mono">/{cat.slug}</span>
          </div>
          <button onClick={() => deleteMut.mutate(cat.id)} className="p-1 text-gray-300 hover:text-red-500 rounded">
            <Trash2 size={12} />
          </button>
        </div>
        {cat.children?.length ? renderTree(cat.children, depth + 1) : null}
      </div>
    ));

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-xl font-semibold text-gray-900">Category management</h1>

      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-4 text-sm">Add category</h2>
        <div className="flex gap-3 flex-wrap">
          <input value={name} onChange={e => setName(e.target.value)}
            className="input flex-1 min-w-[160px]" placeholder="Category name" />
          <select value={parentId} onChange={e => setParentId(e.target.value)} className="input w-48">
            <option value="">Root category</option>
            {(categories as Category[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={() => createMut.mutate()} disabled={!name || createMut.isPending}
            className="btn-primary gap-1.5">
            <Plus size={14} />Add
          </button>
        </div>
      </div>

      <div className="card p-4">
        <h2 className="font-semibold text-gray-900 mb-3 text-sm">Category tree</h2>
        {(categories as Category[]).length === 0
          ? <p className="text-gray-400 text-sm text-center py-6">No categories yet</p>
          : <div>{renderTree(categories as Category[])}</div>
        }
      </div>
    </div>
  );
}