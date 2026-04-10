// src/middleware.ts
// Admin routes are completely removed — admin panel runs as a separate
// Next.js app on port 3001. The frontend (port 3000) has no admin routes.
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const role  = request.cookies.get('auth_role')?.value  || '';
  const token = request.cookies.get('auth_token')?.value || '';
  const authed = !!token;

  // Redirect logged-in users away from auth pages
  const authOnly = ['/login', '/register', '/forgot-password', '/verify-otp'];
  if (authOnly.some(p => pathname.startsWith(p)) && authed) {
    // Admin no longer has a route in this app — just redirect to home
    if (role === 'seller') return NextResponse.redirect(new URL('/seller/dashboard', request.url));
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Protect account & checkout
  if (['/account', '/checkout'].some(p => pathname.startsWith(p)) && !authed) {
    return NextResponse.redirect(new URL(`/login?redirect=${encodeURIComponent(pathname)}`, request.url));
  }

  // Protect seller routes — seller or above
  if (pathname.startsWith('/seller')) {
    if (!authed) return NextResponse.redirect(new URL('/login', request.url));
    if (role !== 'seller')
      return NextResponse.redirect(new URL('/', request.url));
  }

  // NOTE: /admin/* routes no longer exist in this app.
  // Admin panel is at http://localhost:3001 (dev) or admin.addismarket.et (prod)

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};