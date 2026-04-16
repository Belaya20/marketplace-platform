'use client';
// frontend/src/app/(auth)/register/seller/page.tsx
//
// Seller registration form.
//
// FIX: verify-otp redirect now includes:
//   • email — so OTP page shows which inbox to check
//   • role=seller — so OTP page shows the correct "pending approval" message
//     instead of redirecting to /login and confusing the seller
//
// FLOW: Register → verify email → "pending approval" screen → admin approves → login

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, CheckCircle, Store } from 'lucide-react';
import { authApi } from '@/lib/api';
import toast from 'react-hot-toast';

export default function RegisterSellerPage() {
  const [loading,    setLoading]    = useState(false);
  const [done,       setDone]       = useState(false);
  const [userId,     setUserId]     = useState('');
  const [userEmail,  setUserEmail]  = useState('');

  const [form, setForm] = useState({
    first_name:               '',
    last_name:                '',
    email:                    '',
    phone:                    '',
    password:                 '',
    business_name:            '',
    business_registration_no: '',
    tax_id:                   '',
    business_address:         '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.registerSeller({
        ...form,
        phone:                    form.phone                    || undefined,
        business_registration_no: form.business_registration_no || undefined,
        tax_id:                   form.tax_id                   || undefined,
        business_address:         form.business_address         || undefined,
      }) as any;

      setUserId(res.id);
      setUserEmail(form.email);
      setDone(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const f = (k: keyof typeof form) => ({
    value:    form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value })),
  });

  // ── Success state ─────────────────────────────────────────────────────────
  if (done) {
    // Pass email + role=seller so verify-otp page shows the correct
    // "pending approval" message instead of trying to redirect to /login
    const verifyUrl = `/verify-otp?user_id=${userId}&email=${encodeURIComponent(userEmail)}&purpose=email_verify&role=seller`;
    return (
      <div className="card p-8 text-center">
        <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={30} className="text-green-500" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Registration submitted!</h2>
        <p className="text-gray-500 text-sm mb-1">
          We sent a verification code to <strong>{userEmail}</strong>
        </p>
        <p className="text-gray-400 text-xs mb-6">
          After verifying your email, an admin will review and approve your seller account.
        </p>
        <Link href={verifyUrl} className="btn-primary w-full block text-center py-2.5">
          Verify my email
        </Link>
      </div>
    );
  }

  // ── Registration form ─────────────────────────────────────────────────────
  return (
    <div className="card p-8">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-violet-50 rounded-xl mb-3">
          <Store size={22} className="text-violet-600" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900">Become a seller</h1>
        <p className="text-gray-500 text-sm mt-1">Register your store on AddisMarket</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Personal info */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">First name</label>
            <input {...f('first_name')} className="input" required />
          </div>
          <div>
            <label className="label">Last name</label>
            <input {...f('last_name')} className="input" required />
          </div>
        </div>

        <div>
          <label className="label">Email</label>
          <input {...f('email')} type="email" className="input" required />
        </div>

        <div>
          <label className="label">Password</label>
          <input {...f('password')} type="password" className="input" required minLength={8} />
        </div>

        <div>
          <label className="label">
            Phone <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input {...f('phone')} type="tel" className="input" placeholder="+251 9 XX XXX XXX" />
        </div>

        <hr className="border-gray-100" />
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Business information
        </p>

        <div>
          <label className="label">Business name *</label>
          <input {...f('business_name')} className="input" placeholder="Kebede Electronics" required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">
              Registration no. <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input {...f('business_registration_no')} className="input" />
          </div>
          <div>
            <label className="label">
              Tax ID <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input {...f('tax_id')} className="input" />
          </div>
        </div>

        <div>
          <label className="label">
            Business address <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input {...f('business_address')} className="input" placeholder="Bole, Addis Ababa" />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 gap-2">
          {loading && <Loader2 size={15} className="animate-spin" />}
          Submit registration
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-5">
        Already registered?{' '}
        <Link href="/login" className="text-violet-600 font-medium">Sign in</Link>
      </p>
    </div>
  );
}