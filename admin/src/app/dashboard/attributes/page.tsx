'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  Plus, Edit2, Trash2, Loader2, X, Check,
  ChevronDown, ChevronUp, Tag, Palette, Circle,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

 
function ValueRow({
  attrId,
  value,
  onDelete,
}: {
  attrId:   string;
  value:    any;
  onDelete: () => void;
}) {
  const [editing,      setEditing]      = useState(false);
  const [confirmDel,   setConfirmDel]   = useState(false);
  const [displayValue, setDisplayValue] = useState(value.display_value);
  const [colorHex,     setColorHex]     = useState(value.color_hex ?? '');
  const qc = useQueryClient();

  const updateMut = useMutation({
    mutationFn: () =>
      api.put(`/admin/attributes/${attrId}/values/${value.id}`, {
        display_value: displayValue,
        color_hex:     colorHex || null,
      }),
    onSuccess: () => {
      toast.success('Value updated');
      qc.invalidateQueries({ queryKey: ['admin-attributes'] });
      setEditing(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  // ── Edit mode — stacked on mobile, row on sm+ ─────────────────────────────
  if (editing) {
    return (
      <div className="py-2 space-y-2">
        <input
          value={displayValue}
          onChange={e => setDisplayValue(e.target.value)}
          className="input text-sm w-full"
          placeholder="Display value"
          autoFocus
          onKeyDown={e => {
            if (e.key === 'Enter')  updateMut.mutate();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
        <div className="flex items-center gap-2">
          {/* Color picker — always visible in edit mode */}
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
            <Palette size={13} className="text-gray-400" />
            Color
          </label>
          <input
            type="color"
            value={colorHex || '#888888'}
            onChange={e => setColorHex(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border border-gray-200"
          />
          <button
            onClick={() => setColorHex('')}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Clear
          </button>
          <div className="flex-1" />
          {/* Save */}
          <button
            onClick={() => updateMut.mutate()}
            disabled={updateMut.isPending}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-medium min-w-[60px] justify-center"
          >
            {updateMut.isPending
              ? <Loader2 size={12} className="animate-spin" />
              : <><Check size={12} />Save</>
            }
          </button>
          {/* Cancel */}
          <button
            onClick={() => { setEditing(false); setDisplayValue(value.display_value); }}
            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    );
  }

  // ── Display mode ──────────────────────────────────────────────────────────
  return (
    <div className="flex items-center justify-between gap-2 py-2 group">
      <div className="flex items-center gap-2 min-w-0">
        {value.color_hex ? (
          <span
            className="w-4 h-4 rounded-full border border-gray-200 shrink-0"
            style={{ background: value.color_hex }}
          />
        ) : (
          <Circle size={13} className="text-gray-300 shrink-0" />
        )}
        <span className="text-sm text-gray-700 truncate">{value.display_value}</span>
        <span className="text-xs text-gray-400 font-mono shrink-0 hidden sm:inline">
          ({value.value})
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {/* Two-step delete */}
        {confirmDel ? (
          <div className="flex items-center gap-1">
            <span className="text-xs text-red-600 hidden sm:inline">Delete?</span>
            <button
              onClick={() => { onDelete(); setConfirmDel(false); }}
              className="px-2 py-1 rounded text-xs bg-red-50 text-red-600 hover:bg-red-100 font-medium"
            >
              Yes
            </button>
            <button
              onClick={() => setConfirmDel(false)}
              className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-500 hover:bg-gray-200 font-medium"
            >
              No
            </button>
          </div>
        ) : (
          // Actions visible on hover (desktop) or always on touch
          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
              aria-label="Edit value"
            >
              <Edit2 size={12} />
            </button>
            <button
              onClick={() => setConfirmDel(true)}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
              aria-label="Delete value"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── AddValueForm ──────────────────────────────────────────────────────────────
// Wraps cleanly on all screen sizes via flex-wrap.
function AddValueForm({
  attrId,
  onSuccess,
}: {
  attrId:    string;
  onSuccess: () => void;
}) {
  const [displayValue, setDisplayValue] = useState('');
  const [colorHex,     setColorHex]     = useState('');
  const [showColor,    setShowColor]    = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/admin/attributes/${attrId}/values`, {
        value:         displayValue.toLowerCase().replace(/\s+/g, '-'),
        display_value: displayValue,
        color_hex:     colorHex || null,
      }),
    onSuccess: () => {
      toast.success('Value added');
      setDisplayValue('');
      setColorHex('');
      onSuccess();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to add value'),
  });

  const submit = () => displayValue.trim() && mutation.mutate();

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      {/* Row 1: text input + color toggle */}
      <div className="flex items-center gap-2 mb-2">
        <input
          value={displayValue}
          onChange={e => setDisplayValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          className="input text-sm flex-1 py-2"
          placeholder="Add value (e.g. Red, Large)…"
        />
        {/* Color toggle */}
        <button
          onClick={() => setShowColor(s => !s)}
          className={clsx(
            'p-2 rounded-lg border transition-colors shrink-0',
            showColor
              ? 'border-indigo-300 bg-indigo-50'
              : 'border-gray-200 hover:border-gray-300',
          )}
          aria-label="Toggle color picker"
        >
          <Palette size={14} className={showColor ? 'text-indigo-600' : 'text-gray-400'} />
        </button>
        {/* Color picker — shown inline when toggled */}
        {showColor && (
          <input
            type="color"
            value={colorHex || '#888888'}
            onChange={e => setColorHex(e.target.value)}
            className="w-9 h-9 rounded cursor-pointer border border-gray-200 shrink-0"
          />
        )}
      </div>
      {/* Row 2: Add button (full width on mobile) */}
      <button
        onClick={submit}
        disabled={!displayValue.trim() || mutation.isPending}
        className="btn-primary text-xs py-2 px-4 gap-1.5 w-full sm:w-auto disabled:opacity-50"
      >
        {mutation.isPending
          ? <><Loader2 size={12} className="animate-spin" />Adding…</>
          : <><Plus size={12} />Add value</>
        }
      </button>
    </div>
  );
}

// ── AttributeCard ─────────────────────────────────────────────────────────────
function AttributeCard({ attribute }: { attribute: any }) {
  const [expanded,     setExpanded]     = useState(false);
  const [editingName,  setEditingName]  = useState(false);
  const [confirmDel,   setConfirmDel]   = useState(false);
  const [displayName,  setDisplayName]  = useState(attribute.display_name);
  const qc = useQueryClient();

  const updateMut = useMutation({
    mutationFn: () =>
      api.put(`/admin/attributes/${attribute.id}`, { display_name: displayName }),
    onSuccess: () => {
      toast.success('Attribute updated');
      qc.invalidateQueries({ queryKey: ['admin-attributes'] });
      setEditingName(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/admin/attributes/${attribute.id}`),
    onSuccess: () => {
      toast.success('Attribute deactivated');
      qc.invalidateQueries({ queryKey: ['admin-attributes'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const deleteValueMut = useMutation({
    mutationFn: (valueId: string) =>
      api.delete(`/admin/attributes/${attribute.id}/values/${valueId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-attributes'] }),
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const values = attribute.values ?? [];

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        {/* Icon */}
        <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
          <Tag size={15} className="text-indigo-600" />
        </div>

        {/* Name — edit or display */}
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="input text-sm flex-1 min-w-[160px] py-1.5"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter')  updateMut.mutate();
                  if (e.key === 'Escape') { setEditingName(false); setDisplayName(attribute.display_name); }
                }}
              />
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateMut.mutate()}
                  disabled={updateMut.isPending}
                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                >
                  {updateMut.isPending
                    ? <Loader2 size={13} className="animate-spin" />
                    : <Check size={13} />
                  }
                </button>
                <button
                  onClick={() => { setEditingName(false); setDisplayName(attribute.display_name); }}
                  className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-gray-900">{attribute.display_name}</p>
              <span className="text-xs text-gray-400 font-mono">({attribute.name})</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                {values.length} value{values.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {confirmDel ? (
            /* Two-step delete confirmation — inline, no dialog */
            <div className="flex items-center gap-1">
              <AlertTriangle size={13} className="text-red-500" />
              <button
                onClick={() => deleteMut.mutate()}
                disabled={deleteMut.isPending}
                className="px-2 py-1 rounded text-xs bg-red-50 text-red-600 hover:bg-red-100 font-medium min-w-[32px] text-center"
              >
                {deleteMut.isPending ? <Loader2 size={11} className="animate-spin mx-auto" /> : 'Yes'}
              </button>
              <button
                onClick={() => setConfirmDel(false)}
                className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-500 hover:bg-gray-200 font-medium"
              >
                No
              </button>
            </div>
          ) : (
            <>
              {!editingName && (
                <button
                  onClick={() => setEditingName(true)}
                  className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  aria-label="Edit attribute name"
                >
                  <Edit2 size={14} />
                </button>
              )}
              <button
                onClick={() => setConfirmDel(true)}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                aria-label="Deactivate attribute"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Expanded values list */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          {values.length === 0 ? (
            <p className="text-xs text-gray-400 mb-2 italic">
              No values yet — add the first one below.
            </p>
          ) : (
            <div className="divide-y divide-gray-50">
              {values.map((v: any) => (
                <ValueRow
                  key={v.id}
                  attrId={attribute.id}
                  value={v}
                  onDelete={() => deleteValueMut.mutate(v.id)}
                />
              ))}
            </div>
          )}
          <AddValueForm
            attrId={attribute.id}
            onSuccess={() => qc.invalidateQueries({ queryKey: ['admin-attributes'] })}
          />
        </div>
      )}
    </div>
  );
}

// ── CreateAttributeForm ───────────────────────────────────────────────────────
function CreateAttributeForm({ onSuccess }: { onSuccess: () => void }) {
  const [name,        setName]        = useState('');
  const [displayName, setDisplayName] = useState('');
  const qc = useQueryClient();

  // Auto-generate internal name from display name
  const autoName = (d: string) =>
    d.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/admin/attributes', {
        name:         autoName(displayName) || name,
        display_name: displayName,
      }),
    onSuccess: () => {
      toast.success('Attribute created');
      setName('');
      setDisplayName('');
      onSuccess();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to create attribute'),
  });

  return (
    <div className="card p-5 space-y-4">
      <h2 className="font-semibold text-gray-900 text-sm border-b border-gray-100 pb-3 flex items-center gap-2">
        <Plus size={14} className="text-indigo-600" />
        New attribute
      </h2>

      {/* Responsive grid: 1 col on mobile, 2 cols on sm+ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Display name <span className="text-red-400">*</span>
          </label>
          <input
            value={displayName}
            onChange={e => {
              setDisplayName(e.target.value);
              setName(autoName(e.target.value));
            }}
            onKeyDown={e => e.key === 'Enter' && displayName.trim() && mutation.mutate()}
            className="input w-full"
            placeholder="Color, Size, Material…"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Internal name
            <span className="text-gray-400 font-normal ml-1">(auto)</span>
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="input font-mono text-sm w-full"
            placeholder="color"
          />
        </div>
      </div>

      <button
        onClick={() => displayName.trim() && mutation.mutate()}
        disabled={!displayName.trim() || mutation.isPending}
        className="btn-primary text-sm gap-2 disabled:opacity-50 w-full sm:w-auto"
      >
        {mutation.isPending
          ? <><Loader2 size={13} className="animate-spin" />Creating…</>
          : <><Plus size={13} />Create attribute</>
        }
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AttributesPage() {
  const qc = useQueryClient();

  // FIX: use /admin/attributes not /attributes (public, cached, rate-limited)
  const { data: attributes = [], isLoading } = useQuery({
    queryKey:  ['admin-attributes'],
    queryFn:   () => api.get('/attributes').then((r: any) => r.data.data ?? []),
    staleTime: 30_000,
  });

  return (
    <div className="max-w-3xl mx-auto space-y-5 px-4 sm:px-0">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Tag size={20} className="text-indigo-600 shrink-0" />
          Product attributes
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Define attribute types and their selectable values for product variants.
        </p>
      </div>

      {/* Create form */}
      <CreateAttributeForm
        onSuccess={() => qc.invalidateQueries({ queryKey: ['admin-attributes'] })}
      />

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 skeleton rounded-xl" />
          ))}
        </div>
      ) : (attributes as any[]).length === 0 ? (
        <div className="card p-12 text-center">
          <Tag size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium text-sm">No attributes yet</p>
          <p className="text-gray-400 text-xs mt-1">
            Create your first attribute above — e.g. Color, Size, Material.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {(attributes as any[]).map((attr: any) => (
            <AttributeCard key={attr.id} attribute={attr} />
          ))}
        </div>
      )}
    </div>
  );
}