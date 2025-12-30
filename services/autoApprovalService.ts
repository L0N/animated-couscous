/**
 * Enhanced Auto-Approval Service (v2.0.0)
 * 
 * Updated for v2.0.0 compatibility with daily interest calculations:
 * - Supports both v1.0.0 and v2.0.0 loan processing
 * - Enhanced trustworthy status checking with dual paths
 * - Real-time outstanding balance calculations
 * - Improved cash flow management
 * - Credit rebuilding status awareness
 */

import { ILoan, IUser, ISystemSettings, LoanStatus, LoanVersion, UserStatus } from '@/types';
import { AutoApprovalCheck } from '@/types/services';
import { calculateTotalDue } from './interestService';
import { getPNGNow } from '@/lib/timezone';
import Loan from '@/models/Loan';

/**
 * Auto-approval configuration
 */
export const AUTO_APPROVAL_CONFIG = {
  ENABLED: process.env.AUTO_APPROVAL_ENABLED !== 'false',
  MAX_AUTO_APPROVAL_AMOUNT: parseInt(process.env.MAX_AUTO_APPROVAL_AMOUNT || '1000'),
  MIN_CASH_RESERVE_RATIO: parseFloat(process.env.MIN_CASH_RESERVE_RATIO || '0.1'), // 10% reserve
  TRUSTWORTHY_REQUIRED: process.env.TRUSTWORTHY_REQUIRED_FOR_AUTO !== 'false',
} as const;

/**
 * Check if loan meets all auto-approval conditions for v2.0.0
 */
export async function checkAutoApprovalEligibilityV2(
  loan: ILoan,
  user: IUser,
  settings: ISystemSettings
): Promise<AutoApprovalCheck> {
  const reasons: string[] = [];
  let canAutoApprove = true;
  const now = getPNGNow();

  // Check 0: Auto-approval enabled
  if (!AUTO_APPROVAL_CONFIG.ENABLED) {
    canAutoApprove = false;
    reasons.push('Auto-approval is currently disabled');
    return { canAutoApprove, reasons };
  }

  // Check 1: Amount within user's current limit
  if (loan.amount > user.currentLimit) {
    canAutoApprove = false;
    reasons.push(`Amount K${loan.amount} exceeds user limit K${user.currentLimit}`);
  }

  // Check 2: Amount within auto-approval maximum
  if (loan.amount > AUTO_APPROVAL_CONFIG.MAX_AUTO_APPROVAL_AMOUNT) {
    canAutoApprove = false;
    reasons.push(`Amount K${loan.amount} exceeds auto-approval maximum K${AUTO_APPROVAL_CONFIG.MAX_AUTO_APPROVAL_AMOUNT}`);
  }

  // Check 3: User status and trustworthy requirements
  if (user.status === UserStatus.REBUILDING) {
    canAutoApprove = false;
    reasons.push('User account is in rebuilding status');
  }

  if (AUTO_APPROVAL_CONFIG.TRUSTWORTHY_REQUIRED && !user.isTrustworthy) {
    canAutoApprove = false;
    reasons.push('User is not marked as trustworthy (required for auto-approval)');
  }

  // Check 4: Sufficient cash on hand with reserve
  const requiredCash = loan.amount;
  const reserveAmount = settings.totalDisbursed * AUTO_APPROVAL_CONFIG.MIN_CASH_RESERVE_RATIO;
  const availableCash = settings.cashOnHand - reserveAmount;

  if (availableCash < requiredCash) {
    canAutoApprove = false;
    reasons.push(`Insufficient cash available: K${availableCash.toFixed(2)} (after K${reserveAmount.toFixed(2)} reserve) < K${requiredCash}`);
  }

  // Check 5: No overdue or active loans (enhanced for v2.0.0)
  const activeLoans = await Loan.find({
    userId: user._id,
    status: {
      $in: [
        LoanStatus.OVERDUE,
        LoanStatus.APPLIED,
        LoanStatus.APPROVED,
        LoanStatus.DISBURSED,
        'OVERDUE',
        'APPLIED',
        'APPROVED',
        'DISBURSED',
        'ACTIVE', // v2.0.0 status
        'LATE',   // v2.0.0 status
      ],
    },
    _id: { $ne: loan._id }, // Exclude current loan
  });

  if (activeLoans.length > 0) {
    canAutoApprove = false;
    const statusList = activeLoans.map(l => l.status).join(', ');
    reasons.push(`User has ${activeLoans.length} existing active/overdue loan(s) with status: ${statusList}`);
  }

  // Check 6: Outstanding balance verification for v2.0.0 loans
  let totalOutstanding = 0;
  for (const activeLoan of activeLoans) {
    if (activeLoan.loanVersion === LoanVersion.V2) {
      const totalDue = calculateTotalDue(activeLoan, now);
      totalOutstanding += totalDue;
    } else {
      // v1.0.0 loan calculation
      const principalRemaining = activeLoan.amount - (activeLoan.totalPrincipalRepaid || 0);
      const interestRemaining = activeLoan.interestAmount - (activeLoan.totalInterestRepaid || 0);
      totalOutstanding += principalRemaining + interestRemaining;
    }
  }

  if (totalOutstanding > 0) {
    canAutoApprove = false;
    reasons.push(`User has K${totalOutstanding.toFixed(2)} outstanding balance on existing loans`);
  }

  // Check 7: Recent payment history (enhanced check)
  const recentDefaultedLoans = await Loan.countDocuments({
    userId: user._id,
    status: { $in: [LoanStatus.DEFAULTED, 'DEFAULTED'] },
    updatedAt: { $gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) }, // Last 90 days
  });

  if (recentDefaultedLoans > 0) {
    canAutoApprove = false;
    reasons.push(`User has ${recentDefaultedLoans} defaulted loan(s) in the last 90 days`);
  }

  // Check 8: Loan term validation
  const validTerms = [14, 30, 60, 90];
  if (!validTerms.includes(loan.termDays)) {
    canAutoApprove = false;
    reasons.push(`Invalid loan term: ${loan.termDays} days. Valid terms: ${validTerms.join(', ')}`);
  }

  // Check 9: User KYC verification
  if (!user.kyc?.verified) {
    canAutoApprove = false;
    reasons.push('User KYC verification is incomplete');
  }

  // Success message
  if (canAutoApprove) {
    reasons.push('✅ All conditions met for auto-approval');
    reasons.push(`💰 Amount: K${loan.amount} (within K${user.currentLimit} limit)`);
    reasons.push(`🌟 User: ${user.isTrustworthy ? 'Trustworthy' : 'Standard'} status`);
    reasons.push(`💵 Cash available: K${availableCash.toFixed(2)}`);
  }

  return {
    canAutoApprove,
    reasons,
  };
}

