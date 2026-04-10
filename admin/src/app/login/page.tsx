// src/app/login/page.tsx
'use client';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const LoginForm = dynamic(
  () => import('./LoginForm').then(m => m.LoginForm),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <Loader2 size={24} className="animate-spin text-violet-400" />
      </div>
    ),
  }
);

export default function LoginPage() {
  return <LoginForm />;
}