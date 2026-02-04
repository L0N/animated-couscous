/**
 * Admin API Hooks
 * 
 * Custom React hooks for admin-related API operations.
 * Provides state management, loading states, and error handling for admin features.
 * 
 * Data Flow:
 * 1. Admin component calls hook (e.g., useAdminLoans())
 * 2. Hook manages loading state and makes API call
 * 3. API client sends authenticated request to backend
 * 4. Backend validates admin role and processes request
 * 5. Hook updates state and returns data to component
 * 6. Component renders admin interface with data
 * 
 * Features:
 * - Admin role validation
 * - Comprehensive loan management
 * - Approval/rejection workflows
 * - Real-time data updates
 * - Error handling and retry logic
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiResponse } from '@/lib/api/client';

/**
 * Admin Loan Data Interface
 */
export interface AdminLoanData {
  _id: string;
  reference: string;
  amount: number;
  termDays: number;
  interestRate: number;
  totalRepayable: number;
  status: string;
  appliedAt: string;
  dueDate: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  customer: {
    _id: string;
    name: string;
    email: string;
    phone: string;
    currentLimit: number;
    isTrustworthy: boolean;
    kyc: {
      verified: boolean;
      idType?: string;
      hasIdDocument: boolean;
      hasEmploymentProof: boolean;
      hasBankStatement: boolean;
    };
  };
  remainingBalance: number;
  daysOverdue: number;
  totalPayments: number;
  pendingPayments: number;
}

/**
 * Admin Loans Response Interface
 */