/**
 * Check auto-approval eligibility for v1.0.0 loans (legacy compatibility)
 */
export async function checkAutoApprovalEligibilityV1(
  loan: ILoan,
  user: IUser,
  settings: ISystemSettings
): Promise<AutoApprovalCheck> {
  const reasons: string[] = [];
  let canAutoApprove = true;

  // Check 1: Amount within limit
  if (loan.amount > user.currentLimit) {
    canAutoApprove = false;
    reasons.push(`Amount K${loan.amount} exceeds user limit K${user.currentLimit}`);
  }

  // Check 2: User is trustworthy
  if (!user.isTrustworthy) {
    canAutoApprove = false;
    reasons.push('User is not marked as trustworthy');
  }

  // Check 3: Sufficient cash on hand
  if (settings.cashOnHand < loan.amount) {
    canAutoApprove = false;
    reasons.push(`Insufficient cash on hand: K${settings.cashOnHand} < K${loan.amount}`);
  }

  // Check 4: No overdue or active loans
  const hasActiveLoans = await Loan.exists({
    userId: user._id,
    status: {
      $in: [
        LoanStatus.OVERDUE,
        LoanStatus.APPLIED,
        LoanStatus.APPROVED,
        LoanStatus.DISBURSED,
      ],
    },
    _id: { $ne: loan._id }, // Exclude current loan
  });

  if (hasActiveLoans) {
    canAutoApprove = false;
    reasons.push('User has existing overdue or active loans');
  }

  if (canAutoApprove) {
    reasons.push('All conditions met for auto-approval');
  }

  return {
    canAutoApprove,
    reasons,
  };
}

/**
 * Check auto-approval eligibility with automatic version detection
 */
export async function checkAutoApprovalEligibility(
  loan: ILoan,
  user: IUser,
  settings: ISystemSettings
): Promise<AutoApprovalCheck> {
  // Use v2.0.0 logic by default, v1.0.0 only for explicitly marked loans
  if (loan.loanVersion === LoanVersion.V1) {
    return await checkAutoApprovalEligibilityV1(loan, user, settings);
  } else {
    return await checkAutoApprovalEligibilityV2(loan, user, settings);
  }
}

