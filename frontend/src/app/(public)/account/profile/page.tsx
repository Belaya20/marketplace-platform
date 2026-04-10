'use client';
// src/app/(public)/account/profile/page.tsx
import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '@/lib/api';
import { useAuthStore } from '@/store';
import { User, Lock, MapPin, Plus, Loader2, Trash2, Star, X, Camera, Link2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import Image from 'next/image';

// ── Address form fields ────────────────────────────────────────────────────
interface AddressForm {
  full_name:        string;
  phone:            string;
  region:           string;
  city:             string;
  subcity?:         string;
  woreda?:          string;
  street_address:   string;
  postal_code?:     string;
  additional_info?: string;
  country:          string;
  is_default:       boolean;
}

// ── Profile Image Picker ───────────────────────────────────────────────────
function ProfileImagePicker({
  currentUrl,
  name,
  onSave,
  saving,
}: {
  currentUrl?: string | null;
  name:        string;
  onSave:      (url: string) => void;
  saving:      boolean;
}) {
  const [mode,     setMode]     = useState<'idle' | 'url'>('idle');
  const [urlInput, setUrlInput] = useState('');
  const [preview,  setPreview]  = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const displayUrl = preview || currentUrl || null;

  // ── File picked from disk ──
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please pick an image file'); return; }
    if (file.size > 5 * 1024 * 1024)    { toast.error('Image must be under 5MB');    return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      setPreview(dataUrl);
      onSave(dataUrl);          // save immediately on pick
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ── URL submitted ──
  const handleUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (!/^https?:\/\/.+/.test(trimmed)) {
      toast.error('Please enter a valid URL starting with http:// or https://');
      return;
    }
    setPreview(trimmed);
    onSave(trimmed);
    setUrlInput('');
    setMode('idle');
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Avatar */}
      <div className="relative group">
        <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-gray-200 bg-violet-100
          flex items-center justify-center">
          {displayUrl
            ? <Image
                src={displayUrl}
                alt={name}
                width={96}
                height={96}
                className="w-full h-full object-cover"
                unoptimized={displayUrl.startsWith('data:')}
              />
            : <span className="text-2xl font-bold text-violet-600">{initials}</span>
          }
        </div>

        {/* Camera overlay on hover */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center
            opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          title="Upload from device"
        >
          <Camera size={22} className="text-white" />
        </button>

        {/* Saving spinner */}
        {saving && (
          <div className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center">
            <Loader2 size={22} className="text-white animate-spin" />
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="btn-secondary text-xs py-1.5 gap-1.5"
        >
          <Upload size={12} />Upload
        </button>
        <button
          type="button"
          onClick={() => setMode(m => m === 'url' ? 'idle' : 'url')}
          className="btn-secondary text-xs py-1.5 gap-1.5"
        >
          <Link2 size={12} />From URL
        </button>
      </div>

      {/* URL input */}
      {mode === 'url' && (
        <div className="w-full flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleUrl())}
            className="input flex-1 text-sm"
            placeholder="https://example.com/photo.jpg"
            autoFocus
          />
          <button type="button" onClick={handleUrl}
            className="btn-primary text-xs px-3">Save</button>
          <button type="button" onClick={() => { setMode('idle'); setUrlInput(''); }}
            className="btn-secondary text-xs px-2"><X size={13} /></button>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        Hover the photo to upload from device.<br />Max 5MB — JPEG, PNG, WebP.
      </p>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}

// ── Address Modal ──────────────────────────────────────────────────────────
function AddressModal({
  onClose, onSaved, existing,
}: {
  onClose:   () => void;
  onSaved:   () => void;
  existing?: any;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<AddressForm>({
    defaultValues: existing ?? { country: 'Ethiopia', is_default: false },
  });

  const mutation = useMutation({
    mutationFn: (data: AddressForm) =>
      existing ? userApi.updateAddress(existing.id, data) : userApi.addAddress(data),
    onSuccess: () => { toast.success(existing ? 'Address updated' : 'Address added'); onSaved(); onClose(); },
    onError:   (e: any) => toast.error(e.response?.data?.message || 'Failed to save address'),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {existing ? 'Edit address' : 'Add new address'}
          </h2>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="px-6 py-5 space-y-4">
          <div>
            <label className="label">Full name *</label>
            <input {...register('full_name', { required: 'Full name is required' })} className="input" placeholder="Abebe Kebede" />
            {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name.message}</p>}
          </div>
          <div>
            <label className="label">Phone *</label>
            <input {...register('phone', { required: 'Phone is required' })} type="tel" className="input" placeholder="+251 9 XX XXX XXX" />
            {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Region *</label>
              <input {...register('region', { required: 'Region is required' })} className="input" placeholder="Addis Ababa" />
              {errors.region && <p className="text-xs text-red-500 mt-1">{errors.region.message}</p>}
            </div>
            <div>
              <label className="label">City *</label>
              <input {...register('city', { required: 'City is required' })} className="input" placeholder="Addis Ababa" />
              {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Subcity</label>
              <input {...register('subcity')} className="input" placeholder="Bole" />
            </div>
            <div>
              <label className="label">Woreda</label>
              <input {...register('woreda')} className="input" placeholder="03" />
            </div>
          </div>
          <div>
            <label className="label">Street address *</label>
            <input {...register('street_address', { required: 'Street address is required' })} className="input" placeholder="Near Bole Medhanialem Church" />
            {errors.street_address && <p className="text-xs text-red-500 mt-1">{errors.street_address.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Postal code</label>
              <input {...register('postal_code')} className="input" placeholder="1000" />
            </div>
            <div>
              <label className="label">Country</label>
              <input {...register('country')} className="input" defaultValue="Ethiopia" />
            </div>
          </div>
          <div>
            <label className="label">Additional info</label>
            <input {...register('additional_info')} className="input" placeholder="Floor 2, apartment 4 (optional)" />
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input {...register('is_default')} type="checkbox" className="w-4 h-4 rounded accent-violet-600" />
            <span className="text-sm text-gray-700">Set as default address</span>
          </label>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1 py-2.5 gap-2">
              {mutation.isPending && <Loader2 size={14} className="animate-spin" />}
              {existing ? 'Save changes' : 'Add address'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const queryClient               = useQueryClient();
  const { user, setUser }         = useAuthStore();
  const [tab,       setTab]       = useState<'profile'|'password'|'addresses'>('profile');
  const [showModal, setShowModal] = useState(false);
  const [editAddr,  setEditAddr]  = useState<any>(null);

  const { register: rp, handleSubmit: sp } = useForm({
    defaultValues: {
      first_name: user?.first_name ?? '',
      last_name:  user?.last_name  ?? '',
      phone:      user?.phone      ?? '',
    },
  });
  const { register: rpw, handleSubmit: spw, reset: resetPw } = useForm<any>();

  // ── Profile update (name, phone) ──
  const updateMut = useMutation({
    mutationFn: (d: any) => userApi.updateMe(d) as any,
    onSuccess:  (u: any) => { setUser(u); toast.success('Profile updated'); },
  });

  // ── Profile image update — fires immediately on pick/url ──
  const imageMut = useMutation({
    mutationFn: (profile_image_url: string) => userApi.updateMe({ profile_image_url }) as any,
    onSuccess:  (u: any) => { setUser(u); toast.success('Profile photo updated'); },
    onError:    (e: any) => toast.error(e.response?.data?.message || 'Failed to update photo'),
  });

  const pwMut = useMutation({
    mutationFn: (d: any) => userApi.changePassword(d.current_password, d.new_password),
    onSuccess:  () => { resetPw(); toast.success('Password changed'); },
    onError:    (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => userApi.deleteAddress(id),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['addresses'] }); toast.success('Address removed'); },
    onError:    () => toast.error('Failed to remove address'),
  });

  const setDefaultMut = useMutation({
    mutationFn: (id: string) => userApi.updateAddress(id, { is_default: true }),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['addresses'] }); toast.success('Default address updated'); },
  });

  const { data: addresses = [] } = useQuery({
    queryKey: ['addresses'],
    queryFn:  userApi.getAddresses,
    enabled:  tab === 'addresses',
  });

  const TABS = [
    { id: 'profile',   label: 'Profile',   icon: User   },
    { id: 'password',  label: 'Password',  icon: Lock   },
    { id: 'addresses', label: 'Addresses', icon: MapPin },
  ];

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || 'U';
  const openAdd  = () => { setEditAddr(null); setShowModal(true); };
  const openEdit = (a: any) => { setEditAddr(a); setShowModal(true); };
  const onSaved  = () => queryClient.invalidateQueries({ queryKey: ['addresses'] });

  return (
    <div className="container-page py-8 max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">My account</h1>

      {/* Tabs — unchanged */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {/* Profile tab — image picker added above the form */}
      {tab === 'profile' && (
        <div className="space-y-5">
          {/* ── Profile image card ── */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Profile photo</h3>
            <ProfileImagePicker
              currentUrl={user?.profile_image_url}
              name={fullName}
              onSave={url => imageMut.mutate(url)}
              saving={imageMut.isPending}
            />
          </div>

          {/* Profile details form — unchanged */}
          <form onSubmit={sp(d => updateMut.mutate(d))} className="card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Personal details</h3>
            <p className="text-sm text-gray-500">
              Email: <span className="text-gray-900 font-medium">{user?.email}</span>
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">First name</label><input {...rp('first_name')} className="input" /></div>
              <div><label className="label">Last name</label><input {...rp('last_name')} className="input" /></div>
            </div>
            <div>
              <label className="label">Phone</label>
              <input {...rp('phone')} type="tel" className="input" placeholder="+251 9 XX XXX XXX" />
            </div>
            <button type="submit" disabled={updateMut.isPending} className="btn-primary gap-2">
              {updateMut.isPending && <Loader2 size={14} className="animate-spin" />}Save changes
            </button>
          </form>
        </div>
      )}

      {/* Password tab — unchanged */}
      {tab === 'password' && (
        <form onSubmit={spw(d => pwMut.mutate(d))} className="card p-5 space-y-4">
          <div>
            <label className="label">Current password</label>
            <input {...rpw('current_password', { required: true })} type="password" className="input" />
          </div>
          <div>
            <label className="label">New password</label>
            <input {...rpw('new_password', { required: true, minLength: 8 })} type="password" className="input" />
          </div>
          <button type="submit" disabled={pwMut.isPending} className="btn-primary gap-2">
            {pwMut.isPending && <Loader2 size={14} className="animate-spin" />}Change password
          </button>
        </form>
      )}

      {/* Addresses tab — unchanged */}
      {tab === 'addresses' && (
        <div className="space-y-3">
          {(addresses as any[]).length === 0 && (
            <div className="card p-8 text-center text-gray-400">
              <MapPin size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No saved addresses yet</p>
            </div>
          )}
          {(addresses as any[]).map((a: any) => (
            <div key={a.id} className="card p-4 text-sm transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900">{a.full_name}</p>
                    {a.is_default && (
                      <span className="badge bg-violet-50 text-violet-700 text-[10px] font-semibold">Default</span>
                    )}
                  </div>
                  <p className="text-gray-600 mt-0.5">
                    {a.street_address}{a.subcity && `, ${a.subcity}`}{a.woreda && `, Woreda ${a.woreda}`}
                  </p>
                  <p className="text-gray-500">{a.city}, {a.region}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{a.phone}</p>
                  {a.additional_info && <p className="text-gray-400 text-xs mt-0.5 italic">{a.additional_info}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!a.is_default && (
                    <button onClick={() => setDefaultMut.mutate(a.id)} disabled={setDefaultMut.isPending}
                      title="Set as default"
                      className="p-1.5 text-gray-400 hover:text-amber-500 rounded-lg hover:bg-amber-50 transition-colors">
                      <Star size={15} />
                    </button>
                  )}
                  <button onClick={() => openEdit(a)}
                    className="p-1.5 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-violet-50 transition-colors text-xs font-medium px-2">
                    Edit
                  </button>
                  <button onClick={() => { if (confirm('Remove this address?')) deleteMut.mutate(a.id); }}
                    disabled={deleteMut.isPending} title="Remove address"
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          <button onClick={openAdd} className="btn-secondary w-full py-3 gap-2">
            <Plus size={15} />Add new address
          </button>
        </div>
      )}

      {showModal && (
        <AddressModal
          onClose={() => { setShowModal(false); setEditAddr(null); }}
          onSaved={onSaved}
          existing={editAddr}
        />
      )}
    </div>
  );
}