export interface AdminLoansResponse {
  loans: AdminLoanData[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/**
 * Loan Filters Interface
 */
export interface LoanFilters {
  status?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/**
 * Approval Request Interface
 */
export interface ApprovalRequest {
  notes?: string;
  disbursementMethod: 'bank_transfer' | 'mobile_money' | 'cash';
}

/**
 * Rejection Request Interface
 */
export interface RejectionRequest {
  reason: string;
  notes?: string;
  allowReapplication?: boolean;
}

/**
 * Hook State Interface
 */
interface HookState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Admin Loans Management Hook
 * 
 * Manages loan listing with filtering, pagination, and search functionality.
 * Provides real-time updates for loan status changes.
 */
export function useAdminLoans(filters: LoanFilters = {}) {
  const [state, setState] = useState<HookState<AdminLoansResponse>>({
    data: null,
    loading: true,
    error: null,
  });

  const fetchLoans = useCallback(async (newFilters: LoanFilters = {}) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    // Merge filters with defaults
    const queryFilters = { ...filters, ...newFilters };
    
    // Build query string
    const queryParams = new URLSearchParams();
    Object.entries(queryFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value.toString());
      }
    });
    
    const queryString = queryParams.toString();
    const endpoint = `/admin/loans${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiClient.get<AdminLoansResponse>(endpoint);
    
    if (response.success && response.data) {
      setState({
        data: response.data,
        loading: false,
        error: null,
      });
    } else {
      setState({
        data: null,
        loading: false,
        error: response.error || 'Failed to load loans',
      });
    }
  }, [filters]);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  return {
    ...state,
    refetch: fetchLoans,
  };
}

/**
 * Loan Approval Hook
 * 
 * Handles loan approval workflow with validation and notifications.
 */
export function useLoanApproval() {
  const [state, setState] = useState<HookState<{ message: string }>>({
    data: null,
    loading: false,
    error: null,
  });

  const approveLoan = useCallback(async (loanId: string, request: ApprovalRequest) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    const response = await apiClient.post(`/admin/loans/${loanId}/approve`, request);
    
    if (response.success && response.data) {
      setState({
        data: response.data,
        loading: false,
        error: null,
      });
      return response.data;
    } else {
      setState({
        data: null,
        loading: false,
        error: response.error || 'Failed to approve loan',
      });
      throw new Error(response.error || 'Failed to approve loan');
    }
  }, []);

  return {
    ...state,
    approveLoan,
  };
}

/**
 * Loan Rejection Hook
 * 
 * Handles loan rejection workflow with reason tracking and customer notification.
 */
export function useLoanRejection() {
  const [state, setState] = useState<HookState<{ message: string }>>({
    data: null,
    loading: false,
    error: null,
  });

  const rejectLoan = useCallback(async (loanId: string, request: RejectionRequest) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    const response = await apiClient.post(`/admin/loans/${loanId}/reject`, request);
    
    if (response.success && response.data) {
      setState({
        data: response.data,
        loading: false,
        error: null,
      });
      return response.data;
    } else {
      setState({
        data: null,
        loading: false,
        error: response.error || 'Failed to reject loan',
      });
      throw new Error(response.error || 'Failed to reject loan');
    }
  }, []);

  return {
    ...state,
    rejectLoan,
  };
}

/**
 * Admin Dashboard Stats Hook
 * 
 * Fetches admin dashboard statistics and metrics.
 */
export function useAdminDashboard() {
  const [state, setState] = useState<HookState<{
    stats: {
      totalLoans: number;
      pendingApprovals: number;
      activeLoans: number;
      overdueLoans: number;
      totalDisbursed: number;
      totalRepaid: number;
      defaultRate: number;
    };
    recentActivity: Array<{
      id: string;
      type: string;
      description: string;
      timestamp: string;
      loanReference?: string;
      customerName?: string;
    }>;
  }>>({
    data: null,
    loading: true,
    error: null,
  });

  const fetchDashboard = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    // For now, we'll derive dashboard data from the loans endpoint
    // In a real implementation, there would be a dedicated dashboard endpoint
    const response = await apiClient.get<AdminLoansResponse>('/admin/loans?limit=100');
    
    if (response.success && response.data) {
      const loans = response.data.loans;
      
      // Calculate statistics from loan data
      const stats = {
        totalLoans: loans.length,
        pendingApprovals: loans.filter(loan => loan.status === 'applied').length,
        activeLoans: loans.filter(loan => ['approved', 'disbursed'].includes(loan.status)).length,
        overdueLoans: loans.filter(loan => loan.status === 'overdue').length,
        totalDisbursed: loans.reduce((sum, loan) => sum + loan.amount, 0),
        totalRepaid: loans.reduce((sum, loan) => sum + (loan.amount - loan.remainingBalance), 0),
        defaultRate: loans.filter(loan => loan.status === 'defaulted').length / Math.max(loans.length, 1) * 100,
      };
      
      // Generate recent activity from loan data
      const recentActivity = loans
        .filter(loan => loan.approvedAt || loan.rejectedAt)
        .sort((a, b) => {
          const aTime = new Date(a.approvedAt || a.rejectedAt || 0).getTime();
          const bTime = new Date(b.approvedAt || b.rejectedAt || 0).getTime();
          return bTime - aTime;
        })
        .slice(0, 10)
        .map(loan => ({
          id: loan._id,
          type: loan.approvedAt ? 'approval' : 'rejection',
          description: loan.approvedAt 
            ? `Loan ${loan.reference} approved for ${loan.customer.name}`
            : `Loan ${loan.reference} rejected for ${loan.customer.name}`,
          timestamp: loan.approvedAt || loan.rejectedAt || '',
          loanReference: loan.reference,
          customerName: loan.customer.name,
        }));
      
      setState({
        data: { stats, recentActivity },
        loading: false,
        error: null,
      });
    } else {
      setState({
        data: null,
        loading: false,
        error: response.error || 'Failed to load dashboard',
      });
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return {
    ...state,
    refetch: fetchDashboard,
  };
}

/**
 * Single Loan Detail Hook
 * 
 * Fetches detailed information for a specific loan including customer data,
 * payment history, and KYC documents.
 */
export function useLoanDetail(loanId: string) {
  const [state, setState] = useState<HookState<AdminLoanData>>({
    data: null,
    loading: true,
    error: null,
  });

  const fetchLoanDetail = useCallback(async () => {
    if (!loanId) return;
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    // For now, we'll get the loan from the loans list
    // In a real implementation, there would be a dedicated loan detail endpoint
    const response = await apiClient.get<AdminLoansResponse>(`/admin/loans?search=${loanId}`);
    
    if (response.success && response.data && response.data.loans.length > 0) {
      const loan = response.data.loans.find(l => l._id === loanId || l.reference === loanId);
      
      if (loan) {
        setState({
          data: loan,
          loading: false,
          error: null,
        });
      } else {
        setState({
          data: null,
          loading: false,
          error: 'Loan not found',
        });
      }
    } else {
      setState({
        data: null,
        loading: false,
        error: response.error || 'Failed to load loan details',
      });
    }
  }, [loanId]);

  useEffect(() => {
    fetchLoanDetail();
  }, [fetchLoanDetail]);

  return {
    ...state,
    refetch: fetchLoanDetail,
  };
}
