/**
 * Loan Details Component
 * 
 * Displays comprehensive loan information including customer details, loan terms,
 * payment history, and business rule compliance indicators.
 * 
 * Business Rules Displayed:
 * - Trustworthy status computation (≥5 on-time payments over K200, zero defaults)
 * - Auto-approval eligibility based on amount and trustworthy status
 * - Default status and grace period calculations
 * - Global loan pool impact assessment
 * 
 * Data Flow:
 * 1. Receive loan object with customer and payment data
 * 2. Calculate derived metrics (days overdue, payment history, etc.)
 * 3. Display loan overview, customer info, and payment timeline
 * 4. Show business rule compliance and approval recommendations
 */

'use client';

import { AdminLoanDetailData } from '@/lib/hooks/useAdminApi';
import StatusBadge from '@/components/admin/StatusBadge';
import { 
  CalendarIcon,
  CurrencyDollarIcon,
  UserIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';

interface LoanDetailsProps {
  loan: AdminLoanDetailData;
}

export default function LoanDetails({ loan }: LoanDetailsProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return `K${amount.toLocaleString()}`;
  };

  const calculateDaysOverdue = () => {
    if (loan.status !== 'overdue' && loan.status !== 'defaulted') return 0;
    const dueDate = new Date(loan.dueDate);
    const today = new Date();
    return Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getAutoApprovalEligibility = () => {
    if (loan.amount <= 300) {
      return {
        eligible: true,
        reason: 'Loan amount ≤ K300 - Auto-approval eligible if pool funds sufficient'
      };
    } else if (loan.customer.isTrustworthy) {
      return {
        eligible: true,
        reason: 'Customer is trustworthy - Auto-approval eligible for any amount'
      };
    } else {
      return {
        eligible: false,
        reason: 'Loan > K300 and customer not trustworthy - Requires admin approval'
      };
    }
  };

  const getTrustworthyStatusExplanation = () => {
    const onTimeCount = loan.customer.onTimeCount || 0;
    const hasDefaults = loan.customer.hasDefaults || false;
    
    if (hasDefaults) {
      return 'Customer has previous defaults - Trustworthy status blocked';
    } else if (onTimeCount >= 5) {
      return `Customer has ${onTimeCount} consecutive on-time payments over K200 - Trustworthy status earned`;
    } else {
      return `Customer has ${onTimeCount}/5 required on-time payments over K200 - Trustworthy status pending`;
    }
  };

  const daysOverdue = calculateDaysOverdue();
  const autoApproval = getAutoApprovalEligibility();

  return (
    <div className="space-y-6">
      {/* Loan Overview Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Loan Overview</h2>
          <StatusBadge status={loan.status} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex items-center space-x-3">
            <CurrencyDollarIcon className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Principal Amount</p>
              <p className="font-semibold">{formatCurrency(loan.amount)}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <CurrencyDollarIcon className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Total Repayable</p>
              <p className="font-semibold">{formatCurrency(loan.totalRepayable)}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <ClockIcon className="w-5 h-5 text-gray-600" />
            <div>
              <p className="text-sm text-gray-600">Term</p>
              <p className="font-semibold">{loan.termDays} days</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <CalendarIcon className="w-5 h-5 text-gray-600" />
            <div>
              <p className="text-sm text-gray-600">Applied Date</p>
              <p className="font-semibold">{formatDate(loan.appliedAt)}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <CalendarIcon className="w-5 h-5 text-red-600" />
            <div>
              <p className="text-sm text-gray-600">Due Date</p>
              <p className="font-semibold">{formatDate(loan.dueDate)}</p>
              {daysOverdue > 0 && (
                <p className="text-xs text-red-600">{daysOverdue} days overdue</p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="w-5 h-5 text-gray-600">%</div>
            <div>
              <p className="text-sm text-gray-600">Interest Rate</p>
              <p className="font-semibold">{(loan.interestRate * 100).toFixed(1)}%</p>
            </div>
          </div>
        </div>

        {/* Auto-Approval Status */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-2">
            {autoApproval.eligible ? (
              <CheckCircleIcon className="w-5 h-5 text-green-600" />
            ) : (
              <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600" />
            )}
            <span className="text-sm font-medium text-gray-900">Auto-Approval Status:</span>
          </div>
          <p className="text-sm text-gray-600 mt-1">{autoApproval.reason}</p>
        </div>
      </div>

      {/* Customer Information Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Customer Information</h2>
          {loan.customer.isTrustworthy && (
            <div className="flex items-center space-x-1 text-green-600">
              <ShieldCheckIcon className="w-5 h-5" />
              <span className="text-sm font-medium">Trustworthy</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center space-x-3">
            <UserIcon className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Name</p>
              <p className="font-semibold">{loan.customer.name}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="w-5 h-5 text-blue-600">@</div>
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p className="font-semibold">{loan.customer.email}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="w-5 h-5 text-blue-600">📱</div>
            <div>
              <p className="text-sm text-gray-600">Phone</p>
              <p className="font-semibold">{loan.customer.phone}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <CurrencyDollarIcon className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Current Limit</p>
              <p className="font-semibold">{formatCurrency(loan.customer.currentLimit)}</p>
            </div>
          </div>
        </div>

        {/* Trustworthy Status Explanation */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center space-x-2">
            <ShieldCheckIcon className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-900">Trustworthy Status:</span>
          </div>
          <p className="text-sm text-gray-600 mt-1">{getTrustworthyStatusExplanation()}</p>
        </div>

        {/* KYC Status */}
        {loan.customer.kyc && (
          <div className="mt-4 p-3 bg-green-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <CheckCircleIcon className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-900">KYC Status:</span>
              <span className="text-sm text-green-600">
                {loan.customer.kyc.verified ? 'Verified' : 'Pending Verification'}
              </span>
            </div>
            {loan.customer.kyc.idType && (
              <p className="text-sm text-gray-600 mt-1">
                ID Type: {loan.customer.kyc.idType} • Number: {loan.customer.kyc.idNumber}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Payment History Card */}
      {loan.payments && loan.payments.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment History</h2>
          <div className="space-y-3">
            {loan.payments.map((payment, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{formatCurrency(payment.amount)}</p>
                  <p className="text-sm text-gray-600">{formatDate(payment.createdAt)}</p>
                </div>
                <div className="text-right">
                  <StatusBadge status={payment.status} />
                  {payment.verifiedAt && (
                    <p className="text-xs text-green-600 mt-1">
                      Verified: {formatDate(payment.verifiedAt)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin Notes */}
      {loan.adminNotes && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Admin Notes</h2>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-gray-800">{loan.adminNotes}</p>
          </div>
        </div>
      )}
    </div>
  );
}
