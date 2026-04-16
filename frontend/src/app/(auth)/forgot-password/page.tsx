'use client';
// src/app/(auth)/forgot-password/page.tsx
import { useState } from 'react';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { Loader2, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try { await authApi.forgotPassword(email); setSent(true); }
    catch { toast.error('Something went wrong'); }
    finally { setLoading(false); }
  };

  if (sent) return (
    <div className="card p-8 text-center">
      <Mail size={48} className="text-violet-600 mx-auto mb-4" />
      <h2 className="text-xl font-semibold mb-2">Check your inbox</h2>
      <p className="text-gray-500 text-sm mb-6">
        If <strong>{email}</strong> is registered, we sent a reset code. Check your spam folder too.
      </p>
      <Link href={`/verify-otp?purpose=password_reset`} className="btn-primary w-full block text-center py-2.5 mb-3">
        Enter reset code
      </Link>
      <Link href="/login" className="text-sm text-gray-500 hover:text-gray-700">Back to sign in</Link>
    </div>
  );

  return (
    <div className="card p-8">
      <div className="text-center mb-7">
        <Link href="/" className="text-2xl font-bold text-violet-600">AddisMarket</Link>
        <h1 className="text-xl font-semibold text-gray-900 mt-3">Reset your password</h1>
        <p className="text-gray-500 text-sm mt-1">Enter your email to receive a reset code.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Email address</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input" placeholder="you@example.com" required />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 gap-2">
          {loading && <Loader2 size={15} className="animate-spin" />}Send reset code
        </button>
      </form>
      <p className="text-center text-sm text-gray-500 mt-6">
        Remember your password? <Link href="/login" className="text-violet-600 font-medium">Sign in</Link>
      </p>
    </div>
  );
}
