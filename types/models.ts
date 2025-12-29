import { Document, Types } from 'mongoose';
import { UserRole, LoanStatus, PaymentStatus, IDType } from './index';

// User Types
export interface IKYC {
  idType?: IDType;
  idNumber?: string;
  idDocumentUrl?: string;
  employmentProof?: string;
  bankStatement?: string;
  verified: boolean;
}

// User status for v2.0.0 credit rebuilding
export enum UserStatus {
  ACTIVE = 'active',
  REBUILDING = 'rebuilding',
  NEW = 'new',
}

// Trustworthy status path tracking
export enum TrustworthyPath {
  TIER_BASED = 'tier_based',
  EXPERIENCE_BASED = 'experience_based',
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  currentLimit: number;
  onTimeCount: number;
  isTrustworthy: boolean;
  kyc: IKYC;
  // v2.0.0 fields
  status: UserStatus;
  consecutiveOnTimePayments: number;
  totalConsecutiveOnTimePayments: number;
  trustworthyPath?: TrustworthyPath;
  lastTierUpgrade?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Loan version for backward compatibility
export enum LoanVersion {
  V1 = 'v1',
  V2 = 'v2',
}

// Enhanced loan status for v2.0.0
export enum LoanStatusV2 {
  APPLIED = 'applied',
  APPROVED = 'approved',
  DISBURSED = 'disbursed',
  ACTIVE = 'active',
  LATE = 'late',
  DEFAULTED = 'defaulted',
  PAID = 'paid',
  REPAID = 'repaid',
}

// Loan Types
export interface ILoan extends Document {
  _id: Types.ObjectId;
  reference: string;
  userId: Types.ObjectId | IUser;
  amount: number;
  termDays: number;
  interestRate: number;
  interestAmount: number;
  totalRepayable: number;
  totalPrincipalRepaid: number;
  totalInterestRepaid: number;
  status: LoanStatus;
  disbursedAt?: Date;
  dueDate: Date;
  repaidAt?: Date;
  overdueSince?: Date;
  isAutoApproved: boolean;
  rejectionReason?: string;
  // v2.0.0 fields
  loanVersion: LoanVersion;
  outstandingPrincipal?: number;
  accruedInterest?: number;
  lastInterestCalcDate?: Date;
  totalInterestCharged?: number;
  annualInterestRate?: number;
  hasPartialPayments?: boolean;
  extendedDueDate?: Date;
  interestFrozenAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Payment Types
export interface IPayment extends Document {
  _id: Types.ObjectId;
  loanId: Types.ObjectId | ILoan;
  userId: Types.ObjectId | IUser;
  amount: number;
  proofUrl: string;
  status: PaymentStatus;
  principalPaid: number;
  interestPaid: number;
  verifiedAt?: Date;
  verifiedBy?: Types.ObjectId | IUser;
  rejectionReason?: string;
  // v2.0.0 fields
  interestPortion?: number;
  principalPortion?: number;
  interestCalculatedToDate?: Date;
  outstandingPrincipalBefore?: number;
  outstandingPrincipalAfter?: number;
  accruedInterestBefore?: number;
  accruedInterestAfter?: number;
  createdAt: Date;
  updatedAt: Date;
}

// System Settings Types
export interface ISystemSettings extends Document {
  _id: string; // 'singleton'
  cashOnHand: number;
  totalDisbursed: number;
  totalRepaid: number;
  interestEarned: number;
  updatedAt: Date;
}

// Audit Log Types
export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  userId?: Types.ObjectId | IUser;
  action: string;
  entityType: 'user' | 'loan' | 'payment' | 'system';
  entityId?: Types.ObjectId;
  details: Record<string, any>;
  ipAddress?: string;
  createdAt: Date;
}
