'use client';
// src/app/dashboard/brands/page.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import api from '@/lib/api';
import { Plus, Edit2, Trash2, Loader2, X, Check, Store, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import Image from 'next/image';
import { useForm } from 'react-hook-form';

interface BrandForm { name: string; slug: string; logo_url: string; website_url: string; }

function BrandFormModal({ initial, onSave, onClose, isLoading }: {
  initial?: any; onSave: (d: BrandForm) => void; onClose: () => void; isLoading: boolean;
}) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<BrandForm>({
    defaultValues: { name: initial?.name ?? '', slug: initial?.slug ?? '', logo_url: initial?.logo_url ?? '', website_url: initial?.website_url ?? '' },
  });
  const autoSlug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{initial ? 'Edit brand' : 'Add brand'}</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit(onSave)} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Brand name *</label>
            <input {...register('name', { required: 'Required' })} className="input" placeholder="Samsung"
              onChange={e => { setValue('name', e.target.value); if (!initial) setValue('slug', autoSlug(e.target.value)); }} />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Slug *</label>
            <input {...register('slug', { required: 'Required', pattern: { value: /^[a-z0-9-]+$/, message: 'Lowercase, numbers, hyphens only' } })}
              className="input font-mono text-sm" placeholder="samsung" />
            {errors.slug && <p className="text-red-500 text-xs mt-1">{errors.slug.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Logo URL</label>
            <input {...register('logo_url')} className="input text-sm" placeholder="https://example.com/logo.png" />
            {watch('logo_url') && (
              <div className="mt-2 w-12 h-12 rounded-lg bg-gray-100 overflow-hidden">
                <Image src={watch('logo_url')} alt="logo" width={48} height={48} className="w-full h-full object-contain" unoptimized onError={() => {}} />
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1"><Globe size={11} />Website URL</label>
            <input {...register('website_url')} className="input text-sm" placeholder="https://samsung.com" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={isLoading} className="btn-primary gap-2 text-sm">
              {isLoading ? <><Loader2 size={13} className="animate-spin" />Saving…</> : <><Check size={13} />{initial ? 'Update' : 'Add brand'}</>}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BrandsPage() {
  const qc = useQueryClient();
  const [modalData, setModalData] = useState<any | null>(null);
  const [search,    setSearch]    = useState('');

  const { data: brands = [], isLoading } = useQuery({
    queryKey: ['admin-brands'],
    queryFn:  () => api.get('/brands').then((r: any) => r.data.data ?? []),
    staleTime: 30_000,
  });

  const createMut = useMutation({
    mutationFn: (data: BrandForm) => api.post('/admin/brands', data),
    onSuccess: () => { toast.success('Brand created'); qc.invalidateQueries({ queryKey: ['admin-brands'] }); setModalData(null); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: BrandForm }) => adminApi.updateBrand(id, data),
    onSuccess: () => { toast.success('Brand updated'); qc.invalidateQueries({ queryKey: ['admin-brands'] }); setModalData(null); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/brands/${id}`),
    onSuccess: () => { toast.success('Brand deactivated'); qc.invalidateQueries({ queryKey: ['admin-brands'] }); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const filtered = (brands as any[]).filter(b => b.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-3xl space-y-5">
      {modalData !== null && (
        <BrandFormModal
          initial={modalData?.id ? modalData : undefined}
          onSave={data => modalData?.id ? updateMut.mutate({ id: modalData.id, data }) : createMut.mutate(data)}
          onClose={() => setModalData(null)}
          isLoading={createMut.isPending || updateMut.isPending}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2"><Store size={20} className="text-indigo-600" />Brands</h1>
          <p className="text-sm text-gray-400 mt-0.5">{(brands as any[]).length} brands total</p>
        </div>
        <button onClick={() => setModalData({})} className="btn-primary text-sm gap-2"><Plus size={15} />Add brand</button>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} className="input" placeholder="Search brands…" />

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 skeleton rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Store size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">{search ? 'No brands match your search' : 'No brands yet'}</p>
          {!search && <button onClick={() => setModalData({})} className="btn-primary text-sm mt-4 gap-2"><Plus size={13} />Add first brand</button>}
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Brand</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 hidden sm:table-cell">Slug</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 hidden md:table-cell">Website</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((brand: any) => (
                <tr key={brand.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                        {brand.logo_url ? <Image src={brand.logo_url} alt={brand.name} width={32} height={32} className="w-full h-full object-contain" unoptimized onError={() => {}} /> : <Store size={14} className="text-gray-400" />}
                      </div>
                      <span className="font-medium text-gray-900">{brand.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell"><span className="font-mono text-xs text-gray-500">{brand.slug}</span></td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {brand.website_url ? <a href={brand.website_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline truncate max-w-[160px] block">{brand.website_url.replace(/^https?:\/\//, '')}</a> : <span className="text-xs text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3"><span className={`badge text-xs ${brand.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{brand.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setModalData(brand)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit2 size={14} /></button>
                      <button onClick={() => { if (confirm(`Deactivate "${brand.name}"?`)) deleteMut.mutate(brand.id); }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}