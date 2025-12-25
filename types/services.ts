import { IUser, ILoan, ISystemSettings } from './models';

// Tier Service Types
export interface TierProgressionResult {
  upgraded: boolean;
  newLimit?: number;
  message: string;
}

// Loan Service Types
export interface InterestCalculation {
  rate: number;
  amount: number;
  discountPercentage: number;
  isTrustworthy: boolean;
}

export interface LoanCalculation {
  amount: number;
  termDays: number;
  interestRate: number;
  interestAmount: number;
  totalRepayable: number;
  dueDate: Date;
}

// Payment Service Types
export interface PaymentAllocation {
  principalPaid: number;
  interestPaid: number;
  remainingPrincipal: number;
  remainingInterest: number;
  isFullyPaid: boolean;
}

// Auto-Approval Service Types
export interface AutoApprovalCheck {
  canAutoApprove: boolean;
  reasons: string[];
}

// Financial Service Types
export interface FinancialUpdate {
  cashOnHand: number;
  totalDisbursed?: number;
  totalRepaid?: number;
  interestEarned?: number;
}

// Email Service Types
export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export interface LoanEmailData {
  customerName: string;
  reference: string;
  amount: number;
  termDays: number;
  dueDate: string;
  totalRepayable: number;
}

export interface ReminderEmailData extends LoanEmailData {
  daysOverdue: number;
  overdueAmount: number;
}

