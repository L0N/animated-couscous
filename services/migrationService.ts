/**
 * Migration Service (v2.0.0)
 * 
 * Handles automatic migration from v1.0.0 to v2.0.0:
 * - Immediate migration on deployment
 * - Preserves existing loan contracts
 * - Adds v2.0.0 fields to existing records
 * - Validates migration integrity
 * - Provides rollback capabilities
 */

import { ILoan, IUser, IPayment, LoanVersion, UserStatus, TrustworthyPath } from '@/types';
import { getPNGNow, getPNGStartOfDay } from '@/lib/timezone';
import Loan from '@/models/Loan';
import User from '@/models/User';
import Payment from '@/models/Payment';
import { createInterestCalculationRecord } from '@/models/InterestCalculation';

/**
 * Migration configuration
 */
export const MIGRATION_CONFIG = {
  BATCH_SIZE: parseInt(process.env.MIGRATION_BATCH_SIZE || '100'),
  V1_CUTOFF_DATE: process.env.V1_CUTOFF_DATE ? new Date(process.env.V1_CUTOFF_DATE) : null,
  PRESERVE_V1_CONTRACTS: process.env.PRESERVE_V1_CONTRACTS !== 'false',
  AUTO_MIGRATE_ON_DEPLOY: process.env.AUTO_MIGRATE_ON_DEPLOY !== 'false',
} as const;

/**
 * Migration status tracking
 */
export interface MigrationStatus {
  isComplete: boolean;
  startedAt?: Date;
  completedAt?: Date;
  totalRecords: number;
  migratedRecords: number;
  failedRecords: number;
  errors: string[];
  phase: 'not_started' | 'users' | 'loans' | 'payments' | 'validation' | 'complete' | 'failed';
  progress: number; // 0-100
}

/**
 * Migration result for individual record
 */
export interface MigrationResult {
  success: boolean;
  recordId: string;
  recordType: 'user' | 'loan' | 'payment';
  changes: string[];
  errors: string[];
}

/**
 * Migration validation result
 */
export interface ValidationResult {
  isValid: boolean;
  totalChecked: number;
  validRecords: number;
  invalidRecords: number;
  issues: Array<{
    recordId: string;
    recordType: string;
    issue: string;
    severity: 'warning' | 'error';
  }>;
}

/**
 * Check if migration is needed
 */
export async function isMigrationNeeded(): Promise<{
  needed: boolean;
  v1Users: number;
  v1Loans: number;
  v1Payments: number;
  totalRecords: number;
}> {
  // Check for records without v2.0.0 fields
  const v1Users = await User.countDocuments({
    $or: [
      { status: { $exists: false } },
      { consecutiveOnTimePayments: { $exists: false } },
      { totalConsecutiveOnTimePayments: { $exists: false } },
    ],
  });
  
  const v1Loans = await Loan.countDocuments({
    $or: [
      { loanVersion: { $exists: false } },
      { loanVersion: LoanVersion.V1 },
      { outstandingPrincipal: { $exists: false } },
    ],
  });
  
  const v1Payments = await Payment.countDocuments({
    $or: [
      { interestPortion: { $exists: false } },
      { principalPortion: { $exists: false } },
    ],
  });
  
  const totalRecords = v1Users + v1Loans + v1Payments;
  
  return {
    needed: totalRecords > 0,
    v1Users,
    v1Loans,
    v1Payments,
    totalRecords,
  };
}

/**
 * Migrate user records to v2.0.0
 */
