'use client';
// src/app/login/LoginForm.tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/lib/api';
import { Eye, EyeOff, Lock, AlertCircle, Loader2 } from 'lucide-react';
import Logo from '@/components/layout/ui/Logo';

// Lockout state survives page refresh via sessionStorage
const LS_KEY = 'admin_lockout';
function getLockout() {
  if (typeof window === 'undefined') return { attempts: 0, until: null };
  try { return JSON.parse(sessionStorage.getItem(LS_KEY) || '{"attempts":0,"until":null}'); }
  catch { return { attempts: 0, until: null }; }
}
function saveLockout(attempts: number, until: number | null) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(LS_KEY, JSON.stringify({ attempts, until }));
}

export function LoginForm() {
  const router = useRouter();
  const { setAuth, user, isLoading } = useAuthStore();

  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [error,       setError]       = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [attempts,    setAttempts]    = useState(() => getLockout().attempts);
  const [lockedUntil, setLockedUntil] = useState<number | null>(() => getLockout().until);
  const [,            setTick]        = useState(0);

  const getReturnTo = () => {
    if (typeof window === 'undefined') return '/dashboard';
    return new URLSearchParams(window.location.search).get('from') || '/dashboard';
  };

  // Redirect if already admin
  useEffect(() => {
    if (!isLoading && user?.role === 'admin') router.replace(getReturnTo());
  }, [user, isLoading]);

  // Lockout countdown
  useEffect(() => {
    if (!lockedUntil) return;
    const id = setInterval(() => {
      if (Date.now() >= lockedUntil) { setLockedUntil(null); setAttempts(0); saveLockout(0, null); }
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const isLocked  = !!lockedUntil && Date.now() < lockedUntil;
  const secsLeft  = isLocked ? Math.ceil((lockedUntil! - Date.now()) / 1000) : 0;

  const fail = () => {
    const next = attempts + 1;
    const until = next >= 5 ? Date.now() + 30_000 : null;
    setAttempts(next); setLockedUntil(until); saveLockout(next, until);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || submitting) return;
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    setError(''); setSubmitting(true);
    try {
      const res  = await authApi.login(email.trim(), password);
      const body = res.data;
      const u    = body.data?.user        ?? body.user;
      const tok  = body.data?.access_token ?? body.access_token;
      if (u?.role !== 'admin') { fail(); setError('Access denied. This panel is for administrators only.'); return; }
      saveLockout(0, null);
      setAuth(u, tok);
      router.replace(getReturnTo());
    } catch (err: any) {
      fail();
      setError(err.response?.data?.message || 'Invalid email or password.');
    } finally { setSubmitting(false); }
  };

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <Loader2 size={28} className="animate-spin text-violet-400" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 relative overflow-hidden">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Ambient glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-64 -right-64 w-[500px] h-[500px] rounded-full opacity-[0.06]" style={{ background: 'radial-gradient(circle, #7c3aed, transparent)' }} />
        <div className="absolute -bottom-64 -left-64 w-[500px] h-[500px] rounded-full opacity-[0.05]" style={{ background: 'radial-gradient(circle, #1A6BFF, transparent)' }} />
      </div>

      <div className="relative w-full max-w-sm">

        {/* Logo — dark variant, centered */}
        <div className="flex justify-center mb-8">
          <Logo size="md" variant="dark" href="#" />
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 32px 64px rgba(0,0,0,0.5)' }}
        >
          <h1 className="text-lg font-black text-white text-center mb-1 tracking-tight">
            Admin Sign In
          </h1>
          <p className="text-xs text-center mb-6" style={{ color: '#6b7280' }}>
            Restricted access — administrators only
          </p>

          {/* Security notice */}
          <div className="flex items-center gap-2 p-3 rounded-xl mb-5"
            style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
            <Lock size={12} className="shrink-0" style={{ color: '#a78bfa' }} />
            <p className="text-xs leading-snug" style={{ color: '#c4b5fd' }}>
              This session is monitored. Unauthorized attempts are logged.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl mb-5"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertCircle size={14} className="shrink-0 mt-0.5" style={{ color: '#f87171' }} />
              <p className="text-xs leading-relaxed" style={{ color: '#fca5a5' }}>{error}</p>
            </div>
          )}

          {/* Lockout */}
          {isLocked && (
            <div className="flex items-center gap-2 p-3 rounded-xl mb-5"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <Lock size={12} style={{ color: '#fbbf24' }} />
              <p className="text-xs" style={{ color: '#fcd34d' }}>
                Temporarily locked — try again in {secsLeft}s
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#6b7280' }}>
                Email address
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                autoComplete="email" placeholder="admin@addismarket.et"
                disabled={isLocked || submitting}
                className="w-full text-sm rounded-xl px-4 py-3 outline-none transition-all disabled:opacity-50"
                style={{ background: '#1f2937', border: '1px solid #374151', color: 'white' }}
                onFocus={e => { e.target.style.borderColor = '#7c3aed'; e.target.style.boxShadow = '0 0 0 2px rgba(124,58,237,0.15)'; }}
                onBlur={e  => { e.target.style.borderColor = '#374151'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#6b7280' }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password" placeholder="••••••••••••"
                  disabled={isLocked || submitting}
                  className="w-full text-sm rounded-xl px-4 py-3 pr-11 outline-none transition-all disabled:opacity-50"
                  style={{ background: '#1f2937', border: '1px solid #374151', color: 'white' }}
                  onFocus={e => { e.target.style.borderColor = '#7c3aed'; e.target.style.boxShadow = '0 0 0 2px rgba(124,58,237,0.15)'; }}
                  onBlur={e  => { e.target.style.borderColor = '#374151'; e.target.style.boxShadow = 'none'; }}
                />
                <button type="button" tabIndex={-1} onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: '#6b7280' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#d1d5db')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit" disabled={submitting || isLocked}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 mt-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#7c3aed', boxShadow: '0 4px 14px rgba(124,58,237,0.3)' }}
              onMouseEnter={e => { if (!submitting && !isLocked) (e.currentTarget.style.background = '#6d28d9'); }}
              onMouseLeave={e => { (e.currentTarget.style.background = '#7c3aed'); }}
            >
              {submitting
                ? <><div style={{ width:15, height:15, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', animation:'spin 0.7s linear infinite' }} />Verifying…</>
                : 'Sign in to admin panel'
              }
            </button>
          </form>

          {/* Attempt warning */}
          {attempts >= 3 && !isLocked && (
            <p className="text-center text-xs mt-4" style={{ color: '#f59e0b' }}>
              {5 - attempts} attempt{5 - attempts === 1 ? '' : 's'} remaining before lockout
            </p>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#374151' }}>
          © {new Date().getFullYear()} AddisMarket · Admin panel
        </p>
      </div>
    </div>
  );
}