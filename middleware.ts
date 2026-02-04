/**
 * Next.js Middleware for Route Protection
 * 
 * Handles authentication and role-based access control for protected routes.
 * Runs on every request to protected paths and redirects unauthorized users.
 * 
 * Data Flow:
 * 1. Request intercepted by middleware
 * 2. Check if route requires authentication
 * 3. Verify NextAuth.js session token
 * 4. Validate user role for admin routes
 * 5. Allow access or redirect to login
 * 
 * Protected Routes:
 * - /customer/* - Requires customer or admin role
 * - /admin/* - Requires admin role only
 * - /api/customer/* - Requires customer or admin role
 * - /api/admin/* - Requires admin role only
 * 
 * Security Features:
 * - JWT token validation
 * - Role-based access control
 * - Automatic redirects for unauthorized access
 * - API route protection
 */

import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

/**
 * Middleware function with NextAuth.js integration
 * 
 * Protects routes based on authentication status and user roles.
 * Automatically redirects unauthenticated users to login page.
 */
export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // Admin routes - require admin role
    if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
      if (token?.role !== 'admin') {
        // Redirect non-admin users to customer dashboard or login
        if (token?.role === 'customer') {
          return NextResponse.redirect(new URL('/customer/dashboard', req.url));
        }
        return NextResponse.redirect(new URL('/', req.url));
      }
    }

    // Customer routes - require customer or admin role
    if (pathname.startsWith('/customer') || pathname.startsWith('/api/customer')) {
      if (!token || (token.role !== 'customer' && token.role !== 'admin')) {
        return NextResponse.redirect(new URL('/', req.url));
      }
    }

    // Allow the request to proceed
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        
        // Public routes that don't require authentication
        if (pathname === '/' || pathname.startsWith('/api/auth')) {
          return true;
        }

        // Protected routes require a valid token
        return !!token;
      },
    },
  }
);

/**
 * Middleware Configuration
 * 
 * Specifies which routes should be processed by the middleware.
 * Includes both page routes and API routes for comprehensive protection.
 */
export const config = {
  matcher: [
    '/customer/:path*',
    '/admin/:path*',
    '/api/customer/:path*',
    '/api/admin/:path*',
  ],
};