export async function migrateUsers(): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];
  
  // Find users needing migration
  const users = await User.find({
    $or: [
      { status: { $exists: false } },
      { consecutiveOnTimePayments: { $exists: false } },
      { totalConsecutiveOnTimePayments: { $exists: false } },
    ],
  });
  
  for (const user of users) {
    const result: MigrationResult = {
      success: false,
      recordId: user._id.toString(),
      recordType: 'user',
      changes: [],
      errors: [],
    };
    
    try {
      // Set default status
      if (!user.status) {
        user.status = UserStatus.ACTIVE;
        result.changes.push('Set status to ACTIVE');
      }
      
      // Migrate consecutive payment tracking
      if (user.consecutiveOnTimePayments === undefined) {
        user.consecutiveOnTimePayments = user.onTimeCount || 0;
        result.changes.push(`Set consecutiveOnTimePayments to ${user.consecutiveOnTimePayments}`);
      }
      
      if (user.totalConsecutiveOnTimePayments === undefined) {
        user.totalConsecutiveOnTimePayments = user.onTimeCount || 0;
        result.changes.push(`Set totalConsecutiveOnTimePayments to ${user.totalConsecutiveOnTimePayments}`);
      }
      
      // Set trustworthy path if user is trustworthy
      if (user.isTrustworthy && !user.trustworthyPath) {
        user.trustworthyPath = TrustworthyPath.TIER_BASED; // Assume tier-based for existing trustworthy users
        result.changes.push('Set trustworthyPath to TIER_BASED');
      }
      
      // Set last tier upgrade date if not set
      if (!user.lastTierUpgrade && user.currentLimit > 50) {
        user.lastTierUpgrade = user.updatedAt || user.createdAt;
        result.changes.push('Set lastTierUpgrade date');
      }
      
      await user.save();
      result.success = true;
      
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }
    
    results.push(result);
  }
  
  return results;
}

/**
 * Migrate loan records to v2.0.0
 */
export async function migrateLoans(): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];
  const now = getPNGNow();
  const cutoffDate = MIGRATION_CONFIG.V1_CUTOFF_DATE || getPNGStartOfDay(now);
  
  // Find loans needing migration
  const loans = await Loan.find({
    $or: [
      { loanVersion: { $exists: false } },
      { outstandingPrincipal: { $exists: false } },
    ],
  });
  
  for (const loan of loans) {
    const result: MigrationResult = {
      success: false,
      recordId: loan._id.toString(),
      recordType: 'loan',
      changes: [],
      errors: [],
    };
    
    try {
      // Determine loan version based on disbursement date or cutoff
      if (!loan.loanVersion) {
        const isV1 = MIGRATION_CONFIG.PRESERVE_V1_CONTRACTS && 
          loan.disbursedAt && loan.disbursedAt < cutoffDate;
        
        loan.loanVersion = isV1 ? LoanVersion.V1 : LoanVersion.V2;
        result.changes.push(`Set loanVersion to ${loan.loanVersion}`);
      }
      
      // Set outstanding principal
      if (loan.outstandingPrincipal === undefined) {
        const principalRepaid = loan.totalPrincipalRepaid || 0;
        loan.outstandingPrincipal = Math.max(0, loan.amount - principalRepaid);
        result.changes.push(`Set outstandingPrincipal to ${loan.outstandingPrincipal}`);
      }
      
      // Set accrued interest for v2.0.0 loans
      if (loan.accruedInterest === undefined) {
        if (loan.loanVersion === LoanVersion.V2) {
          // For v2.0.0 loans, calculate accrued interest based on current status
          if (loan.status === 'DISBURSED' || loan.status === 'ACTIVE') {
            loan.accruedInterest = 0; // Will be calculated by daily cron job
          } else if (loan.status === 'REPAID' || loan.status === 'PAID') {
            loan.accruedInterest = 0; // Fully paid
          } else {
            loan.accruedInterest = 0; // Default to 0, will be calculated
          }
        } else {
          // For v1.0.0 loans, use remaining interest
          const interestRepaid = loan.totalInterestRepaid || 0;
          loan.accruedInterest = Math.max(0, loan.interestAmount - interestRepaid);
        }
        result.changes.push(`Set accruedInterest to ${loan.accruedInterest}`);
      }
      
      // Set last interest calculation date for v2.0.0 loans
      if (!loan.lastInterestCalcDate && loan.loanVersion === LoanVersion.V2) {
        loan.lastInterestCalcDate = loan.disbursedAt || loan.createdAt;
        result.changes.push('Set lastInterestCalcDate');
      }
      
      // Set annual interest rate for v2.0.0 loans
      if (loan.annualInterestRate === undefined && loan.loanVersion === LoanVersion.V2) {
        loan.annualInterestRate = parseFloat(process.env.ANNUAL_INTEREST_RATE || '4.00');
        result.changes.push(`Set annualInterestRate to ${loan.annualInterestRate}%`);
      }
      
      // Set total interest charged
      if (loan.totalInterestCharged === undefined) {
        loan.totalInterestCharged = loan.totalInterestRepaid || 0;
        result.changes.push(`Set totalInterestCharged to ${loan.totalInterestCharged}`);
      }
      
      // Set partial payments flag
      if (loan.hasPartialPayments === undefined) {
        // Check if loan has multiple payments
        const paymentCount = await Payment.countDocuments({ 
          loanId: loan._id,
          status: 'VERIFIED',
        });
        loan.hasPartialPayments = paymentCount > 1;
        result.changes.push(`Set hasPartialPayments to ${loan.hasPartialPayments}`);
      }
      
      await loan.save();
      result.success = true;
      
      // Create initial interest calculation record for v2.0.0 loans
      if (loan.loanVersion === LoanVersion.V2 && loan.disbursedAt) {
        try {
          await createInterestCalculationRecord({
            loanId: loan._id.toString(),
            calculationDate: loan.disbursedAt,
            lastCalculationDate: loan.disbursedAt,
            daysElapsed: 0,
            outstandingPrincipal: loan.amount,
            annualInterestRate: loan.annualInterestRate || 4.00,
            dailyInterestRate: (loan.annualInterestRate || 4.00) / 365 / 100,
            interestAccrued: 0,
            totalAccruedBefore: 0,
            totalAccruedAfter: 0,
            interestCap: loan.amount * (loan.annualInterestRate || 4.00) / 100,
            isCapReached: false,
            calculationType: 'loan_disbursement',
            triggeredBy: 'migration',
            auditTrail: 'Initial calculation record created during v2.0.0 migration',
          });
          result.changes.push('Created initial interest calculation record');
        } catch (error) {
          // Non-critical error, don't fail the migration
          result.changes.push('Warning: Could not create interest calculation record');
        }
      }
      
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }
    
    results.push(result);
  }
  
  return results;
}

