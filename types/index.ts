// Enums
export enum UserRole {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
}

export enum LoanStatus {
  APPLIED = 'applied',
  APPROVED = 'approved',
  DISBURSED = 'disbursed',
  REPAID = 'repaid',
  OVERDUE = 'overdue',
  DEFAULTED = 'defaulted',
  REJECTED = 'rejected',
}

export enum PaymentStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

export enum IDType {
  NATIONAL = 'national',
  DRIVER = 'driver',
  EMPLOYMENT = 'employment',
}

export enum TierLimit {
  TIER_1 = 50,
  TIER_2 = 100,
  TIER_3 = 200,
  TIER_4 = 500,
  TIER_5 = 1000,
}

export enum LoanTerm {
  DAYS_14 = 14,
  DAYS_30 = 30,
  DAYS_60 = 60,
  DAYS_90 = 90,
}

export enum EmailTemplate {
  LOAN_APPROVED = 'loan_approved',
  LOAN_DISBURSED = 'loan_disbursed',
  LOAN_REJECTED = 'loan_rejected',
  PAYMENT_RECEIVED = 'payment_received',
  OVERDUE_REMINDER = 'overdue_reminder',
  TIER_UPGRADED = 'tier_upgraded',
  DEFAULT_NOTICE = 'default_notice',
  ADMIN_NOTIFICATION = 'admin_notification',
}

// Type exports
export * from './models';
export * from './api';
export * from './services';

