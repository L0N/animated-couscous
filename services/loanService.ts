import { IUser } from '@/types';
import { InterestCalculation, LoanCalculation } from '@/types/services';

// Base interest rates by term
const BASE_RATES: Record<number, number> = {
  14: 0.30, // 30%
  30: 0.60, // 60%
  60: 0.75, // 75%
  90: 1.00, // 100%
};

/**
 * Calculate interest rate with trustworthy customer discount
 * Discount formula: floor((baseRate * 100 / 6) / 5) * 5 percentage points
 * Example: 75% rate → 12.5% → 12% → 10% discount → 65% final rate
 */
export function calculateInterest(
  amount: number,
  termDays: number,
  isTrustworthy: boolean
): InterestCalculation {
  const baseRate = BASE_RATES[termDays];
  
  if (!baseRate) {
    throw new Error(`Invalid term: ${termDays} days`);
  }

  let finalRate = baseRate;
  let discountPercentage = 0;

  if (isTrustworthy) {
    // Calculate discount in percentage points
    const discountPoints = Math.floor((baseRate * 100 / 6) / 5) * 5;
    discountPercentage = discountPoints;
    finalRate = baseRate - (discountPoints / 100);
  }

  const interestAmount = amount * finalRate;

  return {
    rate: finalRate,
    amount: interestAmount,
    discountPercentage,
    isTrustworthy,
  };
}

/**
 * Calculate complete loan details
 */
export function calculateLoanDetails(
  amount: number,
  termDays: number,
  isTrustworthy: boolean
): LoanCalculation {
  const interest = calculateInterest(amount, termDays, isTrustworthy);
  const totalRepayable = amount + interest.amount;
  
  // Calculate due date
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + termDays);

  return {
    amount,
    termDays,
    interestRate: interest.rate,
    interestAmount: Math.round(interest.amount * 100) / 100, // Round to 2 decimals
    totalRepayable: Math.round(totalRepayable * 100) / 100,
    dueDate,
  };
}

/**
 * Check if amount is within user's tier limit
 */
export function isWithinLimit(amount: number, userLimit: number): boolean {
  return amount > 0 && amount <= userLimit;
}

/**
 * Get available loan terms for display
 */
export function getAvailableTerms(): Array<{ days: number; label: string; rate: number }> {
  return [
    { days: 14, label: '14 days (2 weeks)', rate: BASE_RATES[14] },
    { days: 30, label: '30 days (1 month)', rate: BASE_RATES[30] },
    { days: 60, label: '60 days (2 months)', rate: BASE_RATES[60] },
    { days: 90, label: '90 days (3 months)', rate: BASE_RATES[90] },
  ];
}

/**
 * Format currency for PNG Kina
 */
export function formatCurrency(amount: number): string {
  return `K${amount.toFixed(2)}`;
}

/**
 * Calculate days until due date
 */
export function getDaysUntilDue(dueDate: Date): number {
  const now = new Date();
  const diff = dueDate.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Calculate days overdue
 */
export function getDaysOverdue(dueDate: Date): number {
  const now = new Date();
  const diff = now.getTime() - dueDate.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