/**
 * Migrate payment records to v2.0.0
 */
export async function migratePayments(): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];
  
  // Find payments needing migration
  const payments = await Payment.find({
    $or: [
      { interestPortion: { $exists: false } },
      { principalPortion: { $exists: false } },
    ],
  }).populate('loanId');
  
  for (const payment of payments) {
    const result: MigrationResult = {
      success: false,
      recordId: payment._id.toString(),
      recordType: 'payment',
      changes: [],
      errors: [],
    };
    
    try {
      const loan = payment.loanId as any; // Populated loan
      
      // Set interest and principal portions
      if (payment.interestPortion === undefined || payment.principalPortion === undefined) {
        if (loan && loan.loanVersion === LoanVersion.V1) {
          // For v1.0.0 loans, use existing allocation logic
          payment.principalPortion = payment.principalPaid || 0;
          payment.interestPortion = payment.interestPaid || 0;
        } else {
          // For v2.0.0 loans or unknown, split based on payment amount
          const totalAmount = payment.amount;
          payment.interestPortion = payment.interestPaid || 0;
          payment.principalPortion = totalAmount - payment.interestPortion;
        }
        result.changes.push(`Set interestPortion to ${payment.interestPortion}, principalPortion to ${payment.principalPortion}`);
      }
      
      // Set interest calculation date
      if (!payment.interestCalculatedToDate) {
        payment.interestCalculatedToDate = payment.verifiedAt || payment.createdAt;
        result.changes.push('Set interestCalculatedToDate');
      }
      
      // Set balance snapshots (approximate values for migration)
      if (payment.outstandingPrincipalBefore === undefined && loan) {
        payment.outstandingPrincipalBefore = loan.outstandingPrincipal + payment.principalPortion;
        payment.outstandingPrincipalAfter = loan.outstandingPrincipal;
        result.changes.push('Set principal balance snapshots');
      }
      
      if (payment.accruedInterestBefore === undefined && loan) {
        payment.accruedInterestBefore = (loan.accruedInterest || 0) + payment.interestPortion;
        payment.accruedInterestAfter = loan.accruedInterest || 0;
        result.changes.push('Set interest balance snapshots');
      }
      
      await payment.save();
      result.success = true;
      
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }
    
    results.push(result);
  }
  
  return results;
}

/**
 * Perform complete migration
 */
