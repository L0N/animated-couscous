import { LoanStatus, PaymentStatus } from './index';

// Auth API Types
export interface RegisterRequest {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SessionUser {
  id: string;
  email: string;
  role: string;
  name?: string;
}

// Customer API Types
export interface ApplyLoanRequest {
  amount: number;
  termDays: number;
}

export interface ApplyLoanResponse {
  success: boolean;
  reference: string;
  isAutoApproved: boolean;
  totalRepayable: number;
  interestRate: number;
  dueDate: string;
}

export interface UploadPaymentRequest {
  loanId: string;
  amount: number;
  file: File;
}

// Admin API Types
export interface LoansQueryParams {
  status?: LoanStatus;
  page?: number;
  limit?: number;
}

export interface ApproveLoanRequest {
  loanId: string;
}

export interface DisburseLoanRequest {
  loanId: string;
}

export interface VerifyPaymentRequest {
  paymentId: string;
  principalPaid?: number;
  interestPaid?: number;
  approved: boolean;
  rejectionReason?: string;
}

export interface SetTrustworthyRequest {
  userId: string;
  isTrustworthy: boolean;
}

// Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Financial Reports
export interface FinancialReport {
  cashOnHand: number;
  totalDisbursed: number;
  totalRepaid: number;
  interestEarned: number;
  outstandingLoans: number;
  outstandingAmount: number;
  overdueLoans: number;
  overdueAmount: number;
}

