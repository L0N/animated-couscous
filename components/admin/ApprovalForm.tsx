/**
 * Approval Form Component
 * 
 * Modal form for loan approval and rejection workflows.
 * Handles both approval and rejection scenarios with appropriate validation.
 * 
 * Business Rules Enforced:
 * - Approval triggers email notifications to customer and admin
 * - Rejection requires a reason and optional notes
 * - Form validates required fields before submission
 * - Displays loan context and business rule compliance
 * 
 * Data Flow:
 * 1. Display loan summary and business rule context
 * 2. Collect approval/rejection data with validation
 * 3. Submit to parent component with proper error handling
 * 4. Show loading states during API calls
 */

'use client';

import { useState } from 'react';
import { AdminLoanDetailData } from '@/lib/hooks/useAdminApi';
import { 
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';

interface ApprovalFormProps {
  loan: AdminLoanDetailData;
  onApprove?: (notes?: string) => void;
  onReject?: (reason: string, notes?: string) => void;
  onCancel: () => void;
  loading: boolean;
  isRejection?: boolean;
}

const rejectionReasons = [
  'Insufficient documentation',
  'Customer does not meet eligibility criteria',
  'Loan amount exceeds customer limit',
  'Customer has outstanding defaults',
  'Incomplete KYC verification',
  'Suspicious activity detected',
  'Other (specify in notes)',
];

export default function ApprovalForm({ 
  loan, 
  onApprove, 
  onReject, 
  onCancel, 
  loading, 
  isRejection = false 
}: ApprovalFormProps) {
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const formatCurrency = (amount: number) => {
    return `K${amount.toLocaleString()}`;
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (isRejection && !rejectionReason) {
      newErrors.rejectionReason = 'Please select a rejection reason';
    }

    if (isRejection && rejectionReason === 'Other (specify in notes)' && !notes.trim()) {
      newErrors.notes = 'Please provide details in notes when selecting "Other"';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    if (isRejection && onReject) {
      onReject(rejectionReason, notes.trim() || undefined);
    } else if (!isRejection && onApprove) {
      onApprove(notes.trim() || undefined);
    }
  };

  const getAutoApprovalInfo = () => {
    if (loan.amount <= 300) {
      return {
        eligible: true,
        message: 'This loan is eligible for auto-approval (≤ K300)'
      };
    } else if (loan.customer.isTrustworthy) {
      return {
        eligible: true,
        message: 'This loan is eligible for auto-approval (trustworthy customer)'
      };
    } else {
      return {
        eligible: false,
        message: 'This loan requires manual approval (> K300, not trustworthy)'
      };
    }
  };

  const autoApprovalInfo = getAutoApprovalInfo();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            {isRejection ? (
              <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
            ) : (
              <CheckCircleIcon className="w-6 h-6 text-green-600" />
            )}
            <h2 className="text-xl font-semibold text-gray-900">
              {isRejection ? 'Reject Loan Application' : 'Approve Loan Application'}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
            disabled={loading}
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Loan Summary */}
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Loan Summary</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Customer</p>
              <p className="font-medium">{loan.customer.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Reference</p>
              <p className="font-medium">{loan.reference}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Amount</p>
              <p className="font-medium">{formatCurrency(loan.amount)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Term</p>
              <p className="font-medium">{loan.termDays} days</p>
            </div>
          </div>

          {/* Auto-Approval Status */}
          <div className="mt-4 p-3 bg-white rounded-lg border">
            <div className="flex items-center space-x-2">
              {autoApprovalInfo.eligible ? (
                <CheckCircleIcon className="w-5 h-5 text-green-600" />
              ) : (
                <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600" />
              )}
              <span className="text-sm font-medium text-gray-900">Business Rule:</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">{autoApprovalInfo.message}</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Rejection Reason */}
          {isRejection && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason *
              </label>
              <select
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
                  errors.rejectionReason ? 'border-red-300' : 'border-gray-300'
                }`}
                disabled={loading}
              >
                <option value="">Select a reason...</option>
                {rejectionReasons.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
              {errors.rejectionReason && (
                <p className="text-red-600 text-sm mt-1">{errors.rejectionReason}</p>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {isRejection ? 'Additional Notes' : 'Approval Notes'} 
              {isRejection && rejectionReason === 'Other (specify in notes)' && ' *'}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.notes ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder={
                isRejection 
                  ? 'Provide additional context for the rejection...'
                  : 'Add any notes about this approval (optional)...'
              }
              disabled={loading}
            />
            {errors.notes && (
              <p className="text-red-600 text-sm mt-1">{errors.notes}</p>
            )}
          </div>

          {/* Notification Info */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">
              {isRejection ? 'Rejection Notifications' : 'Approval Notifications'}
            </h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Customer will receive email notification</li>
              {!isRejection && (
                <li>• Admin will receive bank transfer instructions</li>
              )}
              <li>• Loan status will be updated automatically</li>
              <li>• All actions will be logged for audit trail</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                isRejection
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
              disabled={loading}
            >
              {loading 
                ? (isRejection ? 'Rejecting...' : 'Approving...') 
                : (isRejection ? 'Reject Loan' : 'Approve Loan')
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
