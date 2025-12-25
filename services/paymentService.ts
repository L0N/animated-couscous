import { ILoan } from '@/types';
import { PaymentAllocation } from '@/types/services';

/**
 * Allocate partial payment to principal first, then interest
 */
export function allocatePartialPayment(
  loan: ILoan,
  paymentAmount: number
): PaymentAllocation {
  const remainingPrincipal = loan.amount - (loan.totalPrincipalRepaid || 0);
  const remainingInterest = loan.interestAmount - (loan.totalInterestRepaid || 0);

  // Allocate to principal first
  let principalPaid = Math.min(paymentAmount, remainingPrincipal);
  let interestPaid = 0;

  // If payment exceeds remaining principal, allocate rest to interest
  if (paymentAmount > remainingPrincipal) {
    interestPaid = Math.min(paymentAmount - principalPaid, remainingInterest);
  }

  const isFullyPaid = 
    (remainingPrincipal - principalPaid) === 0 && 
    (remainingInterest - interestPaid) === 0;

  return {
    principalPaid,
    interestPaid,
    remainingPrincipal: remainingPrincipal - principalPaid,
    remainingInterest: remainingInterest - interestPaid,
    isFullyPaid,
  };
}

/**
 * Calculate total amount remaining on loan
 */
export function getRemainingAmount(loan: ILoan): number {
  const remainingPrincipal = loan.amount - (loan.totalPrincipalRepaid || 0);
  const remainingInterest = loan.interestAmount - (loan.totalInterestRepaid || 0);
  return remainingPrincipal + remainingInterest;
}

/**
 * Calculate payment progress percentage
 */
export function getPaymentProgress(loan: ILoan): number {
  const totalPaid = (loan.totalPrincipalRepaid || 0) + (loan.totalInterestRepaid || 0);
  const totalRequired = loan.totalRepayable;
  return Math.min((totalPaid / totalRequired) * 100, 100);
}

/**
 * Check if payment is on time (before or on due date)
 */
export function isPaymentOnTime(dueDate: Date, paymentDate: Date = new Date()): boolean {
  return paymentDate <= dueDate;
}

/**
 * Check if loan is fully repaid
 */
export function isLoanFullyRepaid(loan: ILoan): boolean {
  const principalPaid = loan.totalPrincipalRepaid || 0;
  const interestPaid = loan.totalInterestRepaid || 0;
  
  return principalPaid >= loan.amount && interestPaid >= loan.interestAmount;
}

/**
 * Get payment breakdown for display
 */
export function getPaymentBreakdown(loan: ILoan): {
  principal: { total: number; paid: number; remaining: number };
  interest: { total: number; paid: number; remaining: number };
  total: { total: number; paid: number; remaining: number };
} {
  const principalPaid = loan.totalPrincipalRepaid || 0;
  const interestPaid = loan.totalInterestRepaid || 0;

  return {
    principal: {
      total: loan.amount,
      paid: principalPaid,
      remaining: loan.amount - principalPaid,
    },
    interest: {
      total: loan.interestAmount,
      paid: interestPaid,
      remaining: loan.interestAmount - interestPaid,
    },
    total: {
      total: loan.totalRepayable,
      paid: principalPaid + interestPaid,
      remaining: (loan.amount - principalPaid) + (loan.interestAmount - interestPaid),
    },
  };
}

