/**
 * Error Display Component
 * 
 * Reusable error display component for showing error messages throughout the application.
 * Provides consistent error presentation with retry functionality and proper accessibility.
 * 
 * Usage:
 * - API request failures
 * - Form validation errors
 * - Network connectivity issues
 * - Permission denied errors
 * 
 * Design Features:
 * - Clear error messaging
 * - Optional retry functionality
 * - Accessible error announcements
 * - Consistent visual styling
 */

import React from 'react';

interface ErrorDisplayProps {
  error: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
  variant?: 'inline' | 'card' | 'banner';
}

/**
 * ErrorDisplay Component
 * 
 * Displays error messages with optional retry functionality.
 * Automatically announces errors to screen readers for accessibility.
 * 
 * @param error - Error message to display
 * @param onRetry - Optional retry function
 * @param retryLabel - Custom retry button label
 * @param className - Additional CSS classes
 * @param variant - Display style variant
 */
export function ErrorDisplay({
  error,
  onRetry,
  retryLabel = 'Try Again',
  className = '',
  variant = 'card'
}: ErrorDisplayProps) {
  // Variant-specific styling
  const variantClasses = {
    inline: 'text-red-600 text-sm',
    card: 'bg-red-50 border border-red-200 rounded-lg p-4',
    banner: 'bg-red-100 border-l-4 border-red-500 p-4',
  };

  const baseClasses = variantClasses[variant];

  return (
    <div
      className={`${baseClasses} ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start">
        {/* Error Icon */}
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-red-400"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        {/* Error Content */}
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">
            Something went wrong
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <p>{error}</p>
          </div>

          {/* Retry Button */}
          {onRetry && (
            <div className="mt-4">
              <button
                type="button"
                onClick={onRetry}
                className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
              >
                {retryLabel}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Form Error Component
 * 
 * Specialized error display for form validation errors.
 * Designed to work with form fields and validation messages.
 */
export function FormError({ error, className = '' }: { error: string; className?: string }) {
  if (!error) return null;

  return (
    <div className={`mt-1 text-sm text-red-600 ${className}`} role="alert">
      {error}
    </div>
  );
}

/**
 * Network Error Component
 * 
 * Specialized error display for network connectivity issues.
 * Provides specific messaging and retry functionality for network errors.
 */
export function NetworkError({ onRetry }: { onRetry: () => void }) {
  return (
    <ErrorDisplay
      error="Unable to connect to the server. Please check your internet connection and try again."
      onRetry={onRetry}
      retryLabel="Retry Connection"
      variant="banner"
    />
  );
}

/**
 * Permission Error Component
 * 
 * Specialized error display for permission/authorization errors.
 * Provides clear messaging about access restrictions.
 */
export function PermissionError() {
  return (
    <div className="text-center py-12">
      <svg
        className="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
      <h3 className="mt-2 text-sm font-medium text-gray-900">Access Denied</h3>
      <p className="mt-1 text-sm text-gray-500">
        You don't have permission to access this resource.
      </p>
    </div>
  );
}

/**
 * Not Found Error Component
 * 
 * Specialized error display for 404/not found errors.
 * Provides clear messaging when requested resources don't exist.
 */
export function NotFoundError({ resource = 'page' }: { resource?: string }) {
  return (
    <div className="text-center py-12">
      <svg
        className="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <h3 className="mt-2 text-sm font-medium text-gray-900">
        {resource.charAt(0).toUpperCase() + resource.slice(1)} Not Found
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        The {resource} you're looking for doesn't exist or has been moved.
      </p>
    </div>
  );
}
