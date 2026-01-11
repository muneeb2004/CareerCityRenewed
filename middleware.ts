import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './src/lib/jwt';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /staff routes
  if (pathname.startsWith('/staff')) {
    // Exclude /staff/login
    if (pathname === '/staff/login') {
        // Optional: If already logged in, redirect to /staff
        const token = request.cookies.get('staff_session')?.value;
        if (token) {
            const payload = await verifyToken(token);
            if (payload) {
                 return NextResponse.redirect(new URL('/staff', request.url));
            }
        }
        return NextResponse.next();
    }

    const token = request.cookies.get('staff_session')?.value;

    if (!token) {
      return NextResponse.redirect(new URL('/staff/login', request.url));
    }

    const payload = await verifyToken(token);
    if (!payload) {
        // Token invalid
       return NextResponse.redirect(new URL('/staff/login', request.url));
    }

    // Admin-only routes protection
    if (pathname.startsWith('/staff/users')) {
      if (payload.role !== 'admin') {
        // Non-admin trying to access user management - redirect to dashboard
        return NextResponse.redirect(new URL('/staff', request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/staff/:path*'],
};
