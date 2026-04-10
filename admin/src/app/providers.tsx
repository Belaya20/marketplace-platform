'use client';
// src/app/providers.tsx
// QueryClient + Toaster — client boundary for the whole app.
// React 19: useState still works the same; no breaking changes here.
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

export function Providers({ children }: { children: React.ReactNode }) {
  // FIX: Create QueryClient inside useState so it's stable across renders
  // and not recreated on every parent re-render.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data stays fresh for 1 minute before background refetch
            staleTime:            60_000,
            // Keep cached data for 5 minutes after component unmounts
            gcTime:               5 * 60_000,
            // Retry failed requests 1 time (not 3 — admin pages fail fast)
            retry:                1,
            // Don't refetch just because user switched tabs
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0, // Never retry mutations — side effects must not double-fire
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1f2937',
            color:      '#f9fafb',
            fontSize:   '14px',
            fontWeight: '500',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#f9fafb' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#f9fafb' }, duration: 6000 },
        }}
      />
    </QueryClientProvider>
  );
}