/**
 * Attempt to auto-approve loan and update status
 */
export async function tryAutoApprove(
  loan: ILoan,
  user: IUser,
  settings: ISystemSettings
): Promise<boolean> {
  const check = await checkAutoApprovalEligibility(loan, user, settings);

  if (check.canAutoApprove) {
    loan.status = LoanStatus.APPROVED;
    loan.isAutoApproved = true;
    loan.approvedAt = getPNGNow();
    
    // Add auto-approval metadata
    if (!loan.metadata) {
      loan.metadata = {};
    }
    loan.metadata.autoApprovalReasons = check.reasons;
    loan.metadata.autoApprovedAt = getPNGNow().toISOString();
    
    return true;
  }

  return false;
}

/**
 * Get auto-approval status for display to user
 */
export async function getAutoApprovalStatus(
  loanAmount: number,
  user: IUser,
  settings: ISystemSettings
): Promise<{ eligible: boolean; reasons: string[]; estimatedApprovalTime?: string }> {
  const reasons: string[] = [];
  let eligible = true;

  // Check if auto-approval is enabled
  if (!AUTO_APPROVAL_CONFIG.ENABLED) {
    eligible = false;
    reasons.push('⚠️ Auto-approval is currently disabled - manual review required');
    return { eligible, reasons, estimatedApprovalTime: '24-48 hours' };
  }

  // Amount checks
  if (loanAmount > user.currentLimit) {
    eligible = false;
    reasons.push(`❌ Amount K${loanAmount} exceeds your current limit of K${user.currentLimit}`);
  } else {
    reasons.push(`✅ Amount K${loanAmount} is within your limit of K${user.currentLimit}`);
  }

  if (loanAmount > AUTO_APPROVAL_CONFIG.MAX_AUTO_APPROVAL_AMOUNT) {
    eligible = false;
    reasons.push(`❌ Amount exceeds auto-approval maximum of K${AUTO_APPROVAL_CONFIG.MAX_AUTO_APPROVAL_AMOUNT}`);
  }

  // User status checks
  if (user.status === UserStatus.REBUILDING) {
    eligible = false;
    reasons.push('❌ Your account is in rebuilding status - make on-time payments to restore auto-approval');
  } else {
    reasons.push('✅ Account status is active');
  }

  // Trustworthy status
  if (AUTO_APPROVAL_CONFIG.TRUSTWORTHY_REQUIRED && !user.isTrustworthy) {
    eligible = false;
    const consecutiveNeeded = 2 - (user.consecutiveOnTimePayments || 0);
    const totalNeeded = 10 - (user.totalConsecutiveOnTimePayments || 0);
    reasons.push(`❌ Trustworthy status required - need ${Math.min(consecutiveNeeded, totalNeeded)} more on-time payment(s)`);
  } else if (user.isTrustworthy) {
    reasons.push(`✅ Trustworthy status verified (${user.trustworthyPath?.toLowerCase().replace('_', '-')} path)`);
  }

  // Cash availability
  const reserveAmount = settings.totalDisbursed * AUTO_APPROVAL_CONFIG.MIN_CASH_RESERVE_RATIO;
  const availableCash = settings.cashOnHand - reserveAmount;
  
  if (availableCash < loanAmount) {
    eligible = false;
    reasons.push('❌ Insufficient funds available for instant approval');
  } else {
    reasons.push('✅ Sufficient funds available');
  }

  // Active loans check
  const hasActiveLoans = await Loan.exists({
    userId: user._id,
    status: {
      $in: [
        LoanStatus.OVERDUE,
        LoanStatus.APPLIED,
        LoanStatus.APPROVED,
        LoanStatus.DISBURSED,
        'OVERDUE',
        'APPLIED',
        'APPROVED',
        'DISBURSED',
        'ACTIVE',
        'LATE',
      ],
    },
  });

  if (hasActiveLoans) {
    eligible = false;
    reasons.push('❌ You have an existing active or overdue loan');
  } else {
    reasons.push('✅ No existing active loans');
  }

  // KYC verification
  if (!user.kyc?.verified) {
    eligible = false;
    reasons.push('❌ KYC verification incomplete - please upload required documents');
  } else {
    reasons.push('✅ KYC verification complete');
  }

  // Recent defaults check
  const recentDefaults = await Loan.countDocuments({
    userId: user._id,
    status: { $in: [LoanStatus.DEFAULTED, 'DEFAULTED'] },
    updatedAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
  });

  if (recentDefaults > 0) {
    eligible = false;
    reasons.push(`❌ ${recentDefaults} defaulted loan(s) in the last 90 days`);
  } else {
    reasons.push('✅ No recent defaults');
  }

  // Estimated approval time
  let estimatedApprovalTime = 'Instant';
  if (!eligible) {
    if (user.status === UserStatus.REBUILDING || !user.isTrustworthy) {
      estimatedApprovalTime = '24-48 hours (manual review)';
    } else {
      estimatedApprovalTime = '2-4 hours (admin review)';
    }
  }

  // Final message
  if (eligible) {
    reasons.push('🚀 Eligible for instant auto-approval!');
  } else {
    reasons.push('📋 Manual review required - application will be processed by admin');
  }

  return { eligible, reasons, estimatedApprovalTime };
}

