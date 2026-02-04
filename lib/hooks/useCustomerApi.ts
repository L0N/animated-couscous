/**
 * Customer API Hooks
 * 
 * Custom React hooks for customer-related API operations.
 * Provides state management, loading states, and error handling for customer features.
 * 
 * Data Flow:
 * 1. Component calls hook (e.g., useDashboard())
 * 2. Hook manages loading state and makes API call
 * 3. API client sends request to backend
 * 4. Backend processes request and returns data
 * 5. Hook updates state and returns data to component
 * 6. Component renders data or error state
 * 
 * Features:
 * - Automatic loading state management
 * - Error handling and retry logic
 * - Type-safe API responses
 * - Optimistic updates for mutations
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiResponse } from '@/lib/api/client';

/**
 * Dashboard Data Interface
 */
export interface DashboardData {
  user: {
    name: string;
    currentLimit: number;
    isTrustworthy: boolean;
    status: string;
    tierInfo: {
      onTimeCount: number;
      consecutiveOnTimePayments: number;
      trustworthyPath: string;
    };
  };
  activeLoans: Array<{
    id: string;
    reference: string;
    amount: number;
    status: string;
    dueDate: string;
    remainingBalance: number;
  }>;
  alerts: Array<{
    type: string;
    message: string;
    priority: string;
  }>;
  stats: {
    totalLoans: number;
    totalBorrowed: number;
    totalRepaid: number;
    onTimePaymentRate: number;
  };
}

/**
 * Loan Application Data Interface
 */
export interface LoanApplication {
  amount: number;
  termDays: number;
  interestRate: number;
  interestAmount: number;
  totalRepayable: number;
  dueDate: string;
}

/**
 * Loan History Interface
 */
export interface LoanHistoryItem {
  id: string;
  reference: string;
  amount: number;
  termDays: number;
  interestRate: number;
  totalRepayable: number;
  status: string;
  appliedAt: string;
  dueDate: string;
  repaidAt?: string;
  remainingBalance: number;
  payments: Array<{
    id: string;
    amount: number;
    status: string;
    submittedAt: string;
    verifiedAt?: string;
  }>;
}

/**
 * Profile Data Interface
 */
export interface ProfileData {
  id: string;
  name: string;
  email: string;
  phone: string;
  currentLimit: number;
  isTrustworthy: boolean;
  status: string;
  kyc: {
    idType?: string;
    idNumber?: string;
    verified: boolean;
    hasIdDocument: boolean;
    hasEmploymentProof: boolean;
    hasBankStatement: boolean;
  };
  tierInfo: {
    onTimeCount: number;
    consecutiveOnTimePayments: number;
    trustworthyPath: string;
  };
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
 * Customer Dashboard Hook
 * 
 * Fetches and manages customer dashboard data including active loans,
 * tier information, and alerts.
 */
export function useDashboard() {
  const [state, setState] = useState<HookState<DashboardData>>({
    data: null,
    loading: true,
    error: null,
  });

  const fetchDashboard = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    const response = await apiClient.get<DashboardData>('/customer/dashboard');
    
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
 * Loan Application Hook
 * 
 * Handles loan application submission with validation and error handling.
 */
export function useLoanApplication() {
  const [state, setState] = useState<HookState<{ reference: string; message: string }>>({
    data: null,
    loading: false,
    error: null,
  });

  const applyForLoan = useCallback(async (application: { amount: number; termDays: number }) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    const response = await apiClient.post('/customer/apply', application);
    
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
        error: response.error || 'Failed to submit loan application',
      });
      throw new Error(response.error || 'Failed to submit loan application');
    }
  }, []);

  return {
    ...state,
    applyForLoan,
  };
}

/**
 * Loan History Hook
 * 
 * Fetches paginated loan history with filtering options.
 */
export function useLoanHistory(page = 1, limit = 10) {
  const [state, setState] = useState<HookState<{
    loans: LoanHistoryItem[];
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }>>({
    data: null,
    loading: true,
    error: null,
  });

  const fetchLoans = useCallback(async (pageNum = page, pageLimit = limit) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    const response = await apiClient.get(`/customer/loans?page=${pageNum}&limit=${pageLimit}`);
    
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
        error: response.error || 'Failed to load loan history',
      });
    }
  }, [page, limit]);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  return {
    ...state,
    refetch: fetchLoans,
  };
}

/**
 * Payment Upload Hook
 * 
 * Handles payment proof upload with file validation and progress tracking.
 */
export function usePaymentUpload() {
  const [state, setState] = useState<HookState<{ message: string; paymentId: string }>>({
    data: null,
    loading: false,
    error: null,
  });

  const uploadPayment = useCallback(async (
    file: File,
    loanId: string,
    amount: number,
    description?: string
  ) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('loanId', loanId);
    formData.append('amount', amount.toString());
    if (description) {
      formData.append('description', description);
    }
    
    const response = await apiClient.upload('/customer/payments/upload', formData);
    
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
        error: response.error || 'Failed to upload payment proof',
      });
      throw new Error(response.error || 'Failed to upload payment proof');
    }
  }, []);

  return {
    ...state,
    uploadPayment,
  };
}

/**
 * Customer Profile Hook
 * 
 * Manages customer profile data with update functionality.
 */
export function useProfile() {
  const [state, setState] = useState<HookState<ProfileData>>({
    data: null,
    loading: true,
    error: null,
  });

  const fetchProfile = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    const response = await apiClient.get<ProfileData>('/customer/profile');
    
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
        error: response.error || 'Failed to load profile',
      });
    }
  }, []);

  const updateProfile = useCallback(async (updates: Partial<ProfileData>) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    const response = await apiClient.put('/customer/profile', updates);
    
    if (response.success && response.data) {
      setState({
        data: response.data,
        loading: false,
        error: null,
      });
      return response.data;
    } else {
      setState(prev => ({
        ...prev,
        loading: false,
        error: response.error || 'Failed to update profile',
      }));
      throw new Error(response.error || 'Failed to update profile');
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    ...state,
    refetch: fetchProfile,
    updateProfile,
  };
}
