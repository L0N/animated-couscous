/**
 * Loan Model - Complete Loan Lifecycle Management
 * 
 * Manages loan applications, approvals, disbursements, and repayments with
 * support for both legacy v1.0.0 fixed-rate loans and v2.0.1 daily-accruing loans.
 * 
 * Data Flow:
 * 1. Customer application → APPLIED status
 * 2. Admin/auto approval → APPROVED status  
 * 3. Admin disbursement → DISBURSED status
 * 4. Customer payments → Interest/principal allocation
 * 5. Full repayment → REPAID status
 * 6. Overdue detection → OVERDUE/DEFAULTED status
 * 
 * Key Features:
 * - Dual loan versions (v1.0.0 fixed rates, v2.0.1 daily accrual)
 * - Auto-approval integration with 7-criteria validation
 * - Interest-first payment allocation for customer benefit
 * - Comprehensive audit trail for regulatory compliance
 * - Automatic reference number generation (WP-YYYYMM-00001)
 */

import mongoose, { Schema, Model } from 'mongoose';
import { ILoan, LoanStatus, LoanVersion } from '@/types';

/**
 * Loan schema supporting both legacy and enhanced loan systems
 * Maintains backward compatibility while enabling advanced features
 */
const loanSchema = new Schema<ILoan>({
  // === MULTI-TENANT SUPPORT ===
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    required: [true, 'Tenant ID is required'],
    index: true,
  },
  
  // === LOAN IDENTIFICATION ===
  reference: {
    type: String,
    required: true,
    // Auto-generated format: WP-YYYYMM-00001 (e.g., WP-202501-00001)
    // Unique per tenant, not globally unique
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    // Links loan to customer account for credit tracking
  },

  // === LOAN TERMS ===
  amount: {
    type: Number,
    required: [true, 'Loan amount is required'],
    min: [10, 'Minimum loan amount is K10'],
    // Must be within customer's tier limit (K50-K1000)
  },
  termDays: {
    type: Number,
    required: [true, 'Loan term is required'],
    enum: [14, 30, 60, 90],
    // Standard terms - can be extended to 100 days with partial payments
  },
  interestRate: {
    type: Number,
    required: [true, 'Interest rate is required'],
    min: [0, 'Interest rate cannot be negative'],
    // v1.0.0: Fixed rates (30%, 60%, 75%, 100%)
    // v2.0.1: Daily accrual rate (annual rate / 365)
  },
  interestAmount: {
    type: Number,
    required: [true, 'Interest amount is required'],
    min: [0, 'Interest amount cannot be negative'],
    // v1.0.0: Fixed at loan creation
    // v2.0.1: Calculated daily and accumulated
  },
  totalRepayable: {
    type: Number,
    required: [true, 'Total repayable is required'],
    // Principal + interest amount (updated as interest accrues in v2.0.1)
  },

  // === PAYMENT TRACKING ===
  totalPrincipalRepaid: {
    type: Number,
    default: 0,
    min: [0, 'Principal repaid cannot be negative'],
    // Tracks principal portion of all payments received
  },
  totalInterestRepaid: {
    type: Number,
    default: 0,
    min: [0, 'Interest repaid cannot be negative'],
    // Tracks interest portion of all payments received
  },

  // === LOAN STATUS & LIFECYCLE ===
  status: {
    type: String,
    enum: Object.values(LoanStatus),
    default: LoanStatus.APPLIED,
    // APPLIED → APPROVED → DISBURSED → REPAID/OVERDUE/DEFAULTED
  },
  disbursedAt: Date,
  // Timestamp when funds were transferred to customer
  dueDate: {
    type: Date,
    required: [true, 'Due date is required'],
    // Original due date (can be extended with partial payments)
  },
  repaidAt: Date,
  // Timestamp when loan was fully repaid
  overdueSince: Date,
  // Timestamp when loan first became overdue (1+ days past due)
  isAutoApproved: {
    type: Boolean,
    default: false,
    // Indicates loan was approved automatically via 7-criteria system
  },
  rejectionReason: String,
  // Admin-provided reason if loan application was rejected
  
  // === ADMIN ACTION TRACKING ===
  approvedAt: Date,
  // Timestamp when loan was approved by admin
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    // Admin user who approved the loan
  },
  approvalNotes: String,
  // Admin notes during approval process
  disbursementMethod: {
    type: String,
    enum: ['bank_transfer', 'mobile_money', 'cash'],
    // Method chosen for fund disbursement
  },
  rejectedAt: Date,
  // Timestamp when loan was rejected by admin
  rejectedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    // Admin user who rejected the loan
  },
  rejectionNotes: String,
  // Admin notes during rejection process
  allowReapplication: {
    type: Boolean,
    default: true,
    // Whether customer can reapply after rejection
  },

  // === v2.0.1 DAILY INTEREST SYSTEM ===
  loanVersion: {
    type: String,
    enum: Object.values(LoanVersion),
    default: LoanVersion.V2,
    required: true,
    // V1: Legacy fixed-rate loans, V2: Daily-accruing loans
  },
  outstandingPrincipal: {
    type: Number,
    min: [0, 'Outstanding principal cannot be negative'],
    // Remaining principal balance (amount - totalPrincipalRepaid)
  },
  accruedInterest: {
    type: Number,
    default: 0,
    min: [0, 'Accrued interest cannot be negative'],
    // Interest accumulated since last calculation (daily cron job)
  },
  lastInterestCalcDate: Date,
  // Last date interest was calculated (for daily accrual tracking)
  totalInterestCharged: {
    type: Number,
    min: [0, 'Total interest charged cannot be negative'],
    // Total interest charged to date (may exceed original interestAmount)
  },
  annualInterestRate: {
    type: Number,
    min: [0, 'Annual interest rate cannot be negative'],
    // Annual rate used for daily calculations (e.g., 4.00% = 0.04)
  },
  hasPartialPayments: {
    type: Boolean,
    default: false,
    // Indicates if customer has made partial payments (enables term extension)
  },
  extendedDueDate: Date,
  // New due date if term was extended due to partial payments
  interestFrozenAt: Date,
  // Date when interest accrual was frozen (at 14+ days overdue)
}, {
  timestamps: true, // Adds createdAt and updatedAt for audit trail
});

