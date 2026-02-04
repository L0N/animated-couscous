/**
 * Loading Spinner Component
 * 
 * Reusable loading indicator for async operations throughout the application.
 * Provides consistent visual feedback during data fetching and form submissions.
 * 
 * Usage:
 * - API request loading states
 * - Form submission feedback
 * - Page transitions
 * - Component initialization
 * 
 * Design Features:
 * - Smooth CSS animation
 * - Configurable size and color
 * - Accessible with screen reader support
 * - Minimal performance impact
 */

import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'white' | 'gray';
  className?: string;
}

/**
 * LoadingSpinner Component
 * 
 * Displays an animated spinning circle to indicate loading state.
 * Automatically includes accessibility attributes for screen readers.
 * 
 * @param size - Spinner size (sm: 16px, md: 24px, lg: 32px)
 * @param color - Spinner color theme
 * @param className - Additional CSS classes
 */
export function LoadingSpinner({ 
  size = 'md', 
  color = 'primary', 
  className = '' 
}: LoadingSpinnerProps) {
  // Size classes mapping
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  // Color classes mapping
  const colorClasses = {
    primary: 'text-indigo-600',
    white: 'text-white',
    gray: 'text-gray-400',
  };

  return (
    <div
      className={`inline-block animate-spin rounded-full border-2 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite] ${sizeClasses[size]} ${colorClasses[color]} ${className}`}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

/**
 * Full Page Loading Component
 * 
 * Displays a centered loading spinner for full page loading states.
 * Used during initial app load or major route transitions.
 */
export function PageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

/**
 * Inline Loading Component
 * 
 * Displays a small loading spinner for inline loading states.
 * Used within buttons, form fields, or small content areas.
 */
export function InlineLoading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex items-center space-x-2">
      <LoadingSpinner size="sm" />
      <span className="text-sm text-gray-600">{message}</span>
    </div>
  );
}
