// src/app/layout.tsx
// Root layout — no sidebar, no auth here.
// Auth + sidebar live in dashboard/layout.tsx.
// This is intentionally a SERVER component (no 'use client').
import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';

const inter = Inter({
  subsets:  ['latin'],
  // FIX: preload only Latin to reduce font payload
  display:  'swap',
  // FIX: variable font — single file covers all weights
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title:       'AddisMarket Admin',
  description: 'AddisMarket administration panel',
  robots:      'noindex, nofollow', // Admin must never appear in search results
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans bg-gray-50 text-gray-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}