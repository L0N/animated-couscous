/**
 * Daily Interest Calculation Service (v2.0.0)
 * 
 * Handles all interest accrual calculations with:
 * - Configurable annual rates (2 decimal precision)
 * - Daily accrual in PNG timezone
 * - Interest caps and minimum charges
 * - Complete audit trail
 * - Deterministic calculations
 */

import { getPNGNow, getDaysBetween, getPNGStartOfDay, addDays } from '@/lib/timezone';
import { ILoan } from '@/types';

/**
 * Interest calculation configuration
 */
interface InterestConfig {
  annualRate: number;        // Annual interest rate (e.g., 4.00 = 400%)
  minInterestDays: number;   // Minimum interest charge period
  interestCapEnabled: boolean; // Whether to enforce interest cap
  maxTermStandard: number;   // Maximum term for standard loans
  maxTermWithPartial: number; // Maximum term for loans with partial payments
}

/**
 * Interest calculation result
 */
export interface InterestCalculationResult {
  dailyRate: number;
  daysElapsed: number;
  interestAccrued: number;
  totalAccrued: number;
  interestCap: number;
  isCapReached: boolean;
  calculationDate: Date;
  auditTrail: string;
}

/**
 * Payment allocation result
 */
export interface PaymentAllocationResult {
  interestPortion: number;
  principalPortion: number;
  remainingPayment: number;
  newOutstandingPrincipal: number;
  newAccruedInterest: number;
  isFullyRepaid: boolean;
}

/**
 * Get interest configuration from environment variables
 */
export function getInterestConfig(): InterestConfig {
  return {
    annualRate: parseFloat(process.env.ANNUAL_INTEREST_RATE || '4.00'),
    minInterestDays: parseInt(process.env.MIN_INTEREST_DAYS || '14'),
    interestCapEnabled: process.env.INTEREST_CAP_ENABLED === 'true',
    maxTermStandard: parseInt(process.env.MAX_LOAN_TERM_STANDARD || '90'),
    maxTermWithPartial: parseInt(process.env.MAX_LOAN_TERM_WITH_PARTIAL || '100'),
  };
}

/**
 * Calculate daily interest rate from annual rate
 * Formula: dailyRate = annualRate / 365
 */
export function calculateDailyRate(annualRate: number): number {
  if (annualRate < 0) {
    throw new Error('Annual interest rate cannot be negative');
  }
  
  // Convert percentage to decimal and divide by 365 days
  const dailyRate = (annualRate / 100) / 365;
  
  // Round to 8 decimal places for precision
  return Math.round(dailyRate * 100000000) / 100000000;
}

/**
 * Calculate interest cap for a loan
 * Formula: interestCap = principal × (annualRate / 100)
 */
export function calculateInterestCap(principal: number, annualRate: number): number {
  if (principal < 0 || annualRate < 0) {
    throw new Error('Principal and annual rate must be non-negative');
  }
  
  const cap = principal * (annualRate / 100);
  
  // Round to 2 decimal places (currency precision)
  return Math.round(cap * 100) / 100;
}

/**
 * Calculate minimum interest charge
 * Formula: minInterest = principal × dailyRate × minDays
 */
export function calculateMinimumInterest(
  principal: number,
  annualRate: number,
  minDays: number
): number {
  const dailyRate = calculateDailyRate(annualRate);
  const minInterest = principal * dailyRate * minDays;
  
  // Round to 2 decimal places
  return Math.round(minInterest * 100) / 100;
}

/**
 * Calculate accrued interest for a period
 * Formula: accruedInterest = outstandingPrincipal × dailyRate × daysElapsed
 */
export function calculateAccruedInterest(
  outstandingPrincipal: number,
  annualRate: number,
  daysElapsed: number
): number {
  if (outstandingPrincipal < 0 || annualRate < 0 || daysElapsed < 0) {
    throw new Error('All parameters must be non-negative');
  }
  
  const dailyRate = calculateDailyRate(annualRate);
  const accruedInterest = outstandingPrincipal * dailyRate * daysElapsed;
  
  // Round to 2 decimal places
  return Math.round(accruedInterest * 100) / 100;
}

/**
 * Calculate interest for a loan from last calculation date to now
 */
