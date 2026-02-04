/**
 * Customer Loan History Page
 * 
 * Displays paginated loan history with filtering and payment details.
 * Provides comprehensive view of all customer loan activity.
 * 
 * Data Sources:
 * - Customer loans API (/api/customer/loans)
 * - Paginated loan history with payment details
 * - Loan status tracking and payment history
 * 
 * Business Logic:
 * - Shows all loans regardless of status
 * - Displays payment history for each loan
 * - Provides loan status tracking
 * - Enables navigation to payment upload
 * 
 * User Experience:
 * - Clean table layout with responsive design
 * - Pagination for large loan histories
 * - Status badges for quick identification
 * - Payment details expansion
 */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useLoanHistory } from '@/lib/hooks/useCustomerApi';
import { LoadingSpinner, PageLoading } from '@/components/ui/LoadingSpinner';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';

/**
 * Customer Loan History Page Component
 * 
 * Renders paginated loan history with filtering and payment details.
 * Handles loading states and provides navigation to related actions.
 */
export default function LoanHistoryPage() {
  const { data: session, status } = useSession();
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);
  
  const { data: loanData, loading, error, refetch } = useLoanHistory(currentPage, 10);

  /**
   * Get Status Badge Color
   * 
   * Returns appropriate CSS classes for loan status badges.
   */
  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'applied':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      case 'disbursed':
        return 'bg-green-100 text-green-800';
      case 'repaid':
        return 'bg-gray-100 text-gray-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      case 'defaulted':
        return 'bg-red-200 text-red-900';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  /**
   * Get Payment Status Badge Color
   * 
   * Returns appropriate CSS classes for payment status badges.
   */
  const getPaymentStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'verified':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  /**
   * Toggle Loan Details Expansion
   * 
   * Expands or collapses payment details for a specific loan.
   */
  const toggleLoanExpansion = (loanId: string) => {
    setExpandedLoan(expandedLoan === loanId ? null : loanId);
  };

  /**
   * Handle Page Change
   * 
   * Updates current page and refetches loan data.
   */
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    refetch(newPage);
  };

  // Show loading state
  if (status === 'loading' || loading) {
    return <PageLoading />;
  }

  // Handle unauthenticated users
  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">Please log in to view your loan history.</p>
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
            onRetry={() => refetch(currentPage)}
            variant="banner"
          />
        </div>
      </div>
    );
  }

  const loans = loanData?.loans || [];
  const pagination = loanData?.pagination;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Loan History</h1>
              <p className="text-gray-600">View all your loan applications and payments</p>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/customer/apply"
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
              >
                Apply for Loan
              </Link>
              <Link
                href="/customer/dashboard"
                className="text-indigo-600 hover:text-indigo-500 font-medium"
              >
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {loans.length === 0 ? (
          /* Empty State */
          <div className="bg-white shadow rounded-lg">
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No loans found</h3>
              <p className="mt-1 text-sm text-gray-500">
                You haven't applied for any loans yet.
              </p>
              <div className="mt-6">
                <Link
                  href="/customer/apply"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Apply for your first loan
                </Link>
              </div>
            </div>
          </div>
        ) : (
          /* Loan History Table */
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:p-6">
              <div className="space-y-4">
                {loans.map((loan) => (
                  <div key={loan.id} className="border border-gray-200 rounded-lg">
                    {/* Loan Summary Row */}
                    <div
                      className="p-4 cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleLoanExpansion(loan.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{loan.reference}</p>
                            <p className="text-sm text-gray-500">
                              Applied: {new Date(loan.appliedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Amount</p>
                            <p className="text-sm font-medium text-gray-900">K{loan.amount}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Status</p>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(
                                loan.status
                              )}`}
                            >
                              {loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Balance</p>
                            <p className="text-sm font-medium text-gray-900">
                              K{loan.remainingBalance.toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <div className="ml-4">
                          <svg
                            className={`h-5 w-5 text-gray-400 transform transition-transform ${
                              expandedLoan === loan.id ? 'rotate-180' : ''
                            }`}
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Loan Details */}
                    {expandedLoan === loan.id && (
                      <div className="border-t border-gray-200 bg-gray-50 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Loan Details */}
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 mb-3">Loan Details</h4>
                            <dl className="space-y-2">
                              <div className="flex justify-between">
                                <dt className="text-sm text-gray-500">Term:</dt>
                                <dd className="text-sm text-gray-900">{loan.termDays} days</dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-sm text-gray-500">Interest Rate:</dt>
                                <dd className="text-sm text-gray-900">
                                  {(loan.interestRate * 100).toFixed(1)}%
                                </dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-sm text-gray-500">Total Repayable:</dt>
                                <dd className="text-sm text-gray-900">K{loan.totalRepayable}</dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-sm text-gray-500">Due Date:</dt>
                                <dd className="text-sm text-gray-900">
                                  {new Date(loan.dueDate).toLocaleDateString()}
                                </dd>
                              </div>
                              {loan.repaidAt && (
                                <div className="flex justify-between">
                                  <dt className="text-sm text-gray-500">Repaid:</dt>
                                  <dd className="text-sm text-gray-900">
                                    {new Date(loan.repaidAt).toLocaleDateString()}
                                  </dd>
                                </div>
                              )}
                            </dl>
                          </div>

                          {/* Payment History */}
                          <div>
                            <div className="flex justify-between items-center mb-3">
                              <h4 className="text-sm font-medium text-gray-900">Payment History</h4>
                              {loan.status === 'disbursed' && loan.remainingBalance > 0 && (
                                <Link
                                  href={`/customer/payments/upload?loanId=${loan.id}`}
                                  className="text-sm text-indigo-600 hover:text-indigo-500"
                                >
                                  Upload Payment
                                </Link>
                              )}
                            </div>
                            {loan.payments && loan.payments.length > 0 ? (
                              <div className="space-y-2">
                                {loan.payments.map((payment) => (
                                  <div
                                    key={payment.id}
                                    className="flex justify-between items-center p-2 bg-white rounded border"
                                  >
                                    <div>
                                      <p className="text-sm font-medium text-gray-900">
                                        K{payment.amount}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {new Date(payment.submittedAt).toLocaleDateString()}
                                      </p>
                                    </div>
                                    <span
                                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(
                                        payment.status
                                      )}`}
                                    >
                                      {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">No payments submitted yet</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={!pagination.hasPrevPage}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={!pagination.hasNextPage}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing{' '}
                        <span className="font-medium">
                          {(currentPage - 1) * pagination.limit + 1}
                        </span>{' '}
                        to{' '}
                        <span className="font-medium">
                          {Math.min(currentPage * pagination.limit, pagination.totalCount)}
                        </span>{' '}
                        of <span className="font-medium">{pagination.totalCount}</span> loans
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={!pagination.hasPrevPage}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                        >
                          Previous
                        </button>
                        {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                          .filter(
                            (page) =>
                              page === 1 ||
                              page === pagination.totalPages ||
                              Math.abs(page - currentPage) <= 2
                          )
                          .map((page, index, array) => (
                            <React.Fragment key={page}>
                              {index > 0 && array[index - 1] !== page - 1 && (
                                <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                  ...
                                </span>
                              )}
                              <button
                                onClick={() => handlePageChange(page)}
                                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                  page === currentPage
                                    ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                                    : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                }`}
                              >
                                {page}
                              </button>
                            </React.Fragment>
                          ))}
                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={!pagination.hasNextPage}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                        >
                          Next
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
