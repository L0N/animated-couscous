import { ILoan, IUser, ISystemSettings, LoanStatus } from '@/types';
import { AutoApprovalCheck } from '@/types/services';
import Loan from '@/models/Loan';

/**
 * Check if loan meets all 4 auto-approval conditions:
 * 1. Amount <= user's current limit
 * 2. User is trustworthy
 * 3. System has sufficient cash on hand
 * 4. User has no overdue/active loans
 */
export async function checkAutoApprovalEligibility(
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
 * Attempt to auto-approve loan and update status
 * Returns true if auto-approved, false otherwise
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
    return true;
  }

  return false;
}

/**
 * Get reasons why a loan cannot be auto-approved (for display)
 */
export async function getAutoApprovalStatus(
  loanAmount: number,
  user: IUser,
  settings: ISystemSettings
): Promise<{ eligible: boolean; reasons: string[] }> {
  const reasons: string[] = [];
  let eligible = true;

  if (loanAmount > user.currentLimit) {
    eligible = false;
    reasons.push(`Amount exceeds your current limit of K${user.currentLimit}`);
  }

  if (!user.isTrustworthy) {
    eligible = false;
    reasons.push('Your account is not yet marked as trustworthy');
  }

  if (settings.cashOnHand < loanAmount) {
    eligible = false;
    reasons.push('Insufficient funds available for auto-approval');
  }

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
  });

  if (hasActiveLoans) {
    eligible = false;
    reasons.push('You have an existing active or overdue loan');
  }

  if (eligible) {
    reasons.push('✅ Eligible for instant auto-approval!');
  }

  return { eligible, reasons };
}

