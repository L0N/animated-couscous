/**
 * Admin Loan Detail Page
 * 
 * Comprehensive loan detail view with approval/rejection workflow.
 * Displays complete loan information, customer details, KYC documents, and payment history.
 * Implements business rules for loan approval based on amount and trustworthy status.
 * 
 * Business Rules Enforced:
 * - Loans ≤ K300: Auto-approval if pool funds sufficient
 * - Loans > K300: Auto-approve if trustworthy, else require admin approval
 * - Customers with defaults are blocked from borrowing
 * - All approvals trigger email notifications to customer and admin
 * 
 * Data Flow:
 * 1. Fetch loan details with customer and payment information
 * 2. Display comprehensive loan overview with status-specific actions
 * 3. Handle approval/rejection with business rule validation
 * 4. Update loan status and trigger notifications
 * 5. Redirect to loan list with success confirmation
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAdminLoanDetail, useApproveLoan, useRejectLoan } from '@/lib/hooks/useAdminApi';
import LoanDetails from '@/components/admin/LoanDetails';
import ApprovalForm from '@/components/admin/ApprovalForm';
import DocumentViewer from '@/components/admin/DocumentViewer';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';

export default function AdminLoanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const loanId = params.id as string;

  const { 
    loan, 
    loading: loanLoading, 
    error: loanError, 
    fetchLoanDetail 
  } = useAdminLoanDetail();

  const {
    approveLoan,
    loading: approveLoading,
    error: approveError
  } = useApproveLoan();

  const {
    rejectLoan,
    loading: rejectLoading,
    error: rejectError
  } = useRejectLoan();

  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [showRejectionForm, setShowRejectionForm] = useState(false);

  useEffect(() => {
    if (loanId) {
      fetchLoanDetail(loanId);
    }
  }, [loanId, fetchLoanDetail]);

  const handleApprove = async (notes?: string) => {
    try {
      await approveLoan(loanId, { notes });
      setShowApprovalForm(false);
      // Refresh loan data to show updated status
      await fetchLoanDetail(loanId);
    } catch (error) {
      console.error('Failed to approve loan:', error);
    }
  };

  const handleReject = async (reason: string, notes?: string) => {
    try {
      await rejectLoan(loanId, { reason, notes });
      setShowRejectionForm(false);
      // Refresh loan data to show updated status
      await fetchLoanDetail(loanId);
    } catch (error) {
      console.error('Failed to reject loan:', error);
    }
  };

  const handleBackToLoans = () => {
    router.push('/admin/loans');
  };

  if (loanLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (loanError || !loan) {
    return (
      <ErrorDisplay 
        message="Failed to load loan details" 
        onRetry={() => fetchLoanDetail(loanId)}
      />
    );
  }

  const canApprove = loan.status === 'applied';
  const canReject = loan.status === 'applied';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={handleBackToLoans}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-2"
          >
            ← Back to Loans
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            Loan Details - {loan.reference}
          </h1>
          <p className="text-gray-600 mt-1">
            Review loan application and customer information
          </p>
        </div>

        {/* Action Buttons */}
        {canApprove && (
          <div className="flex space-x-3">
            <button
              onClick={() => setShowRejectionForm(true)}
              disabled={rejectLoading}
              className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {rejectLoading ? 'Rejecting...' : 'Reject'}
            </button>
            <button
              onClick={() => setShowApprovalForm(true)}
              disabled={approveLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {approveLoading ? 'Approving...' : 'Approve'}
            </button>
          </div>
        )}
      </div>

      {/* Error Messages */}
      {approveError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{approveError}</p>
        </div>
      )}
      {rejectError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{rejectError}</p>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Loan Details - Takes up 2 columns */}
        <div className="lg:col-span-2">
          <LoanDetails loan={loan} />
        </div>

        {/* Document Viewer - Takes up 1 column */}
        <div>
          <DocumentViewer 
            customer={loan.customer}
            loanId={loan._id}
          />
        </div>
      </div>

      {/* Approval Form Modal */}
      {showApprovalForm && (
        <ApprovalForm
          loan={loan}
          onApprove={handleApprove}
          onCancel={() => setShowApprovalForm(false)}
          loading={approveLoading}
        />
      )}

      {/* Rejection Form Modal */}
      {showRejectionForm && (
        <ApprovalForm
          loan={loan}
          onReject={handleReject}
          onCancel={() => setShowRejectionForm(false)}
          loading={rejectLoading}
          isRejection={true}
        />
      )}
    </div>
  );
}