export async function performMigration(): Promise<MigrationStatus> {
  const startTime = getPNGNow();
  const status: MigrationStatus = {
    isComplete: false,
    startedAt: startTime,
    totalRecords: 0,
    migratedRecords: 0,
    failedRecords: 0,
    errors: [],
    phase: 'not_started',
    progress: 0,
  };
  
  try {
    // Check if migration is needed
    const migrationCheck = await isMigrationNeeded();
    if (!migrationCheck.needed) {
      status.isComplete = true;
      status.completedAt = getPNGNow();
      status.phase = 'complete';
      status.progress = 100;
      return status;
    }
    
    status.totalRecords = migrationCheck.totalRecords;
    
    // Phase 1: Migrate users
    status.phase = 'users';
    const userResults = await migrateUsers();
    const successfulUsers = userResults.filter(r => r.success).length;
    const failedUsers = userResults.filter(r => !r.success);
    
    status.migratedRecords += successfulUsers;
    status.failedRecords += failedUsers.length;
    status.errors.push(...failedUsers.flatMap(r => r.errors));
    status.progress = (status.migratedRecords / status.totalRecords) * 100;
    
    // Phase 2: Migrate loans
    status.phase = 'loans';
    const loanResults = await migrateLoans();
    const successfulLoans = loanResults.filter(r => r.success).length;
    const failedLoans = loanResults.filter(r => !r.success);
    
    status.migratedRecords += successfulLoans;
    status.failedRecords += failedLoans.length;
    status.errors.push(...failedLoans.flatMap(r => r.errors));
    status.progress = (status.migratedRecords / status.totalRecords) * 100;
    
    // Phase 3: Migrate payments
    status.phase = 'payments';
    const paymentResults = await migratePayments();
    const successfulPayments = paymentResults.filter(r => r.success).length;
    const failedPayments = paymentResults.filter(r => !r.success);
    
    status.migratedRecords += successfulPayments;
    status.failedRecords += failedPayments.length;
    status.errors.push(...failedPayments.flatMap(r => r.errors));
    status.progress = (status.migratedRecords / status.totalRecords) * 100;
    
    // Phase 4: Validation
    status.phase = 'validation';
    const validation = await validateMigration();
    if (!validation.isValid) {
      status.errors.push(`Validation failed: ${validation.invalidRecords} invalid records found`);
      status.errors.push(...validation.issues.filter(i => i.severity === 'error').map(i => i.issue));
    }
    
    // Complete
    status.isComplete = status.failedRecords === 0 && validation.isValid;
    status.completedAt = getPNGNow();
    status.phase = status.isComplete ? 'complete' : 'failed';
    status.progress = 100;
    
  } catch (error) {
    status.phase = 'failed';
    status.errors.push(error instanceof Error ? error.message : 'Unknown migration error');
    status.completedAt = getPNGNow();
  }
  
  return status;
}

/**
 * Validate migration integrity
 */
