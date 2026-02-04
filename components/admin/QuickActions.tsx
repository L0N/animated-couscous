/**
 * Quick Actions Component
 * 
 * Displays pending loan applications and provides quick action buttons.
 * Allows admins to quickly navigate to loan approval workflows.
 * 
 * Features:
 * - Pending loans list
 * - Quick navigation to loan details
 * - Action buttons for common tasks
 * - Loading states
 */

'use client';

import Link from 'next/link';
import { AdminLoanData } from '@/lib/hooks/useAdminApi';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { 
  EyeIcon,
  ClockIcon,
  UserIcon
} from '@heroicons/react/24/outline';

interface QuickActionsProps {
  pendingLoans: AdminLoanData[];
  loading: boolean;
}

export default function QuickActions({ pendingLoans, loading }: QuickActionsProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Pending Approvals
        </h3>
        <Link
          href="/admin/loans?status=applied"
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          View All
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="medium" />
        </div>
      ) : pendingLoans.length === 0 ? (
        <div className="text-center py-8">
          <ClockIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No pending loan applications</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingLoans.slice(0, 5).map((loan) => (
            <div
              key={loan._id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {loan.customer.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    K{loan.amount.toLocaleString()} • {loan.termDays} days
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">
                  {loan.reference}
                </span>
                <Link
                  href={`/admin/loans/${loan._id}`}
                  className="p-1 text-blue-600 hover:text-blue-800"
                >
                  <EyeIcon className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
          
          {pendingLoans.length > 5 && (
            <div className="text-center pt-2">
              <Link
                href="/admin/loans?status=applied"
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View {pendingLoans.length - 5} more pending loans
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Quick Action Buttons */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/admin/loans"
            className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Manage Loans
          </Link>
          <Link
            href="/admin/customers"
            className="flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            View Customers
          </Link>
        </div>
      </div>
    </div>
  );
}
