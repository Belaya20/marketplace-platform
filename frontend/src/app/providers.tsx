'use client';
// src/app/providers.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useState } from 'react';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
    },
  }));
  return (
    <QueryClientProvider client={qc}>
      {children}
      <Toaster position="top-right" toastOptions={{ duration: 4000,
        style: { borderRadius: '8px', fontSize: '14px' } }} />
    </QueryClientProvider>
  );
}