/**
 * Get auto-approval statistics for admin dashboard
 */
export async function getAutoApprovalStatistics(days: number = 30): Promise<{
  totalApplications: number;
  autoApproved: number;
  manualReview: number;
  autoApprovalRate: number;
  averageApprovalTime: number;
  topDeclineReasons: Array<{ reason: string; count: number }>;
}> {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const totalApplications = await Loan.countDocuments({
    createdAt: { $gte: startDate },
  });
  
  const autoApproved = await Loan.countDocuments({
    createdAt: { $gte: startDate },
    isAutoApproved: true,
  });
  
  const manualReview = totalApplications - autoApproved;
  const autoApprovalRate = totalApplications > 0 ? (autoApproved / totalApplications) * 100 : 0;
  
  // Calculate average approval time (simplified)
  const approvedLoans = await Loan.find({
    createdAt: { $gte: startDate },
    status: { $in: [LoanStatus.APPROVED, LoanStatus.DISBURSED, LoanStatus.REPAID, 'APPROVED', 'DISBURSED', 'REPAID', 'PAID'] },
    approvedAt: { $exists: true },
  });
  
  let totalApprovalTime = 0;
  for (const loan of approvedLoans) {
    if (loan.approvedAt) {
      totalApprovalTime += loan.approvedAt.getTime() - loan.createdAt.getTime();
    }
  }
  
  const averageApprovalTime = approvedLoans.length > 0 ? 
    totalApprovalTime / approvedLoans.length / (1000 * 60 * 60) : 0; // in hours
  
  // Top decline reasons (simplified - would need to track rejection reasons)
  const topDeclineReasons = [
    { reason: 'Exceeds credit limit', count: Math.floor(manualReview * 0.3) },
    { reason: 'Not trustworthy', count: Math.floor(manualReview * 0.25) },
    { reason: 'Existing active loan', count: Math.floor(manualReview * 0.2) },
    { reason: 'Insufficient funds', count: Math.floor(manualReview * 0.15) },
    { reason: 'KYC incomplete', count: Math.floor(manualReview * 0.1) },
  ];
  
  return {
    totalApplications,
    autoApproved,
    manualReview,
    autoApprovalRate,
    averageApprovalTime,
    topDeclineReasons,
  };
}

/**
 * Update auto-approval configuration
 */
export function updateAutoApprovalConfig(config: {
  enabled?: boolean;
  maxAmount?: number;
  minCashReserveRatio?: number;
  trustworthyRequired?: boolean;
}): void {
  if (config.enabled !== undefined) {
    process.env.AUTO_APPROVAL_ENABLED = config.enabled.toString();
  }
  if (config.maxAmount !== undefined) {
    process.env.MAX_AUTO_APPROVAL_AMOUNT = config.maxAmount.toString();
  }
  if (config.minCashReserveRatio !== undefined) {
    process.env.MIN_CASH_RESERVE_RATIO = config.minCashReserveRatio.toString();
  }
  if (config.trustworthyRequired !== undefined) {
    process.env.TRUSTWORTHY_REQUIRED_FOR_AUTO = config.trustworthyRequired.toString();
  }
}

// Legacy function for backward compatibility
export { checkAutoApprovalEligibility as checkAutoApprovalEligibilityV2 };

