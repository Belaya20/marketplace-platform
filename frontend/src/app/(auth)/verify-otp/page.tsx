'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { Loader2, CheckCircle, RefreshCw, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

// ── Inner form (requires Suspense for useSearchParams) ────────────────────────

function VerifyOtpForm() {
  const sp     = useSearchParams();
  const router = useRouter();

  const userId  = sp.get('user_id') || '';
  const email   = sp.get('email')   || '';
  const purpose = sp.get('purpose') || 'email_verify';

  const [otp,          setOtp]          = useState('');
  const [loading,      setLoading]      = useState(false);
  const [resending,    setResending]    = useState(false);
  const [done,         setDone]         = useState(false);
  // When email is missing from URL (e.g. coming from a forgot-password link),
  // show an inline input to collect it before resending.
  const [resendEmail,  setResendEmail]  = useState(email);
  const [showEmailInput, setShowEmailInput] = useState(false);

  // Auto-submit when all 6 digits are entered
  useEffect(() => {
    if (otp.length === 6 && !loading) {
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  const handleVerify = async () => {
    if (otp.length !== 6) {
      toast.error('Enter the 6-digit code');
      return;
    }

    // Support both user_id (UUID) and email as the identity param.
    // The controller handles email-to-ID lookup on the backend.
    const identity = userId || email;
    if (!identity) {
      toast.error('Session expired. Please request a new code.');
      return;
    }

    setLoading(true);
    try {
      await authApi.verifyOtp(identity, otp, purpose);
      setDone(true);
      toast.success('Verified successfully!');

      // Redirect depends on why they were verifying
      setTimeout(() => {
        if (purpose === 'password_reset') {
          // Go to the password reset form with user identity
          router.push(`/reset-password?user_id=${userId || identity}`);
        } else {
          // Email verified — go sign in
          router.push('/login');
        }
      }, 1_500);

    } catch (err: any) {
      const msg = err.response?.data?.message || '';
      if (msg.toLowerCase().includes('expired')) {
        toast.error('Code has expired. Please request a new one below.');
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
    // If we don't have an email, show the inline input first
    if (!resendEmail) {
      setShowEmailInput(true);
      return;
    }
    setResending(true);
    try {
      await authApi.resendOtp(resendEmail, purpose as any);
      toast.success('New code sent! Check your inbox.');
      setOtp('');
      setShowEmailInput(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to resend. Please check the email address.');
    } finally {
      setResending(false);
    }
  };

  // ── Success state ─────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="card p-8 text-center">
        <CheckCircle size={56} className="text-green-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {purpose === 'password_reset' ? 'Identity verified!' : 'Email verified!'}
        </h2>
        <p className="text-gray-500 text-sm">
          {purpose === 'password_reset'
            ? 'Redirecting you to reset your password…'
            : 'Redirecting you to sign in…'}
        </p>
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
        <h1 className="text-xl font-semibold text-gray-900">Check your email</h1>
        <p className="text-gray-500 text-sm mt-2">
          We sent a 6-digit code to
          {email ? (
            <>
              <br />
              <span className="font-medium text-gray-700">{email}</span>
            </>
          ) : (
            ' your email address'
          )}
        </p>
        <p className="text-gray-400 text-xs mt-1">The code expires in 10 minutes.</p>
      </div>

      {/* OTP input */}
      <div className="mb-4">
        <label className="label text-center block">Enter 6-digit code</label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          className="input text-center text-3xl font-bold tracking-[0.6em] py-4"
          placeholder="000000"
          autoFocus
          disabled={loading}
        />
      </div>

      {/* Verify button — only shown if not auto-submitted yet */}
      <button
        onClick={handleVerify}
        disabled={loading || otp.length !== 6}
        className="btn-primary w-full py-3 gap-2 mb-4"
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        Verify
      </button>

      {/* Resend section */}
      <div className="text-center">
        <p className="text-sm text-gray-500 mb-2">Didn&apos;t receive the code?</p>

        {/* Inline email input — replaces the removed window.prompt() */}
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

        <button
          onClick={handleResend}
          disabled={resending}
          className="text-sm text-violet-600 hover:text-violet-800 font-medium flex items-center justify-center gap-1.5 mx-auto"
        >
          {resending ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <RefreshCw size={14} />
              {showEmailInput ? 'Send new code' : 'Resend code'}
            </>
          )}
        </button>
      </div>

      <div className="border-t border-gray-100 mt-6 pt-4 text-center">
        <Link href="/login" className="text-sm text-gray-400 hover:text-gray-600">
          ← Back to sign in
        </Link>
      </div>
    </div>
  );
}

// ── Page export with Suspense boundary ───────────────────────────────────────
// useSearchParams requires Suspense in Next.js 14+.
// Without it, the build fails with a hydration error.

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <div className="card p-8 flex flex-col items-center justify-center min-h-[300px]">
          <Loader2 size={32} className="text-violet-600 animate-spin mb-4" />
          <p className="text-gray-500 text-sm">Loading verification session…</p>
        </div>
      }
    >
      <VerifyOtpForm />
    </Suspense>
  );
}