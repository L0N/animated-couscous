/**
 * NextAuth.js API Route Handler
 * 
 * Handles all authentication-related API requests including:
 * - Login/logout
 * - Session management
 * - JWT token handling
 * - Role-based authentication
 * 
 * Data Flow:
 * 1. Client sends authentication request
 * 2. NextAuth.js processes request using configured providers
 * 3. Credentials provider validates against MongoDB
 * 4. JWT token created with user role and ID
 * 5. Session returned to client
 * 
 * Security Features:
 * - Secure JWT token generation
 * - Password hashing validation
 * - Role-based session data
 * - Secure cookie configuration
 */

import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * NextAuth.js Route Handler
 * 
 * Handles all authentication endpoints:
 * - GET /api/auth/session - Get current session
 * - POST /api/auth/signin - Sign in user
 * - POST /api/auth/signout - Sign out user
 * - GET /api/auth/providers - Get available providers
 */
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
