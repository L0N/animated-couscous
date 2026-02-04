/**
 * Authentication Provider Component
 * 
 * Provides NextAuth.js session management throughout the application.
 * Wraps the entire app to enable session access in all components.
 * 
 * Data Flow:
 * 1. NextAuth.js manages authentication state
 * 2. SessionProvider makes session available to all child components
 * 3. Components can access session via useSession hook
 * 
 * Security Features:
 * - Automatic session refresh
 * - Secure cookie management
 * - Role-based access control support
 */

'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider Component
 * 
 * Wraps the application with NextAuth.js SessionProvider to enable
 * authentication state management throughout the component tree.
 * 
 * @param children - Child components that need access to authentication state
 */
export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  );
}
