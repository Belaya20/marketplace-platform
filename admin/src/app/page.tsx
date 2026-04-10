// src/app/page.tsx
// Root path redirects to dashboard.
// Middleware will redirect to /login if not authenticated.
import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/dashboard');
}