'use client';
// frontend/src/app/(auth)/verify-otp/page.tsx
//
// Handles OTP verification for three flows:
//   • email_verify  (customer)  → success → redirect to /login
//   • email_verify  (seller)    → success → show "pending approval" message, stay here
//   • password_reset             → success → redirect to /reset-password?user_id=...
//
// FIXES:
//   • window.prompt() removed — inline email input shown instead
//   • Seller-specific post-verification message (no misleading "redirecting to login")
//   • Auto-submit when all 6 digits entered
//   • Resend cooldown — backend returns 400 with wait time, displayed in UI
//   • Purpose-based redirect after verification
//   • Suspense boundary required for useSearchParams in Next.js 14+

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import {
  Loader2, CheckCircle, RefreshCw, Mail, Store, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

// ── Inner form ────────────────────────────────────────────────────────────────

function VerifyOtpForm() {
  const sp     = useSearchParams();
  const router = useRouter();

  const userId   = sp.get('user_id') || '';
  const email    = sp.get('email')   || '';
  const purpose  = sp.get('purpose') || 'email_verify';
  // role is passed when we know the user is a seller (from register/seller)
  const roleHint = sp.get('role')    || '';

  const [otp,             setOtp]             = useState('');
  const [loading,         setLoading]         = useState(false);
  const [resending,       setResending]       = useState(false);
  const [resendEmail,     setResendEmail]     = useState(email);
  const [showEmailInput,  setShowEmailInput]  = useState(false);
  const [cooldownSecs,    setCooldownSecs]    = useState(0);
  const [doneState,       setDoneState]       = useState<
    null | 'customer_verified' | 'seller_pending' | 'seller_approved' | 'password_reset'
  >(null);

  // Cooldown countdown
  useEffect(() => {
    if (cooldownSecs <= 0) return;
    const id = setInterval(() => {
      setCooldownSecs(s => {
        if (s <= 1) { clearInterval(id); return 0; }
        return s - 1;
      });
    }, 1_000);
    return () => clearInterval(id);
  }, [cooldownSecs]);

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (otp.length === 6 && !loading) {
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  const handleVerify = async () => {
    if (otp.length !== 6) { toast.error('Enter the 6-digit code'); return; }
    const identity = userId || email;
    if (!identity) { toast.error('Session expired. Please request a new code.'); return; }

    setLoading(true);
    try {
      const result: any = await authApi.verifyOtp(identity, otp, purpose);

      if (purpose === 'password_reset') {
        setDoneState('password_reset');
        setTimeout(() => router.push(`/reset-password?user_id=${userId || identity}`), 1_500);
        return;
      }

      // email_verify — check if seller or customer
      const isSeller     = result?.isSeller ?? roleHint === 'seller';
      const sellerStatus = result?.sellerStatus;

      if (isSeller) {
        // Seller verified email — but must wait for admin approval before login
        setDoneState(sellerStatus === 'approved' ? 'seller_approved' : 'seller_pending');
      } else {
        // Customer verified — can log in immediately
        setDoneState('customer_verified');
        setTimeout(() => router.push('/login'), 1_500);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || '';
      if (msg.toLowerCase().includes('expired')) {
        toast.error('Code has expired. Request a new one below.');
      } else if (msg.toLowerCase().includes('incorrect') || msg.toLowerCase().includes('invalid')) {
        toast.error('Incorrect code. Check your email and try again.');
      } else {
        toast.error(msg || 'Verification failed. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldownSecs > 0) return;
    if (!resendEmail) { setShowEmailInput(true); return; }
    setResending(true);
    try {
      await authApi.resendOtp(resendEmail, purpose as any);
      toast.success('New code sent! Check your inbox and Railway logs.');
      setOtp('');
      setShowEmailInput(false);
      setCooldownSecs(60); // start client-side cooldown immediately
    } catch (err: any) {
      const msg = err.response?.data?.message || '';
      // Backend returns "Please wait X second(s)" — extract and show countdown
      const match = msg.match(/wait (\d+) second/);
      if (match) {
        setCooldownSecs(parseInt(match[1], 10));
        toast.error(msg);
      } else {
        toast.error(msg || 'Failed to resend. Check the email address.');
      }
    } finally {
      setResending(false);
    }
  };

  // ── Success states ────────────────────────────────────────────────────────

  if (doneState === 'customer_verified') {
    return (
      <div className="card p-8 text-center">
        <CheckCircle size={56} className="text-green-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Email verified!</h2>
        <p className="text-gray-500 text-sm">Redirecting you to sign in…</p>
      </div>
    );
  }

  if (doneState === 'password_reset') {
    return (
      <div className="card p-8 text-center">
        <CheckCircle size={56} className="text-green-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Identity verified!</h2>
        <p className="text-gray-500 text-sm">Redirecting you to reset your password…</p>
      </div>
    );
  }

  if (doneState === 'seller_pending') {
    return (
      <div className="card p-8 text-center">
        <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Store size={28} className="text-violet-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">Email verified!</h2>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-left">
          <p className="text-sm font-semibold text-amber-800 mb-1">Pending admin approval</p>
          <p className="text-sm text-amber-700">
            Your seller account is now under review. An admin will approve or reject
            your application and you will receive an email notification once reviewed.
          </p>
        </div>
        <p className="text-xs text-gray-400 mb-5">
          This typically takes 1–2 business days.
        </p>
        <Link href="/" className="btn-primary w-full block text-center py-2.5">
          Back to home
        </Link>
        <p className="text-xs text-gray-400 mt-3">
          Already approved?{' '}
          <Link href="/login" className="text-violet-600 font-medium">Sign in</Link>
        </p>
      </div>
    );
  }

  if (doneState === 'seller_approved') {
    return (
      <div className="card p-8 text-center">
        <CheckCircle size={56} className="text-green-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Account approved!</h2>
        <p className="text-gray-500 text-sm mb-5">Your seller account is active. You can sign in now.</p>
        <Link href="/login" className="btn-primary w-full block text-center py-2.5">Sign in</Link>
      </div>
    );
  }

  // ── Verification form ─────────────────────────────────────────────────────
  return (
    <div className="card p-8">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-violet-50 rounded-2xl mb-4">
          <Mail size={26} className="text-violet-600" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900">
          {purpose === 'password_reset' ? 'Enter reset code' : 'Check your email'}
        </h1>
        <p className="text-gray-500 text-sm mt-2">
          We sent a 6-digit code to
          {email ? (
            <><br /><span className="font-medium text-gray-700">{email}</span></>
          ) : (
            ' your email address'
          )}
        </p>
        <p className="text-gray-400 text-xs mt-1">Valid for 10 minutes · also visible in server logs</p>
      </div>

      {/* OTP Input */}
      <div className="mb-4">
        <label className="label text-center block">Enter 6-digit code</label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={otp}
          onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
          className="input text-center text-3xl font-bold tracking-[0.6em] py-4"
          placeholder="000000"
          autoFocus
          disabled={loading}
        />
      </div>

      {/* Verify button */}
      <button
        onClick={handleVerify}
        disabled={loading || otp.length !== 6}
        className="btn-primary w-full py-3 gap-2 mb-4"
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        {purpose === 'password_reset' ? 'Verify & continue' : 'Verify email'}
      </button>

      {/* Resend section */}
      <div className="text-center">
        <p className="text-sm text-gray-500 mb-2">Didn&apos;t receive the code?</p>

        {/* Inline email input when email not in URL */}
        {showEmailInput && (
          <div className="mb-3">
            <input
              type="email"
              value={resendEmail}
              onChange={e => setResendEmail(e.target.value)}
              placeholder="Enter your email address"
              className="input text-sm mb-2"
              autoFocus
            />
          </div>
        )}

        {/* Cooldown display */}
        {cooldownSecs > 0 ? (
          <div className="flex items-center justify-center gap-1.5 text-sm text-gray-400">
            <Clock size={14} />
            <span>Resend available in {cooldownSecs}s</span>
          </div>
        ) : (
          <button
            onClick={handleResend}
            disabled={resending}
            className="text-sm text-violet-600 hover:text-violet-800 font-medium flex items-center justify-center gap-1.5 mx-auto"
          >
            {resending ? (
              <><Loader2 size={14} className="animate-spin" />Sending…</>
            ) : (
              <><RefreshCw size={14} />{showEmailInput ? 'Send new code' : 'Resend code'}</>
            )}
          </button>
        )}
      </div>

      {/* Help text */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-500 text-center leading-relaxed">
          <strong>No email?</strong> Check your spam folder. The code is also visible
          in the server logs (Railway → Deploy Logs).
          {process.env.NODE_ENV !== 'production' && (
            <><br /><span className="text-violet-500 font-medium">Dev mode: enter 000000 to skip</span></>
          )}
        </p>
      </div>

      <div className="border-t border-gray-100 mt-5 pt-4 text-center">
        <Link href="/login" className="text-sm text-gray-400 hover:text-gray-600">
          ← Back to sign in
        </Link>
      </div>
    </div>
  );
}

// ── Suspense wrapper ──────────────────────────────────────────────────────────

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <div className="card p-8 flex flex-col items-center justify-center min-h-[300px]">
          <Loader2 size={32} className="text-violet-600 animate-spin mb-4" />
          <p className="text-gray-500 text-sm">Loading…</p>
        </div>
      }
    >
      <VerifyOtpForm />
    </Suspense>
  );
}