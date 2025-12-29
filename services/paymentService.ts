/**
 * Enhanced Payment Service (v2.0.0)
 * 
 * Handles payment allocation with daily interest accrual:
 * - Interest-first allocation (accrued interest → principal)
 * - Real-time interest calculation to payment date
 * - Partial payment support with principal reduction
 * - Complete audit trail for regulatory compliance
 * - Backward compatibility with v1.0.0 loans
 */

import { ILoan, IPayment, LoanVersion } from '@/types';
import { 
  calculateInterestToDate, 
  allocatePayment, 
  calculateTotalDue,
  determineLoanStatus,
  PaymentAllocationResult 
} from './interestService';
import { getPNGNow } from '@/lib/timezone';
import { createInterestCalculationRecord } from '@/models/InterestCalculation';

/**
 * Payment processing result
 */
export interface PaymentProcessingResult {
  success: boolean;
  allocation: PaymentAllocationResult;
  newLoanStatus: string;
  isFullyRepaid: boolean;
  auditTrail: string;
  error?: string;
}

/**
 * Payment breakdown for display
 */
export interface PaymentBreakdown {
  outstandingPrincipal: number;
  accruedInterest: number;
  totalDue: number;
  totalPaid: number;
  remainingBalance: number;
  isFullyRepaid: boolean;
  daysOverdue: number;
  status: string;
}

/**
 * Process payment for v2.0.0 loans (interest-first allocation)
 */
