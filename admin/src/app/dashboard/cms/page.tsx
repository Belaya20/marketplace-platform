'use client';
// src/app/dashboard/cms/page.tsx
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { cmsApi, adminApi } from '@/lib/api';
import {
  FileText, Save, Loader2, Plus, Trash2, Eye,
  EyeOff, ExternalLink, Edit2, X, Check, GripVertical,
  Globe, Calendar, Link2, Type, AlignLeft,
} from 'lucide-react';
import { Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import NextImage from 'next/image';
import clsx from 'clsx';

const STATIC_PAGES = [
  { slug: 'about-us',       title: 'About us',          icon: '🏢' },
  { slug: 'contact',        title: 'Contact',           icon: '📬' },
  { slug: 'privacy-policy', title: 'Privacy policy',    icon: '🔒' },
  { slug: 'terms',          title: 'Terms & conditions', icon: '📄' },
];

interface BannerFormData {
  title: string; subtitle: string; image_url: string;
  link_url: string; cta_text: string; sort_order: number;
  starts_at: string; ends_at: string;
}

function BannerPreview({ url, title }: { url: string; title: string }) {
  const [valid, setValid] = useState(true);
  if (!url || !valid) return (
    <div className="w-full h-32 bg-gray-100 rounded-xl flex items-center justify-center border border-dashed border-gray-200">
      <div className="text-center"><ImageIcon size={20} className="text-gray-300 mx-auto mb-1" /><p className="text-xs text-gray-400">Banner preview</p></div>
    </div>
  );
  return (
    <div className="relative w-full h-32 rounded-xl overflow-hidden bg-gray-100">
      <NextImage src={url} alt={title} fill unoptimized className="object-cover" onError={() => setValid(false)} />
      <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent flex items-center px-4">
        <p className="text-white font-semibold text-sm line-clamp-2">{title || 'Banner preview'}</p>
      </div>
    </div>
  );
}

function BannerForm({ initial, onSave, onCancel, isLoading }: {
  initial?: any; onSave: (data: BannerFormData) => void; onCancel: () => void; isLoading: boolean;
}) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<BannerFormData>({
    defaultValues: {
      title: initial?.title ?? '', subtitle: initial?.subtitle ?? '',
      image_url: initial?.image_url ?? '', link_url: initial?.link_url ?? '',
      cta_text: initial?.cta_text ?? '', sort_order: initial?.sort_order ?? 0,
      starts_at: initial?.starts_at ? new Date(initial.starts_at).toISOString().slice(0,16) : '',
      ends_at:   initial?.ends_at   ? new Date(initial.ends_at).toISOString().slice(0,16)   : '',
    },
  });
  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <BannerPreview url={watch('image_url')} title={watch('title')} />
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1"><Type size={11} />Title *</label>
        <input {...register('title', { required: 'Title is required' })} className="input" placeholder="Summer Sale — Up to 50% off" />
        {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1"><AlignLeft size={11} />Subtitle</label>
        <input {...register('subtitle')} className="input" placeholder="Discover amazing deals" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1"><ImageIcon size={11} />Image URL *</label>
        <input {...register('image_url', { required: 'Image URL is required' })} className="input font-mono text-sm" placeholder="https://example.com/banner.jpg" />
        {errors.image_url && <p className="text-red-500 text-xs mt-1">{errors.image_url.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1"><Link2 size={11} />Link URL</label><input {...register('link_url')} className="input" placeholder="/search" /></div>
        <div><label className="block text-xs font-medium text-gray-600 mb-1">CTA text</label><input {...register('cta_text')} className="input" placeholder="Shop now" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1"><Calendar size={11} />Show from</label><input type="datetime-local" {...register('starts_at')} className="input text-sm" /></div>
        <div><label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1"><Calendar size={11} />Show until</label><input type="datetime-local" {...register('ends_at')} className="input text-sm" /></div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1"><GripVertical size={11} />Display order</label>
        <input type="number" {...register('sort_order', { valueAsNumber: true })} className="input w-32 text-sm" placeholder="0" />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={isLoading} className="btn-primary gap-2 text-sm">
          {isLoading ? <><Loader2 size={13} className="animate-spin" />Saving…</> : <><Check size={13} />{initial ? 'Update banner' : 'Add banner'}</>}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
      </div>
    </form>
  );
}

function BannerCard({ banner, onEdit, onToggle, onDelete }: {
  banner: any; onEdit: () => void; onToggle: () => void; onDelete: () => void;
}) {
  const now = new Date();
  const isEnded = banner.ends_at && new Date(banner.ends_at) < now;
  const scheduled = banner.starts_at && new Date(banner.starts_at) > now;
  return (
    <div className={clsx('card p-4 transition-all', !banner.is_active && 'opacity-60')}>
      <div className="mb-3"><BannerPreview url={banner.image_url} title={banner.title} /></div>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{banner.title}</p>
          {banner.subtitle && <p className="text-xs text-gray-500 truncate">{banner.subtitle}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {banner.is_active && !isEnded && !scheduled && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Live</span>}
          {scheduled && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Scheduled</span>}
          {isEnded && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Expired</span>}
          {!banner.is_active && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">Hidden</span>}
        </div>
      </div>
      {banner.link_url && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1"><Link2 size={10} /><span className="truncate">{banner.link_url}</span></div>
      )}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
        <button onClick={onEdit} className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"><Edit2 size={12} />Edit</button>
        <button onClick={onToggle} className={clsx('flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors', banner.is_active ? 'text-orange-600 hover:bg-orange-50' : 'text-emerald-600 hover:bg-emerald-50')}>
          {banner.is_active ? <><EyeOff size={12} />Hide</> : <><Eye size={12} />Show</>}
        </button>
        <button onClick={onDelete} className="flex items-center gap-1.5 text-xs font-medium text-red-400 hover:text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors ml-auto">
          <Trash2 size={12} />Delete
        </button>
      </div>
    </div>
  );
}

function PageEditor({ slug, title }: { slug: string; title: string }) {
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState(false);
  const { data: pageData, isLoading } = useQuery({
    queryKey: ['cms-page', slug],
    queryFn:  () => cmsApi.getPage(slug),
    staleTime: 60_000,
  });
  useEffect(() => { if (pageData) setContent((pageData as any)?.content_html ?? ''); }, [pageData]);

  const saveMut = useMutation({
    mutationFn: () => cmsApi.updatePage(slug, { content_html: content, is_published: true }),
    onSuccess: () => toast.success(`"${title}" saved and published`),
    onError: () => toast.error('Failed to save'),
  });

  if (isLoading) return <div className="card p-8 flex items-center justify-center gap-2 text-gray-400"><Loader2 size={16} className="animate-spin" />Loading…</div>;

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div>
          <h2 className="font-semibold text-gray-900 text-sm">{title}</h2>
          <p className="text-xs text-gray-400 mt-0.5">Editing <span className="font-mono">/{slug}</span></p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPreview(p => !p)} className={clsx('flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors', preview ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100')}>
            <Eye size={12} />Preview
          </button>
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="btn-primary text-sm py-1.5 gap-1.5">
            {saveMut.isPending ? <><Loader2 size={13} className="animate-spin" />Saving…</> : <><Save size={13} />Save & publish</>}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 text-xs">
        {[['<h2>', 'Heading'], ['<p>', 'Paragraph'], ['<strong>', 'Bold'], ['<ul><li>', 'List'], ['<a href="">', 'Link']].map(([tag]) => (
          <button key={tag} type="button" onClick={() => setContent(c => c + tag)} className="font-mono px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-600 transition-colors">{tag}</button>
        ))}
      </div>
      {preview ? (
        <div className="min-h-[300px] p-4 border border-gray-200 rounded-xl bg-gray-50">
          <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">Preview</p>
          <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: content || '<p class="text-gray-400">No content yet</p>' }} />
        </div>
      ) : (
        <textarea value={content} onChange={e => setContent(e.target.value)} rows={18}
          className="input font-mono text-xs leading-relaxed resize-none"
          placeholder={`<h2>About AddisMarket</h2>\n<p>We are Ethiopia's leading marketplace...</p>`}
          spellCheck={false} />
      )}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{content.length} characters</span>
        <a href={`/${slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-indigo-600 transition-colors">
          <Globe size={11} />View live <ExternalLink size={10} />
        </a>
      </div>
    </div>
  );
}

export default function CmsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'banners' | 'pages'>('banners');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingBanner,  setEditingBanner]  = useState<any>(null);
  const [selectedPage,   setSelectedPage]   = useState<{ slug: string; title: string } | null>(null);

  const { data: banners = [], isLoading: bannersLoading } = useQuery({
    queryKey: ['admin-banners'],
    queryFn:  adminApi.getAllBanners,
    enabled:  tab === 'banners',
    staleTime: 30_000,
  });

  const createMut = useMutation({
    mutationFn: (data: BannerFormData) => cmsApi.createBanner({ ...data, is_active: true, sort_order: Number(data.sort_order) || 0, starts_at: data.starts_at || null, ends_at: data.ends_at || null }),
    onSuccess: () => { toast.success('Banner created'); qc.invalidateQueries({ queryKey: ['admin-banners'] }); setShowCreateForm(false); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: BannerFormData }) =>
      adminApi.updateBanner(id, { ...data, sort_order: Number(data.sort_order) || 0, starts_at: data.starts_at || null, ends_at: data.ends_at || null }),
    onSuccess: () => { toast.success('Banner updated'); qc.invalidateQueries({ queryKey: ['admin-banners'] }); setEditingBanner(null); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => adminApi.updateBanner(id, { is_active }),
    onSuccess: (_d, { is_active }) => { toast.success(is_active ? 'Banner live' : 'Banner hidden'); qc.invalidateQueries({ queryKey: ['admin-banners'] }); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi.deleteBanner(id),
    onSuccess: () => { toast.success('Banner deleted'); qc.invalidateQueries({ queryKey: ['admin-banners'] }); },
  });

  const allBanners  = banners as any[];
  const liveBanners = allBanners.filter(b => b.is_active).length;

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Content management</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage homepage banners and static pages</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {[
          { id: 'banners', label: 'Homepage banners', badge: `${liveBanners} live` },
          { id: 'pages',   label: 'Static pages',     badge: `${STATIC_PAGES.length}` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={clsx('flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              tab === t.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {t.label}
            <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-0.5', tab === t.id ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500')}>{t.badge}</span>
          </button>
        ))}
      </div>

      {tab === 'banners' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{allBanners.length} banner{allBanners.length !== 1 ? 's' : ''} · {liveBanners} live</p>
            {!showCreateForm && !editingBanner && <button onClick={() => setShowCreateForm(true)} className="btn-primary text-sm gap-2"><Plus size={14} />Add banner</button>}
          </div>

          {showCreateForm && (
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-2"><Plus size={14} className="text-indigo-600" />New banner</h2>
                <button onClick={() => setShowCreateForm(false)} className="p-1 text-gray-400 hover:text-gray-700"><X size={16} /></button>
              </div>
              <BannerForm onSave={data => createMut.mutate(data)} onCancel={() => setShowCreateForm(false)} isLoading={createMut.isPending} />
            </div>
          )}

          {editingBanner && (
            <div className="card p-5 space-y-4 border-2 border-indigo-200">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-2"><Edit2 size={14} className="text-indigo-600" />Editing: {editingBanner.title}</h2>
                <button onClick={() => setEditingBanner(null)} className="p-1 text-gray-400 hover:text-gray-700"><X size={16} /></button>
              </div>
              <BannerForm initial={editingBanner} onSave={data => updateMut.mutate({ id: editingBanner.id, data })} onCancel={() => setEditingBanner(null)} isLoading={updateMut.isPending} />
            </div>
          )}

          {bannersLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{[1,2].map(i => <div key={i} className="h-56 skeleton rounded-xl" />)}</div>
          ) : allBanners.length === 0 ? (
            <div className="card p-12 text-center">
              <ImageIcon size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium">No banners yet</p>
              <button onClick={() => setShowCreateForm(true)} className="btn-primary text-sm mt-4 gap-2"><Plus size={13} />Add first banner</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {allBanners.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((banner: any) => (
                <BannerCard key={banner.id} banner={banner}
                  onEdit={() => { setEditingBanner(banner); setShowCreateForm(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  onToggle={() => toggleMut.mutate({ id: banner.id, is_active: !banner.is_active })}
                  onDelete={() => { if (confirm(`Delete "${banner.title}"?`)) deleteMut.mutate(banner.id); }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'pages' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Select a page to edit its content.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {STATIC_PAGES.map(p => (
              <button key={p.slug} onClick={() => setSelectedPage(selectedPage?.slug === p.slug ? null : p)}
                className={clsx('p-4 rounded-xl border text-left transition-all',
                  selectedPage?.slug === p.slug ? 'border-indigo-600 bg-indigo-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-400')}>
                <p className="text-xl mb-2">{p.icon}</p>
                <p className="font-medium text-sm text-gray-900">{p.title}</p>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">/{p.slug}</p>
              </button>
            ))}
          </div>
          {selectedPage && <PageEditor key={selectedPage.slug} slug={selectedPage.slug} title={selectedPage.title} />}
          {!selectedPage && (
            <div className="card p-10 text-center">
              <FileText size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Select a page above to start editing</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}