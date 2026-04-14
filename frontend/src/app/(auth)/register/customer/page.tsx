'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Loader2, CheckCircle } from 'lucide-react';
import { authApi } from '@/lib/api';
import toast from 'react-hot-toast';

export default function RegisterCustomerPage() {
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [userId,  setUserId]  = useState('');
  const [userEmail, setUserEmail] = useState('');

  const [form, setForm] = useState({
    first_name: '',
    last_name:  '',
    email:      '',
    phone:      '',
    password:   '',
    confirm:    '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.password !== form.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.registerCustomer({
        first_name: form.first_name,
        last_name:  form.last_name,
        email:      form.email,
        phone:      form.phone || undefined,
        password:   form.password,
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
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value })),
  });

  // ── Success state ───────────────────────────────────────────────────────
  if (done) {
    const verifyUrl = `/verify-otp?user_id=${userId}&email=${encodeURIComponent(userEmail)}&purpose=email_verify`;
    return (
      <div className="card p-8 text-center">
        <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Check your email</h2>
        <p className="text-gray-500 text-sm mb-1">
          We sent a 6-digit verification code to
        </p>
        <p className="text-gray-700 font-medium text-sm mb-6">{userEmail}</p>
        <Link href={verifyUrl} className="btn-primary w-full block text-center py-2.5">
          Enter verification code
        </Link>
      </div>
    );
  }

  // ── Registration form ───────────────────────────────────────────────────
  return (
    <div className="card p-8">
      <div className="text-center mb-7">
        <Link href="/" className="text-2xl font-bold text-violet-600">AddisMarket</Link>
        <h1 className="text-xl font-semibold text-gray-900 mt-3">Create your account</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">First name</label>
            <input {...f('first_name')} className="input" placeholder="Abebe" required />
          </div>
          <div>
            <label className="label">Last name</label>
            <input {...f('last_name')} className="input" placeholder="Kebede" required />
          </div>
        </div>

        <div>
          <label className="label">Email address</label>
          <input {...f('email')} type="email" className="input" placeholder="you@example.com" required />
        </div>

        <div>
          <label className="label">Phone <span className="text-gray-400 font-normal">(optional)</span></label>
          <input {...f('phone')} type="tel" className="input" placeholder="+251 9 XX XXX XXX" />
        </div>

        <div>
          <label className="label">Password</label>
          <input {...f('password')} type="password" className="input" required minLength={8} />
        </div>

        <div>
          <label className="label">Confirm password</label>
          <input {...f('confirm')} type="password" className="input" required />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 gap-2">
          {loading && <Loader2 size={15} className="animate-spin" />}
          Create account
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-violet-600 font-medium hover:text-violet-800">Sign in</Link>
      </p>
      <p className="text-center text-xs text-gray-400 mt-2">
        Selling on AddisMarket?{' '}
        <Link href="/register/seller" className="text-violet-600 font-medium">Register your store</Link>
      </p>
    </div>
  );
}