export async function processPaymentV2(
  loan: ILoan,
  paymentAmount: number,
  paymentDate?: Date
): Promise<PaymentProcessingResult> {
  try {
    const targetDate = paymentDate || getPNGNow();
    
    // Validate payment amount
    if (paymentAmount <= 0) {
      return {
        success: false,
        allocation: {} as PaymentAllocationResult,
        newLoanStatus: loan.status,
        isFullyRepaid: false,
        auditTrail: '',
        error: 'Payment amount must be positive',
      };
    }

    // Calculate current interest and allocate payment
    const allocation = allocatePayment(loan, paymentAmount, targetDate);
    
    // Determine new loan status
    const newLoanStatus = allocation.isFullyRepaid ? 'PAID' : determineLoanStatus({
      ...loan,
      outstandingPrincipal: allocation.newOutstandingPrincipal,
      accruedInterest: allocation.newAccruedInterest,
    } as ILoan, targetDate);

    // Create audit trail
    const auditTrail = [
      `Payment Date: ${targetDate.toISOString()}`,
      `Payment Amount: K${paymentAmount.toFixed(2)}`,
      `Interest Portion: K${allocation.interestPortion.toFixed(2)}`,
      `Principal Portion: K${allocation.principalPortion.toFixed(2)}`,
      `Remaining Payment: K${allocation.remainingPayment.toFixed(2)}`,
      `New Outstanding Principal: K${allocation.newOutstandingPrincipal.toFixed(2)}`,
      `New Accrued Interest: K${allocation.newAccruedInterest.toFixed(2)}`,
      `Fully Repaid: ${allocation.isFullyRepaid}`,
      `New Status: ${newLoanStatus}`,
    ].join(' | ');

    // Create interest calculation record for audit
    if (allocation.interestPortion > 0) {
      const interestCalc = calculateInterestToDate(loan, targetDate);
      await createInterestCalculationRecord({
        loanId: loan._id.toString(),
        calculationDate: targetDate,
        lastCalculationDate: loan.lastInterestCalcDate || loan.disbursedAt || loan.createdAt,
        daysElapsed: interestCalc.daysElapsed,
        outstandingPrincipal: loan.outstandingPrincipal || loan.amount,
        annualInterestRate: loan.annualInterestRate || parseFloat(process.env.ANNUAL_INTEREST_RATE || '4.00'),
        dailyInterestRate: interestCalc.dailyRate,
        interestAccrued: interestCalc.interestAccrued,
        totalAccruedBefore: loan.accruedInterest || 0,
        totalAccruedAfter: allocation.newAccruedInterest,
        interestCap: interestCalc.interestCap,
        isCapReached: interestCalc.isCapReached,
        calculationType: 'payment_calculation',
        triggeredBy: 'payment_processing',
        auditTrail: interestCalc.auditTrail,
      });
    }

    return {
      success: true,
      allocation,
      newLoanStatus,
      isFullyRepaid: allocation.isFullyRepaid,
      auditTrail,
    };
  } catch (error) {
    return {
      success: false,
      allocation: {} as PaymentAllocationResult,
      newLoanStatus: loan.status,
      isFullyRepaid: false,
      auditTrail: '',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Process payment for v1.0.0 loans (original logic)
 */
export function processPaymentV1(
  loan: ILoan,
  paymentAmount: number
): PaymentProcessingResult {
  try {
    // Original v1.0.0 logic: principal-first allocation
    const remainingPrincipal = loan.amount - (loan.totalPrincipalRepaid || 0);
    const remainingInterest = loan.interestAmount - (loan.totalInterestRepaid || 0);

    let principalPaid = Math.min(paymentAmount, remainingPrincipal);
    let interestPaid = Math.min(paymentAmount - principalPaid, remainingInterest);
    let remainingPayment = paymentAmount - principalPaid - interestPaid;

    const newPrincipalRepaid = (loan.totalPrincipalRepaid || 0) + principalPaid;
    const newInterestRepaid = (loan.totalInterestRepaid || 0) + interestPaid;
    const isFullyRepaid = newPrincipalRepaid >= loan.amount && newInterestRepaid >= loan.interestAmount;

    const allocation: PaymentAllocationResult = {
      interestPortion: interestPaid,
      principalPortion: principalPaid,
      remainingPayment,
      newOutstandingPrincipal: loan.amount - newPrincipalRepaid,
      newAccruedInterest: loan.interestAmount - newInterestRepaid,
      isFullyRepaid,
    };

    const auditTrail = [
      `V1.0.0 Payment Processing`,
      `Payment Amount: K${paymentAmount.toFixed(2)}`,
      `Principal Paid: K${principalPaid.toFixed(2)}`,
      `Interest Paid: K${interestPaid.toFixed(2)}`,
      `Remaining: K${remainingPayment.toFixed(2)}`,
      `Fully Repaid: ${isFullyRepaid}`,
    ].join(' | ');

    return {
      success: true,
      allocation,
      newLoanStatus: isFullyRepaid ? 'REPAID' : loan.status,
      isFullyRepaid,
      auditTrail,
    };
  } catch (error) {
    return {
      success: false,
      allocation: {} as PaymentAllocationResult,
      newLoanStatus: loan.status,
      isFullyRepaid: false,
      auditTrail: '',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Process payment with automatic version detection
 */
export async function processPayment(
  loan: ILoan,
  paymentAmount: number,
  paymentDate?: Date
): Promise<PaymentProcessingResult> {
  // Route to appropriate version
  if (loan.loanVersion === LoanVersion.V2) {
    return await processPaymentV2(loan, paymentAmount, paymentDate);
  } else {
    return processPaymentV1(loan, paymentAmount);
  }
}

/**
 * Get payment breakdown for display (version-aware)
 */
export function getPaymentBreakdown(loan: ILoan, asOfDate?: Date): PaymentBreakdown {
  const targetDate = asOfDate || getPNGNow();

  if (loan.loanVersion === LoanVersion.V2) {
    // v2.0.0: Use real-time interest calculation
    const totalDue = calculateTotalDue(loan, targetDate);
    const outstandingPrincipal = loan.outstandingPrincipal || loan.amount;
    const interestCalc = calculateInterestToDate(loan, targetDate);
    const accruedInterest = interestCalc.totalAccrued;
    const totalPaid = loan.amount - outstandingPrincipal;
    const remainingBalance = totalDue;
    const isFullyRepaid = remainingBalance <= 0.01;
    const status = determineLoanStatus(loan, targetDate);

    return {
      outstandingPrincipal,
      accruedInterest,
      totalDue,
      totalPaid,
      remainingBalance,
      isFullyRepaid,
      daysOverdue: Math.max(0, Math.ceil((targetDate.getTime() - loan.dueDate.getTime()) / (1000 * 60 * 60 * 24))),
      status,
    };
  } else {
    // v1.0.0: Use original fixed calculation
    const totalPaid = (loan.totalPrincipalRepaid || 0) + (loan.totalInterestRepaid || 0);
    const remainingPrincipal = loan.amount - (loan.totalPrincipalRepaid || 0);
    const remainingInterest = loan.interestAmount - (loan.totalInterestRepaid || 0);
    const totalDue = remainingPrincipal + remainingInterest;
    const isFullyRepaid = totalDue <= 0.01;

    return {
      outstandingPrincipal: remainingPrincipal,
      accruedInterest: remainingInterest,
      totalDue,
      totalPaid,
      remainingBalance: totalDue,
      isFullyRepaid,
      daysOverdue: Math.max(0, Math.ceil((targetDate.getTime() - loan.dueDate.getTime()) / (1000 * 60 * 60 * 24))),
      status: loan.status,
    };
  }
}

/**
 * Check if loan is fully repaid (version-aware)
 */
export function isLoanFullyRepaid(loan: ILoan, asOfDate?: Date): boolean {
  const breakdown = getPaymentBreakdown(loan, asOfDate);
  return breakdown.isFullyRepaid;
}

/**
 * Calculate next payment amount needed (version-aware)
 */
export function getNextPaymentAmount(loan: ILoan, asOfDate?: Date): number {
  const breakdown = getPaymentBreakdown(loan, asOfDate);
  return Math.max(0, breakdown.remainingBalance);
}

/**
 * Validate payment amount
 */
export function validatePaymentAmount(
  loan: ILoan,
  paymentAmount: number,
  asOfDate?: Date
): { isValid: boolean; error?: string } {
  if (paymentAmount <= 0) {
    return { isValid: false, error: 'Payment amount must be positive' };
  }

  const breakdown = getPaymentBreakdown(loan, asOfDate);
  
  if (breakdown.isFullyRepaid) {
    return { isValid: false, error: 'Loan is already fully repaid' };
  }

  // Check if loan is in a payable status
  if (loan.status === 'APPLIED' || loan.status === 'APPROVED') {
    return { isValid: false, error: 'Cannot make payment on loan that has not been disbursed' };
  }

  // Allow overpayment (will be handled in allocation)
  return { isValid: true };
}

/**
 * Calculate minimum payment required (for partial payments)
 */
export function getMinimumPaymentRequired(loan: ILoan, asOfDate?: Date): number {
  const targetDate = asOfDate || getPNGNow();
  
  if (loan.loanVersion === LoanVersion.V2) {
    // For v2.0.0, minimum payment is accrued interest
    const interestCalc = calculateInterestToDate(loan, targetDate);
    return Math.max(1, interestCalc.totalAccrued); // At least K1
  } else {
    // For v1.0.0, minimum payment is K1
    return 1;
  }
}

/**
 * Get payment history summary for a loan
 */
export function getPaymentHistorySummary(payments: IPayment[]): {
  totalPayments: number;
  totalAmount: number;
  totalPrincipal: number;
  totalInterest: number;
  lastPaymentDate?: Date;
} {
  const summary = payments.reduce(
    (acc, payment) => {
      if (payment.status === 'VERIFIED') {
        acc.totalPayments += 1;
        acc.totalAmount += payment.amount;
        acc.totalPrincipal += payment.principalPortion || payment.principalPaid || 0;
        acc.totalInterest += payment.interestPortion || payment.interestPaid || 0;
        
        if (!acc.lastPaymentDate || payment.verifiedAt! > acc.lastPaymentDate) {
          acc.lastPaymentDate = payment.verifiedAt!;
        }
      }
      return acc;
    },
    {
      totalPayments: 0,
      totalAmount: 0,
      totalPrincipal: 0,
      totalInterest: 0,
      lastPaymentDate: undefined as Date | undefined,
    }
  );

  return {
    ...summary,
    totalAmount: Math.round(summary.totalAmount * 100) / 100,
    totalPrincipal: Math.round(summary.totalPrincipal * 100) / 100,
    totalInterest: Math.round(summary.totalInterest * 100) / 100,
  };
}

// Legacy functions for backward compatibility
export function allocatePartialPayment(
  loan: ILoan,
  paymentAmount: number
): {
  principalPaid: number;
  interestPaid: number;
  remainingPrincipal: number;
  remainingInterest: number;
  isFullyPaid: boolean;
} {
  const remainingPrincipal = loan.amount - (loan.totalPrincipalRepaid || 0);
  const remainingInterest = loan.interestAmount - (loan.totalInterestRepaid || 0);

  // Allocate to principal first (v1.0.0 logic)
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

export function getRemainingAmount(loan: ILoan): number {
  const remainingPrincipal = loan.amount - (loan.totalPrincipalRepaid || 0);
  const remainingInterest = loan.interestAmount - (loan.totalInterestRepaid || 0);
  return remainingPrincipal + remainingInterest;
}

export function getPaymentProgress(loan: ILoan): number {
  const totalPaid = (loan.totalPrincipalRepaid || 0) + (loan.totalInterestRepaid || 0);
  const totalRequired = loan.totalRepayable;
  return Math.min((totalPaid / totalRequired) * 100, 100);
}

export function isPaymentOnTime(dueDate: Date, paymentDate: Date = new Date()): boolean {
  return paymentDate <= dueDate;
}