export function calculateInterestToDate(
  loan: ILoan,
  targetDate?: Date
): InterestCalculationResult {
  const config = getInterestConfig();
  const calculationDate = targetDate || getPNGNow();
  
  // Determine last calculation date
  const lastCalcDate = loan.lastInterestCalcDate || loan.disbursedAt || loan.createdAt;
  
  // Calculate days elapsed since last calculation
  const daysElapsed = getDaysBetween(lastCalcDate, calculationDate);
  
  // Skip calculation if no days have elapsed
  if (daysElapsed <= 0) {
    return {
      dailyRate: calculateDailyRate(config.annualRate),
      daysElapsed: 0,
      interestAccrued: 0,
      totalAccrued: loan.accruedInterest || 0,
      interestCap: calculateInterestCap(loan.amount, config.annualRate),
      isCapReached: false,
      calculationDate,
      auditTrail: `No calculation needed - no days elapsed since ${lastCalcDate.toISOString()}`,
    };
  }
  
  // Calculate new interest accrued
  const outstandingPrincipal = loan.outstandingPrincipal || loan.amount;
  const interestAccrued = calculateAccruedInterest(
    outstandingPrincipal,
    config.annualRate,
    daysElapsed
  );
  
  // Calculate total accrued interest
  const previousAccrued = loan.accruedInterest || 0;
  let totalAccrued = previousAccrued + interestAccrued;
  
  // Apply interest cap if enabled
  const interestCap = calculateInterestCap(loan.amount, config.annualRate);
  let isCapReached = false;
  
  if (config.interestCapEnabled && totalAccrued > interestCap) {
    totalAccrued = interestCap;
    isCapReached = true;
  }
  
  // Create audit trail
  const auditTrail = [
    `Calculation Date: ${calculationDate.toISOString()}`,
    `Last Calc Date: ${lastCalcDate.toISOString()}`,
    `Days Elapsed: ${daysElapsed}`,
    `Outstanding Principal: K${outstandingPrincipal.toFixed(2)}`,
    `Annual Rate: ${config.annualRate}%`,
    `Daily Rate: ${calculateDailyRate(config.annualRate).toFixed(8)}`,
    `Interest Accrued: K${interestAccrued.toFixed(2)}`,
    `Previous Accrued: K${previousAccrued.toFixed(2)}`,
    `Total Accrued: K${totalAccrued.toFixed(2)}`,
    `Interest Cap: K${interestCap.toFixed(2)}`,
    `Cap Reached: ${isCapReached}`,
  ].join(' | ');
  
  return {
    dailyRate: calculateDailyRate(config.annualRate),
    daysElapsed,
    interestAccrued,
    totalAccrued,
    interestCap,
    isCapReached,
    calculationDate,
    auditTrail,
  };
}

/**
 * Allocate payment between interest and principal (interest-first)
 */
export function allocatePayment(
  loan: ILoan,
  paymentAmount: number,
  paymentDate?: Date
): PaymentAllocationResult {
  if (paymentAmount <= 0) {
    throw new Error('Payment amount must be positive');
  }
  
  const targetDate = paymentDate || getPNGNow();
  
  // Calculate accrued interest up to payment date
  const interestCalc = calculateInterestToDate(loan, targetDate);
  const currentAccruedInterest = interestCalc.totalAccrued;
  const currentOutstandingPrincipal = loan.outstandingPrincipal || loan.amount;
  
  let remainingPayment = paymentAmount;
  let interestPortion = 0;
  let principalPortion = 0;
  
  // Step 1: Pay accrued interest first
  if (currentAccruedInterest > 0 && remainingPayment > 0) {
    interestPortion = Math.min(remainingPayment, currentAccruedInterest);
    remainingPayment -= interestPortion;
  }
  
  // Step 2: Pay principal with remaining amount
  if (remainingPayment > 0) {
    principalPortion = Math.min(remainingPayment, currentOutstandingPrincipal);
    remainingPayment -= principalPortion;
  }
  
  // Calculate new balances
  const newAccruedInterest = Math.max(0, currentAccruedInterest - interestPortion);
  const newOutstandingPrincipal = Math.max(0, currentOutstandingPrincipal - principalPortion);
  
  // Check if loan is fully repaid
  const isFullyRepaid = newOutstandingPrincipal === 0 && newAccruedInterest === 0;
  
  return {
    interestPortion: Math.round(interestPortion * 100) / 100,
    principalPortion: Math.round(principalPortion * 100) / 100,
    remainingPayment: Math.round(remainingPayment * 100) / 100,
    newOutstandingPrincipal: Math.round(newOutstandingPrincipal * 100) / 100,
    newAccruedInterest: Math.round(newAccruedInterest * 100) / 100,
    isFullyRepaid,
  };
}

