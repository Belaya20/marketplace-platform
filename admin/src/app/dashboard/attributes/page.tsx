'use client';
// src/app/dashboard/attributes/page.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  Plus, Edit2, Trash2, Loader2, X, Check,
  ChevronDown, ChevronUp, Tag, Palette, Circle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

function ValueRow({ attrId, value, onDelete }: { attrId: string; value: any; onDelete: () => void }) {
  const [editing,      setEditing]      = useState(false);
  const [displayValue, setDisplayValue] = useState(value.display_value);
  const [colorHex,     setColorHex]     = useState(value.color_hex ?? '');
  const qc = useQueryClient();

  const updateMut = useMutation({
    mutationFn: () => api.put(`/admin/attributes/${attrId}/values/${value.id}`, { display_value: displayValue, color_hex: colorHex || null }),
    onSuccess: () => { toast.success('Value updated'); qc.invalidateQueries({ queryKey: ['admin-attributes'] }); setEditing(false); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  if (editing) return (
    <div className="flex items-center gap-2 py-1.5">
      <input value={displayValue} onChange={e => setDisplayValue(e.target.value)} className="input text-sm flex-1" placeholder="Display value" />
      <div className="flex items-center gap-1.5 shrink-0">
        <input type="color" value={colorHex || '#888888'} onChange={e => setColorHex(e.target.value)} className="w-8 h-8 rounded cursor-pointer border border-gray-200" />
        <button onClick={() => updateMut.mutate()} disabled={updateMut.isPending} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg">
          {updateMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
        </button>
        <button onClick={() => setEditing(false)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X size={13} /></button>
      </div>
    </div>
  );

  return (
    <div className="flex items-center justify-between gap-2 py-1.5 group">
      <div className="flex items-center gap-2">
        {value.color_hex
          ? <span className="w-5 h-5 rounded-full border border-gray-200 shrink-0" style={{ background: value.color_hex }} />
          : <Circle size={14} className="text-gray-300 shrink-0" />
        }
        <span className="text-sm text-gray-700">{value.display_value}</span>
        <span className="text-xs text-gray-400 font-mono">({value.value})</span>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setEditing(true)} className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"><Edit2 size={12} /></button>
        <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 size={12} /></button>
      </div>
    </div>
  );
}

function AddValueForm({ attrId, onSuccess }: { attrId: string; onSuccess: () => void }) {
  const [displayValue, setDisplayValue] = useState('');
  const [colorHex,     setColorHex]     = useState('');
  const [showColor,    setShowColor]    = useState(false);

  const mutation = useMutation({
    mutationFn: () => api.post(`/admin/attributes/${attrId}/values`, {
      value:         displayValue.toLowerCase().replace(/\s+/g, '-'),
      display_value: displayValue,
      color_hex:     colorHex || null,
    }),
    onSuccess: () => { setDisplayValue(''); setColorHex(''); onSuccess(); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to add value'),
  });

  return (
    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
      <input value={displayValue} onChange={e => setDisplayValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && displayValue.trim() && mutation.mutate()}
        className="input text-sm flex-1 py-2" placeholder="Add value (e.g. Red, Large)…" />
      <button onClick={() => setShowColor(s => !s)}
        className={clsx('p-2 rounded-lg border transition-colors', showColor ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 hover:border-gray-300')}>
        <Palette size={14} className={showColor ? 'text-indigo-600' : 'text-gray-400'} />
      </button>
      {showColor && (
        <input type="color" value={colorHex || '#888888'} onChange={e => setColorHex(e.target.value)} className="w-9 h-9 rounded cursor-pointer border border-gray-200" />
      )}
      <button onClick={() => displayValue.trim() && mutation.mutate()} disabled={!displayValue.trim() || mutation.isPending}
        className="btn-primary text-xs py-2 px-3 gap-1 disabled:opacity-50">
        {mutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}Add
      </button>
    </div>
  );
}

function AttributeCard({ attribute }: { attribute: any }) {
  const [expanded,    setExpanded]    = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState(attribute.display_name);
  const qc = useQueryClient();

  const updateMut = useMutation({
    mutationFn: () => api.put(`/admin/attributes/${attribute.id}`, { display_name: displayName }),
    onSuccess: () => { toast.success('Updated'); qc.invalidateQueries({ queryKey: ['admin-attributes'] }); setEditingName(false); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/admin/attributes/${attribute.id}`),
    onSuccess: () => { toast.success('Attribute deactivated'); qc.invalidateQueries({ queryKey: ['admin-attributes'] }); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const deleteValueMut = useMutation({
    mutationFn: (valueId: string) => api.delete(`/admin/attributes/${attribute.id}/values/${valueId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-attributes'] }),
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const values = attribute.values ?? [];

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
          <Tag size={15} className="text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex items-center gap-2">
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} className="input text-sm flex-1 py-1.5" autoFocus
                onKeyDown={e => { if (e.key === 'Enter') updateMut.mutate(); if (e.key === 'Escape') setEditingName(false); }} />
              <button onClick={() => updateMut.mutate()} disabled={updateMut.isPending} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded">
                {updateMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              </button>
              <button onClick={() => setEditingName(false)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"><X size={13} /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-900">{attribute.display_name}</p>
              <span className="text-xs text-gray-400 font-mono">({attribute.name})</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{values.length} value{values.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!editingName && (
            <button onClick={() => setEditingName(true)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit2 size={14} /></button>
          )}
          <button onClick={() => { if (confirm(`Deactivate "${attribute.display_name}"?`)) deleteMut.mutate(); }}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
          <button onClick={() => setExpanded(e => !e)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          {values.length === 0 ? (
            <p className="text-xs text-gray-400 mb-2">No values yet</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {values.map((v: any) => (
                <ValueRow key={v.id} attrId={attribute.id} value={v}
                  onDelete={() => { if (confirm(`Remove "${v.display_value}"?`)) deleteValueMut.mutate(v.id); }} />
              ))}
            </div>
          )}
          <AddValueForm attrId={attribute.id} onSuccess={() => qc.invalidateQueries({ queryKey: ['admin-attributes'] })} />
        </div>
      )}
    </div>
  );
}

function CreateAttributeForm({ onSuccess }: { onSuccess: () => void }) {
  const [name,        setName]        = useState('');
  const [displayName, setDisplayName] = useState('');
  const qc = useQueryClient();
  const autoName = (d: string) => d.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

  const mutation = useMutation({
    mutationFn: () => api.post('/admin/attributes', { name: autoName(displayName) || name, display_name: displayName }),
    onSuccess: () => { toast.success('Attribute created'); setName(''); setDisplayName(''); onSuccess(); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  return (
    <div className="card p-5 space-y-4">
      <h2 className="font-semibold text-gray-900 text-sm border-b border-gray-100 pb-3 flex items-center gap-2">
        <Plus size={14} className="text-indigo-600" />New attribute
      </h2>
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Display name *</label>
          <input value={displayName} onChange={e => { setDisplayName(e.target.value); setName(autoName(e.target.value)); }}
            className="input" placeholder="Color, Size, Material…" />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Internal name (auto)</label>
          <input value={name} onChange={e => setName(e.target.value)} className="input font-mono text-sm" placeholder="color" />
        </div>
      </div>
      <button onClick={() => displayName.trim() && mutation.mutate()} disabled={!displayName.trim() || mutation.isPending}
        className="btn-primary text-sm gap-2 disabled:opacity-50">
        {mutation.isPending ? <><Loader2 size={13} className="animate-spin" />Creating…</> : <><Plus size={13} />Create attribute</>}
      </button>
    </div>
  );
}

export default function AttributesPage() {
  const qc = useQueryClient();

  const { data: attributes = [], isLoading } = useQuery({
    queryKey: ['admin-attributes'],
    queryFn:  () => api.get('/attributes').then((r: any) => r.data.data ?? []),
    staleTime: 30_000,
  });

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2"><Tag size={20} className="text-indigo-600" />Product attributes</h1>
        <p className="text-sm text-gray-400 mt-0.5">Define attribute types and their selectable values for product variants.</p>
      </div>

      <CreateAttributeForm onSuccess={() => qc.invalidateQueries({ queryKey: ['admin-attributes'] })} />

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>
      ) : (attributes as any[]).length === 0 ? (
        <div className="card p-12 text-center">
          <Tag size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No attributes yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(attributes as any[]).map((attr: any) => <AttributeCard key={attr.id} attribute={attr} />)}
        </div>
      )}
    </div>
  );
}