export async function validateMigration(): Promise<ValidationResult> {
  const issues: Array<{
    recordId: string;
    recordType: string;
    issue: string;
    severity: 'warning' | 'error';
  }> = [];
  
  let totalChecked = 0;
  let validRecords = 0;
  
  // Validate users
  const users = await User.find({});
  for (const user of users) {
    totalChecked++;
    let isValid = true;
    
    if (!user.status) {
      issues.push({
        recordId: user._id.toString(),
        recordType: 'user',
        issue: 'Missing status field',
        severity: 'error',
      });
      isValid = false;
    }
    
    if (user.consecutiveOnTimePayments === undefined) {
      issues.push({
        recordId: user._id.toString(),
        recordType: 'user',
        issue: 'Missing consecutiveOnTimePayments field',
        severity: 'error',
      });
      isValid = false;
    }
    
    if (user.isTrustworthy && !user.trustworthyPath) {
      issues.push({
        recordId: user._id.toString(),
        recordType: 'user',
        issue: 'Trustworthy user missing trustworthyPath',
        severity: 'warning',
      });
    }
    
    if (isValid) validRecords++;
  }
  
  // Validate loans
  const loans = await Loan.find({});
  for (const loan of loans) {
    totalChecked++;
    let isValid = true;
    
    if (!loan.loanVersion) {
      issues.push({
        recordId: loan._id.toString(),
        recordType: 'loan',
        issue: 'Missing loanVersion field',
        severity: 'error',
      });
      isValid = false;
    }
    
    if (loan.outstandingPrincipal === undefined) {
      issues.push({
        recordId: loan._id.toString(),
        recordType: 'loan',
        issue: 'Missing outstandingPrincipal field',
        severity: 'error',
      });
      isValid = false;
    }
    
    if (loan.loanVersion === LoanVersion.V2 && !loan.annualInterestRate) {
      issues.push({
        recordId: loan._id.toString(),
        recordType: 'loan',
        issue: 'v2.0.0 loan missing annualInterestRate',
        severity: 'error',
      });
      isValid = false;
    }
    
    if (isValid) validRecords++;
  }
  
  // Validate payments
  const payments = await Payment.find({});
  for (const payment of payments) {
    totalChecked++;
    let isValid = true;
    
    if (payment.interestPortion === undefined || payment.principalPortion === undefined) {
      issues.push({
        recordId: payment._id.toString(),
        recordType: 'payment',
        issue: 'Missing interest or principal portion fields',
        severity: 'error',
      });
      isValid = false;
    }
    
    const totalPortion = (payment.interestPortion || 0) + (payment.principalPortion || 0);
    if (Math.abs(totalPortion - payment.amount) > 0.01) {
      issues.push({
        recordId: payment._id.toString(),
        recordType: 'payment',
        issue: 'Interest + principal portions do not equal payment amount',
        severity: 'error',
      });
      isValid = false;
    }
    
    if (isValid) validRecords++;
  }
  
  return {
    isValid: issues.filter(i => i.severity === 'error').length === 0,
    totalChecked,
    validRecords,
    invalidRecords: totalChecked - validRecords,
    issues,
  };
}

/**
 * Get migration status
 */
export async function getMigrationStatus(): Promise<MigrationStatus> {
  const migrationCheck = await isMigrationNeeded();
  
  if (!migrationCheck.needed) {
    return {
      isComplete: true,
      totalRecords: 0,
      migratedRecords: 0,
      failedRecords: 0,
      errors: [],
      phase: 'complete',
      progress: 100,
    };
  }
  
  return {
    isComplete: false,
    totalRecords: migrationCheck.totalRecords,
    migratedRecords: 0,
    failedRecords: 0,
    errors: [],
    phase: 'not_started',
    progress: 0,
  };
}

/**
 * Rollback migration (emergency use only)
 */
export async function rollbackMigration(): Promise<{
  success: boolean;
  rolledBackRecords: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let rolledBackRecords = 0;
  
  try {
    // Remove v2.0.0 fields from users
    const userUpdate = await User.updateMany(
      {},
      {
        $unset: {
          status: '',
          consecutiveOnTimePayments: '',
          totalConsecutiveOnTimePayments: '',
          trustworthyPath: '',
          lastTierUpgrade: '',
        },
      }
    );
    rolledBackRecords += userUpdate.modifiedCount;
    
    // Remove v2.0.0 fields from loans
    const loanUpdate = await Loan.updateMany(
      {},
      {
        $unset: {
          loanVersion: '',
          outstandingPrincipal: '',
          accruedInterest: '',
          lastInterestCalcDate: '',
          totalInterestCharged: '',
          annualInterestRate: '',
          hasPartialPayments: '',
          extendedDueDate: '',
          interestFrozenAt: '',
        },
      }
    );
    rolledBackRecords += loanUpdate.modifiedCount;
    
    // Remove v2.0.0 fields from payments
    const paymentUpdate = await Payment.updateMany(
      {},
      {
        $unset: {
          interestPortion: '',
          principalPortion: '',
          interestCalculatedToDate: '',
          outstandingPrincipalBefore: '',
          outstandingPrincipalAfter: '',
          accruedInterestBefore: '',
          accruedInterestAfter: '',
        },
      }
    );
    rolledBackRecords += paymentUpdate.modifiedCount;
    
    return {
      success: true,
      rolledBackRecords,
      errors,
    };
    
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown rollback error');
    return {
      success: false,
      rolledBackRecords,
      errors,
    };
  }
}

