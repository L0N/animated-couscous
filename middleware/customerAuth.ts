/**
 * Customer Authentication Middleware
 * 
 * Provides authentication and authorization for customer-facing APIs
 * - JWT token validation
 * - User role verification
 * - Request context enhancement
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { UserRole } from '@/types';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    name: string;
    currentLimit: number;
    isTrustworthy: boolean;
  };
}

/**
 * Extract JWT token from Authorization header
 */
function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Verify JWT token and extract user information
 */
async function verifyToken(token: string): Promise<any> {
  try {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      throw new Error('JWT secret not configured');
    }
    
    return jwt.verify(token, secret);
  } catch (error) {
    throw new Error('Invalid token');
  }
}

/**
 * Customer authentication middleware
 */
export async function authenticateCustomer(request: NextRequest): Promise<{
  success: boolean;
  user?: any;
  error?: string;
  response?: NextResponse;
}> {
  try {
    // Extract token
    const token = extractToken(request);
    if (!token) {
      return {
        success: false,
        error: 'No authorization token provided',
        response: NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      };
    }

    // Verify token
    const decoded = await verifyToken(token);
    if (!decoded || !decoded.sub) {
      return {
        success: false,
        error: 'Invalid token payload',
        response: NextResponse.json(
          { error: 'Invalid authentication token' },
          { status: 401 }
        )
      };
    }

    // Connect to database
    await connectDB();

    // Fetch user from database
    const user = await User.findById(decoded.sub).select('-password');
    if (!user) {
      return {
        success: false,
        error: 'User not found',
        response: NextResponse.json(
          { error: 'User not found' },
          { status: 401 }
        )
      };
    }

    // Verify user is a customer
    if (user.role !== UserRole.CUSTOMER) {
      return {
        success: false,
        error: 'Insufficient permissions',
        response: NextResponse.json(
          { error: 'Customer access required' },
          { status: 403 }
        )
      };
    }

    return {
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        name: user.name,
        currentLimit: user.currentLimit,
        isTrustworthy: user.isTrustworthy,
        status: user.status,
        consecutiveOnTimePayments: user.consecutiveOnTimePayments,
        kycVerified: user.kyc?.verified || false
      }
    };

  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: 'Authentication failed',
      response: NextResponse.json(
        { error: 'Authentication failed' },
        { status: 500 }
      )
    };
  }
}

/**
 * Higher-order function to wrap API handlers with customer authentication
 */
export function withCustomerAuth(
  handler: (request: NextRequest, user: any) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const authResult = await authenticateCustomer(request);
    
    if (!authResult.success) {
      return authResult.response!;
    }

    return handler(request, authResult.user);
  };
}

/**
 * Middleware for checking KYC verification status
 */
export function requireKYCVerification(
  handler: (request: NextRequest, user: any) => Promise<NextResponse>
) {
  return withCustomerAuth(async (request: NextRequest, user: any) => {
    if (!user.kycVerified) {
      return NextResponse.json(
        { 
          error: 'KYC verification required',
          message: 'Please complete your KYC verification before proceeding'
        },
        { status: 403 }
      );
    }

    return handler(request, user);
  });
}

/**
 * Rate limiting configuration for customer endpoints
 */
export const CUSTOMER_RATE_LIMITS = {
  LOAN_APPLICATION: 3, // 3 applications per hour
  PAYMENT_SUBMISSION: 10, // 10 payments per hour
  DASHBOARD_ACCESS: 60, // 60 requests per hour
  GENERAL: 30, // 30 requests per hour for other endpoints
} as const;
