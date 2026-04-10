'use client';
// src/app/(auth)/login/page.tsx
import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks';

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const [showPw, setShowPw] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<{ email: string; password: string; remember_me: boolean }>();

  return (
    <div className="card p-8">
      <div className="text-center mb-8">
        <Link href="/" className="text-2xl font-bold text-violet-600">AddisMarket</Link>
        <h1 className="text-xl font-semibold text-gray-900 mt-3">Sign in to your account</h1>
      </div>
      
      <form onSubmit={handleSubmit(d => login(d.email, d.password, d.remember_me))} className="space-y-4">
        {/* Email Field */}
        <div>
          <label className="label">Email address</label>
          <input 
            {...register('email', { required: 'Required', pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' } })}
            type="email" className="input" placeholder="you@example.com" autoComplete="email" 
          />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>

        {/* Password Field */}
        <div>
          <label className="label">Password</label>
          <div className="relative">
            <input 
              {...register('password', { required: 'Required' })} 
              type={showPw ? 'text' : 'password'}
              className="input pr-10" autoComplete="current-password" 
            />
            <button type="button" onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
        </div>

        {/* Remember Me & Forgot Password - Parallel Layout */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input {...register('remember_me')} type="checkbox" className="w-4 h-4 rounded border-gray-300 text-violet-600" />
            <span className="text-sm text-gray-600">Remember me</span>
          </label>
          <Link href="/forgot-password" className="text-sm text-violet-600 hover:text-violet-800 font-medium">
            Forgot password?
          </Link>
        </div>

        <button type="submit" disabled={isLoading} className="btn-primary w-full py-2.5 gap-2">
          {isLoading && <Loader2 size={15} className="animate-spin" />}
          Sign in
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-gray-100">
        <p className="text-center text-sm text-gray-500">
          Don&apos;t have an account?{' '}
          <Link href="/register/customer" className="text-violet-600 font-medium hover:text-violet-800">Sign up</Link>
        </p>
        <p className="text-center text-xs text-gray-400 mt-2">
          Are you a seller? <Link href="/register/seller" className="text-violet-600 font-medium">Register your store</Link>
        </p>
      </div>
    </div>
  );
}