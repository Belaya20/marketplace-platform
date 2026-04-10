// src/proxy.ts
// Runs at Edge before every request.
// Protects every route except /login.
// Reads admin_token cookie — if missing/invalid, redirects to /login.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/_next', '/favicon.ico', '/api'];

/**
 * In Next.js 16+, the function must be named 'proxy' when using the proxy.ts convention.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths through without auth check
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  // Check for admin_token cookie
  const token = request.cookies.get('admin_token')?.value;

  if (!token) {
    // No token → redirect to login with return URL
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Token exists — allow through.
  // The API will validate it fully on every request.
  // If it's expired/invalid, the axios interceptor redirects to /login.
  return NextResponse.next();
}

export const config = {
  // Match everything except static files
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};