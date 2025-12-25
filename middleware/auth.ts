import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserRole } from '@/types';

/**
 * Require authentication for API routes
 */
export async function requireAuth() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      ),
    };
  }

  return {
    authorized: true,
    session,
    userId: session.user.id,
    userRole: session.user.role,
  };
}

/**
 * Require customer role
 */
export async function requireCustomer() {
  const auth = await requireAuth();

  if (!auth.authorized) {
    return auth;
  }

  if (auth.userRole !== UserRole.CUSTOMER) {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: 'Forbidden - Customer access only' },
        { status: 403 }
      ),
    };
  }

  return auth;
}

/**
 * Require admin role
 */
export async function requireAdmin() {
  const auth = await requireAuth();

  if (!auth.authorized) {
    return auth;
  }

  if (auth.userRole !== UserRole.ADMIN) {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: 'Forbidden - Admin access only' },
        { status: 403 }
      ),
    };
  }

  return auth;
}

/**
 * Helper to extract user ID from session
 */
export function getUserId(session: any): string {
  return session?.user?.id || '';
}

/**
 * Helper to check if user is admin
 */
export function isAdmin(session: any): boolean {
  return session?.user?.role === UserRole.ADMIN;
}

/**
 * Helper to check if user is customer
 */
export function isCustomer(session: any): boolean {
  return session?.user?.role === UserRole.CUSTOMER;
}

