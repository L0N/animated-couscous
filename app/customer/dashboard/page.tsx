/**
 * Customer Dashboard Page
 * 
 * Main dashboard for customer users showing loan overview, tier progress,
 * active loans, and quick actions. Serves as the primary landing page
 * after customer login.
 * 
 * Data Sources:
 * - Customer dashboard API (/api/customer/dashboard)
 * - Real-time loan status updates
 * - Tier progression tracking
 * - Payment reminders and alerts
 * 
 * Business Logic:
 * - Displays current tier and progress to next tier
 * - Shows active loans with payment due dates
 * - Highlights overdue payments and alerts
 * - Provides quick access to loan application and payment upload
 * 
 * User Experience:
 * - Clean, card-based layout
 * - Clear visual hierarchy
 * - Responsive design for mobile access
 * - Loading states and error handling
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useDashboard } from '@/lib/hooks/useCustomerApi';
import { LoadingSpinner, PageLoading } from '@/components/ui/LoadingSpinner';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';

/**
 * Customer Dashboard Page Component
 * 
 * Renders the main customer dashboard with loan overview, tier information,
 * and quick action buttons. Handles loading states and error conditions.
 */
export default function CustomerDashboard() {
  const { data: session, status } = useSession();
  const { data: dashboard, loading, error, refetch } = useDashboard();

  // Show loading state while session or dashboard data loads
  if (status === 'loading' || loading) {
    return <PageLoading />;
  }

  // Handle authentication errors
  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">Please log in to access your dashboard.</p>
          <Link
            href="/"
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  // Handle API errors
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ErrorDisplay
            error={error}
            onRetry={refetch}
            variant="banner"
          />
        </div>
      </div>
    );
  }

  // Handle missing dashboard data
  if (!dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">No Data Available</h1>
          <p className="text-gray-600 mb-4">Unable to load dashboard information.</p>
          <button
            onClick={refetch}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { user, activeLoans, alerts, stats } = dashboard;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">WanPaus</h1>
              <p className="text-gray-600">Welcome back, {user.name}</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                {session?.user?.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="bg-gray-100 text-gray-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-200"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Alerts Section */}
        {alerts && alerts.length > 0 && (
          <div className="mb-6 space-y-4">
            {alerts.map((alert, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg ${
                  alert.priority === 'high'
                    ? 'bg-red-50 border border-red-200 text-red-800'
                    : alert.priority === 'medium'
                    ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                    : 'bg-blue-50 border border-blue-200 text-blue-800'
                }`}
              >
                <div className="flex">
                  <div className="flex-shrink-0">
                    {alert.priority === 'high' ? (
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium">{alert.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Current Limit</dt>
                    <dd className="text-lg font-medium text-gray-900">K{user.currentLimit}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Status</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {user.isTrustworthy ? (
                        <span className="text-green-600">Trustworthy</span>
                      ) : (
                        <span className="text-yellow-600">Building Credit</span>
                      )}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">On-Time Rate</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.onTimePaymentRate}%</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Loans</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.totalLoans}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Link
            href="/customer/apply"
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg p-6 text-center transition-colors"
          >
            <svg className="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <h3 className="text-lg font-medium mb-2">Apply for Loan</h3>
            <p className="text-indigo-100">Get quick access to funds up to K{user.currentLimit}</p>
          </Link>

          <Link
            href="/customer/payments/upload"
            className="bg-green-600 hover:bg-green-700 text-white rounded-lg p-6 text-center transition-colors"
          >
            <svg className="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <h3 className="text-lg font-medium mb-2">Upload Payment</h3>
            <p className="text-green-100">Submit payment proof for loan verification</p>
          </Link>
        </div>

        {/* Active Loans */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Active Loans</h3>
            
            {activeLoans && activeLoans.length > 0 ? (
              <div className="space-y-4">
                {activeLoans.map((loan) => (
                  <div key={loan.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">{loan.reference}</h4>
                        <p className="text-sm text-gray-500">Amount: K{loan.amount}</p>
                        <p className="text-sm text-gray-500">
                          Due: {new Date(loan.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          loan.status === 'approved' 
                            ? 'bg-yellow-100 text-yellow-800'
                            : loan.status === 'disbursed'
                            ? 'bg-blue-100 text-blue-800'
                            : loan.status === 'overdue'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}
                        </span>
                        <p className="text-sm text-gray-900 mt-1">
                          Balance: K{loan.remainingBalance}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No active loans</h3>
                <p className="mt-1 text-sm text-gray-500">
                  You don't have any active loans at the moment.
                </p>
                <div className="mt-6">
                  <Link
                    href="/customer/apply"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    Apply for a loan
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Links */}
        <div className="mt-8 flex justify-center space-x-6">
          <Link
            href="/customer/loans"
            className="text-indigo-600 hover:text-indigo-500 font-medium"
          >
            View Loan History
          </Link>
          <Link
            href="/customer/profile"
            className="text-indigo-600 hover:text-indigo-500 font-medium"
          >
            Manage Profile
          </Link>
        </div>
      </main>
    </div>
  );
}