/**
 * Database indexes for optimal query performance (tenant-scoped for v4.0)
 * Critical for loan management and reporting operations with multi-tenant isolation
 */
// Core loan queries (tenant-scoped)
loanSchema.index({ tenantId: 1, userId: 1 }); // Customer loan lookup per tenant
loanSchema.index({ tenantId: 1, status: 1 }); // Status-based filtering per tenant
loanSchema.index({ tenantId: 1, dueDate: 1 }); // Overdue detection per tenant
loanSchema.index({ tenantId: 1, reference: 1 }, { unique: true }); // Unique reference per tenant
loanSchema.index({ tenantId: 1, createdAt: -1 }); // Recent loans per tenant

// v2.0.1 daily interest system indexes (tenant-scoped)
loanSchema.index({ tenantId: 1, loanVersion: 1 }); // Version-specific queries per tenant
loanSchema.index({ tenantId: 1, lastInterestCalcDate: 1 }); // Daily cron job per tenant
loanSchema.index({ tenantId: 1, loanVersion: 1, status: 1 }); // Version + status per tenant
loanSchema.index({ tenantId: 1, userId: 1, loanVersion: 1 }); // Customer version-specific loans

// Legacy single-tenant indexes (for backward compatibility)
loanSchema.index({ userId: 1 }); // Legacy customer loan lookup
loanSchema.index({ status: 1 }); // Legacy status-based filtering
loanSchema.index({ reference: 1 }); // Legacy unique loan reference lookup

/**
 * Pre-save hook: Automatic reference number generation (tenant-scoped for v4.0)
 * 
 * Generates unique loan references per tenant in format: WP-YYYYMM-00001
 * - WP: WanPaus prefix
 * - YYYYMM: Year and month of creation
 * - 00001: Sequential number within that month and tenant
 * 
 * Example: WP-202501-00001 (first loan in January 2025 for this tenant)
 */
loanSchema.pre('save', async function (next) {
  if (this.isNew && !this.reference) {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const yearMonth = year + month;

    // Count existing loans with this year-month prefix for this tenant
    const count = await mongoose.models.Loan.countDocuments({
      tenantId: this.tenantId,
      reference: new RegExp(`^WP-${yearMonth}`),
    });

    // Generate sequential reference number (tenant-scoped)
    this.reference = `WP-${yearMonth}-${(count + 1).toString().padStart(5, '0')}`;
  }
  next();
});

/**
 * Export Loan model with Mongoose hot-reload support
 * Prevents model re-compilation errors in development
 */
const Loan: Model<ILoan> = mongoose.models.Loan || mongoose.model<ILoan>('Loan', loanSchema);

export default Loan;