/**
 * Calculate total amount due for a loan
 */
export function calculateTotalDue(loan: ILoan, asOfDate?: Date): number {
  const targetDate = asOfDate || getPNGNow();
  const interestCalc = calculateInterestToDate(loan, targetDate);
  const outstandingPrincipal = loan.outstandingPrincipal || loan.amount;
  
  const totalDue = outstandingPrincipal + interestCalc.totalAccrued;
  return Math.round(totalDue * 100) / 100;
}

/**
 * Check if loan is overdue
 */
export function isLoanOverdue(loan: ILoan, asOfDate?: Date): boolean {
  const checkDate = asOfDate || getPNGNow();
  return checkDate > loan.dueDate;
}

/**
 * Calculate days overdue
 */
export function getDaysOverdue(loan: ILoan, asOfDate?: Date): number {
  const checkDate = asOfDate || getPNGNow();
  
  if (checkDate <= loan.dueDate) {
    return 0;
  }
  
  return getDaysBetween(loan.dueDate, checkDate);
}

/**
 * Determine loan status based on payment and overdue status
 */
export function determineLoanStatus(loan: ILoan, asOfDate?: Date): string {
  const checkDate = asOfDate || getPNGNow();
  const totalDue = calculateTotalDue(loan, checkDate);
  const daysOverdue = getDaysOverdue(loan, checkDate);
  
  // Check if fully repaid
  if (totalDue <= 0.01) { // Allow for rounding errors
    return 'PAID';
  }
  
  // Check if defaulted (14+ days overdue)
  if (daysOverdue >= 14) {
    return 'DEFAULTED';
  }
  
  // Check if late (1-13 days overdue)
  if (daysOverdue > 0) {
    return 'LATE';
  }
  
  // Active loan
  return 'ACTIVE';
}

/**
 * Freeze interest at default (day 14+)
 * Returns the final interest amount that should be charged
 */
export function freezeInterestAtDefault(loan: ILoan, defaultDate?: Date): number {
  const freezeDate = defaultDate || getPNGNow();
  
  // Calculate interest up to default date
  const interestCalc = calculateInterestToDate(loan, freezeDate);
  
  // This becomes the final interest charge - no more accrual
  return interestCalc.totalAccrued;
}

/**
 * Validate interest calculation for audit purposes
 */
export function validateInterestCalculation(
  principal: number,
  annualRate: number,
  days: number,
  expectedInterest: number,
  tolerance: number = 0.01
): boolean {
  const calculatedInterest = calculateAccruedInterest(principal, annualRate, days);
  const difference = Math.abs(calculatedInterest - expectedInterest);
  
  return difference <= tolerance;
}

/**
 * Get interest calculation summary for reporting
 */
export function getInterestSummary(loan: ILoan, asOfDate?: Date) {
  const targetDate = asOfDate || getPNGNow();
  const config = getInterestConfig();
  const interestCalc = calculateInterestToDate(loan, targetDate);
  const totalDue = calculateTotalDue(loan, targetDate);
  const daysOverdue = getDaysOverdue(loan, targetDate);
  const status = determineLoanStatus(loan, targetDate);
  
  return {
    loanId: loan._id,
    loanReference: loan.reference,
    originalAmount: loan.amount,
    outstandingPrincipal: loan.outstandingPrincipal || loan.amount,
    accruedInterest: interestCalc.totalAccrued,
    totalDue,
    dailyRate: interestCalc.dailyRate,
    annualRate: config.annualRate,
    interestCap: interestCalc.interestCap,
    isCapReached: interestCalc.isCapReached,
    daysOverdue,
    status,
    lastCalculationDate: loan.lastInterestCalcDate,
    calculationDate: targetDate,
    auditTrail: interestCalc.auditTrail,
  };
}

