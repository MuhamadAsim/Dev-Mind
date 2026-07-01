// ============================================================
// Route Protection Proxy (Next.js 16+ — previously "middleware")
// Reads the devmind_session cookie (set during mock login).
// REPLACE: When GitHub OAuth is added, verify a real JWT here.
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_KEYS, ROUTES } from '@/lib/constants';

// Next.js 16 requires the exported function to be named "proxy"
export function proxy(request: NextRequest) {
  const session = request.cookies.get(COOKIE_KEYS.SESSION);
  const { pathname } = request.nextUrl;

  const isProtected = pathname.startsWith('/workspace');
  const isAuthRoute = pathname === '/login';

  // Redirect unauthenticated users away from protected routes
  if (!session && isProtected) {
    return NextResponse.redirect(new URL(ROUTES.LOGIN, request.url));
  }

  // Redirect authenticated users away from login
  if (session && isAuthRoute) {
    return NextResponse.redirect(new URL(ROUTES.WORKSPACE, request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except static assets
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
