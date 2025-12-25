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
  createdAt: Date;
  updatedAt: Date;
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

