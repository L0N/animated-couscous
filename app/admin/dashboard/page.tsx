/**
 * Admin Dashboard Page
 * 
 * Main dashboard showing portfolio overview, key metrics, and quick actions.
 * Provides real-time insights into loan portfolio performance and health.
 * 
 * Features:
 * - Portfolio metrics (total loans, active loans, overdue, etc.)
 * - Quick action buttons for pending approvals
 * - Recent activity feed
 * - Performance indicators
 */

'use client';

import { useEffect, useState } from 'react';
import { useAdminLoans } from '@/lib/hooks/useAdminApi';
import MetricsCard from '@/components/admin/MetricsCard';
import QuickActions from '@/components/admin/QuickActions';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';

interface DashboardMetrics {
  totalLoans: number;
  activeLoans: number;
  pendingLoans: number;
  overdueLoans: number;
  totalDisbursed: number;
  totalRepaid: number;
  defaultRate: number;
  avgLoanAmount: number;
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const { 
    loans: allLoans, 
    loading: loansLoading, 
    error: loansError, 
    fetchLoans 
  } = useAdminLoans();

  const { 
    loans: pendingLoans, 
    loading: pendingLoading, 
    fetchLoans: fetchPendingLoans 
  } = useAdminLoans();

  useEffect(() => {
    // Fetch all loans for metrics
    fetchLoans({});
    
    // Fetch pending loans for quick actions
    fetchPendingLoans({ status: 'applied' });
  }, [fetchLoans, fetchPendingLoans]);

  useEffect(() => {
    if (allLoans) {
      calculateMetrics(allLoans.loans);
    }
  }, [allLoans]);

  const calculateMetrics = (loans: any[]) => {
    const totalLoans = loans.length;
    const activeLoans = loans.filter(loan => 
      ['approved', 'disbursed'].includes(loan.status)
    ).length;
    const pendingLoans = loans.filter(loan => loan.status === 'applied').length;
    const overdueLoans = loans.filter(loan => loan.status === 'overdue').length;
    const defaultedLoans = loans.filter(loan => loan.status === 'defaulted').length;
    
    const totalDisbursed = loans
      .filter(loan => ['disbursed', 'repaid', 'overdue', 'defaulted'].includes(loan.status))
      .reduce((sum, loan) => sum + loan.amount, 0);
    
    const totalRepaid = loans
      .filter(loan => loan.status === 'repaid')
      .reduce((sum, loan) => sum + loan.totalRepayable, 0);
    
    const defaultRate = totalLoans > 0 ? (defaultedLoans / totalLoans) * 100 : 0;
    const avgLoanAmount = totalLoans > 0 ? totalDisbursed / totalLoans : 0;

    setMetrics({
      totalLoans,
      activeLoans,
      pendingLoans,
      overdueLoans,
      totalDisbursed,
      totalRepaid,
      defaultRate,
      avgLoanAmount,
    });
  };

  if (loansLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (loansError) {
    return (
      <ErrorDisplay 
        message="Failed to load dashboard data" 
        onRetry={() => fetchLoans({})}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Portfolio overview and key performance indicators
        </p>
      </div>

      {/* Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricsCard
            title="Total Loans"
            value={metrics.totalLoans}
            icon="document"
            color="blue"
          />
          <MetricsCard
            title="Active Loans"
            value={metrics.activeLoans}
            icon="check"
            color="green"
          />
          <MetricsCard
            title="Pending Approval"
            value={metrics.pendingLoans}
            icon="clock"
            color="yellow"
          />
          <MetricsCard
            title="Overdue Loans"
            value={metrics.overdueLoans}
            icon="exclamation"
            color="red"
          />
          <MetricsCard
            title="Total Disbursed"
            value={`K${metrics.totalDisbursed.toLocaleString()}`}
            icon="currency"
            color="blue"
          />
          <MetricsCard
            title="Total Repaid"
            value={`K${metrics.totalRepaid.toLocaleString()}`}
            icon="currency"
            color="green"
          />
          <MetricsCard
            title="Default Rate"
            value={`${metrics.defaultRate.toFixed(1)}%`}
            icon="chart"
            color={metrics.defaultRate > 10 ? "red" : metrics.defaultRate > 5 ? "yellow" : "green"}
          />
          <MetricsCard
            title="Avg Loan Amount"
            value={`K${metrics.avgLoanAmount.toFixed(0)}`}
            icon="calculator"
            color="blue"
          />
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QuickActions 
          pendingLoans={pendingLoans?.loans || []}
          loading={pendingLoading}
        />
        
        {/* Recent Activity - Placeholder for now */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Recent Activity
          </h3>
          <div className="space-y-3">
            <div className="text-sm text-gray-600">
              <span className="font-medium">System:</span> Daily interest calculation completed
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">Auto-approval:</span> 3 loans auto-approved today
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">Reminders:</span> 12 payment reminders sent
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
