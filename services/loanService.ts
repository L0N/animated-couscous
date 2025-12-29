/**
 * Enhanced Loan Service (v2.0.0)
 * 
 * Overhauled for daily-accruing interest calculations:
 * - Configurable annual interest rates (2 decimal precision)
 * - Time-based loan term handling (14-90 days standard, 100 days with partial payments)
 * - Interest cap calculation and enforcement
 * - Minimum interest charge logic
 * - Backward compatibility for v1.0.0 loan processing
 * - PNG timezone-aware date calculations
 */

import { IUser, LoanVersion } from '@/types';
import { InterestCalculation, LoanCalculation } from '@/types/services';
import { getPNGNow, addDays, getDaysBetween } from '@/lib/timezone';

/**
 * Loan configuration
 */
export const LOAN_CONFIG = {
  // Interest rates
  ANNUAL_INTEREST_RATE: parseFloat(process.env.ANNUAL_INTEREST_RATE || '4.00'),
  INTEREST_RATE_PRECISION: 2, // 2 decimal places
  
  // Loan terms
  STANDARD_TERMS: [14, 30, 60, 90] as const,
  MAX_TERM_STANDARD: parseInt(process.env.MAX_LOAN_TERM_STANDARD || '90'),
  MAX_TERM_WITH_PARTIAL: parseInt(process.env.MAX_LOAN_TERM_WITH_PARTIAL || '100'),
  
  // Interest controls
  INTEREST_CAP_ENABLED: process.env.INTEREST_CAP_ENABLED !== 'false',
  MIN_INTEREST_DAYS: parseInt(process.env.MIN_INTEREST_DAYS || '14'),
  
  // Tier limits
  TIER_LIMITS: [50, 100, 200, 500, 1000] as const,
} as const;

/**
 * Legacy v1.0.0 base rates for backward compatibility
 */
const LEGACY_BASE_RATES: Record<number, number> = {
  14: 0.30, // 30%
  30: 0.60, // 60%
  60: 0.75, // 75%
  90: 1.00, // 100%
};

/**
 * Calculate interest for v2.0.0 loans (daily accruing)
 */
export function calculateInterestV2(
  amount: number,
  termDays: number,
  annualRate?: number
): InterestCalculation {
  const rate = annualRate || LOAN_CONFIG.ANNUAL_INTEREST_RATE;
  
  // Validate inputs
  if (amount <= 0) {
    throw new Error('Loan amount must be positive');
  }
  
  if (!LOAN_CONFIG.STANDARD_TERMS.includes(termDays as any) && termDays > LOAN_CONFIG.MAX_TERM_WITH_PARTIAL) {
    throw new Error(`Invalid term: ${termDays} days. Valid terms: ${LOAN_CONFIG.STANDARD_TERMS.join(', ')} or up to ${LOAN_CONFIG.MAX_TERM_WITH_PARTIAL} days with partial payments`);
  }
  
  if (rate < 0 || rate > 100) {
    throw new Error('Annual interest rate must be between 0 and 100');
  }
  
  // Calculate daily rate
  const dailyRate = rate / 365 / 100;
  
  // Calculate interest for full term
  const fullTermInterest = amount * dailyRate * termDays;
  
  // Calculate interest cap (annual rate × principal)
  const interestCap = LOAN_CONFIG.INTEREST_CAP_ENABLED ? 
    amount * (rate / 100) : Number.MAX_SAFE_INTEGER;
  
  // Apply cap if enabled
  const cappedInterest = Math.min(fullTermInterest, interestCap);
  
  // Apply minimum interest (minimum term worth of interest)
  const minInterest = amount * dailyRate * LOAN_CONFIG.MIN_INTEREST_DAYS;
  const finalInterest = Math.max(cappedInterest, minInterest);
  
  return {
    rate: rate / 100, // Convert to decimal
    amount: Math.round(finalInterest * 100) / 100, // Round to 2 decimals
    discountPercentage: 0, // No discounts in v2.0.0 (handled by trustworthy status)
    isTrustworthy: false, // Not applicable in v2.0.0
    dailyRate,
    interestCap,
    isCapApplied: finalInterest === interestCap,
    minInterestApplied: finalInterest === minInterest,
    fullTermInterest,
  };
}

/**
 * Calculate interest for v1.0.0 loans (legacy compatibility)
 */
export function calculateInterestV1(
  amount: number,
  termDays: number,
  isTrustworthy: boolean
): InterestCalculation {
  const baseRate = LEGACY_BASE_RATES[termDays];
  
  if (!baseRate) {
    throw new Error(`Invalid term for v1.0.0 loan: ${termDays} days`);
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
    amount: Math.round(interestAmount * 100) / 100,
    discountPercentage,
    isTrustworthy,
  };
}

/**
 * Calculate interest with automatic version detection
 */
export function calculateInterest(
  amount: number,
  termDays: number,
  isTrustworthy: boolean,
  loanVersion: LoanVersion = LoanVersion.V2,
  annualRate?: number
): InterestCalculation {
  if (loanVersion === LoanVersion.V1) {
    return calculateInterestV1(amount, termDays, isTrustworthy);
  } else {
    return calculateInterestV2(amount, termDays, annualRate);
  }
}

/**
 * Calculate complete loan details for v2.0.0
 */
export function calculateLoanDetailsV2(
  amount: number,
  termDays: number,
  annualRate?: number
): LoanCalculation {
  const interest = calculateInterestV2(amount, termDays, annualRate);
  const totalRepayable = amount + interest.amount;
  
  // Calculate due date in PNG timezone
  const now = getPNGNow();
  const dueDate = addDays(now, termDays);

  return {
    amount,
    termDays,
    interestRate: interest.rate,
    interestAmount: interest.amount,
    totalRepayable: Math.round(totalRepayable * 100) / 100,
    dueDate,
    loanVersion: LoanVersion.V2,
    annualInterestRate: annualRate || LOAN_CONFIG.ANNUAL_INTEREST_RATE,
    dailyInterestRate: interest.dailyRate,
    interestCap: interest.interestCap,
    minInterestAmount: amount * (interest.dailyRate || 0) * LOAN_CONFIG.MIN_INTEREST_DAYS,
  };
}

/**
 * Calculate complete loan details for v1.0.0 (legacy)
 */
export function calculateLoanDetailsV1(
  amount: number,
  termDays: number,
  isTrustworthy: boolean
): LoanCalculation {
  const interest = calculateInterestV1(amount, termDays, isTrustworthy);
  const totalRepayable = amount + interest.amount;
  
  // Calculate due date
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + termDays);

  return {
    amount,
    termDays,
    interestRate: interest.rate,
    interestAmount: interest.amount,
    totalRepayable: Math.round(totalRepayable * 100) / 100,
    dueDate,
    loanVersion: LoanVersion.V1,
  };
}

/**
 * Calculate loan details with automatic version detection
 */
export function calculateLoanDetails(
  amount: number,
  termDays: number,
  isTrustworthy: boolean,
  loanVersion: LoanVersion = LoanVersion.V2,
  annualRate?: number
): LoanCalculation {
  if (loanVersion === LoanVersion.V1) {
    return calculateLoanDetailsV1(amount, termDays, isTrustworthy);
  } else {
    return calculateLoanDetailsV2(amount, termDays, annualRate);
  }
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
export function getAvailableTerms(loanVersion: LoanVersion = LoanVersion.V2): Array<{
  days: number;
  label: string;
  rate: number | string;
  description: string;
}> {
  if (loanVersion === LoanVersion.V1) {
    return [
      { 
        days: 14, 
        label: '14 days (2 weeks)', 
        rate: LEGACY_BASE_RATES[14],
        description: `${(LEGACY_BASE_RATES[14] * 100).toFixed(0)}% fixed rate`
      },
      { 
        days: 30, 
        label: '30 days (1 month)', 
        rate: LEGACY_BASE_RATES[30],
        description: `${(LEGACY_BASE_RATES[30] * 100).toFixed(0)}% fixed rate`
      },
      { 
        days: 60, 
        label: '60 days (2 months)', 
        rate: LEGACY_BASE_RATES[60],
        description: `${(LEGACY_BASE_RATES[60] * 100).toFixed(0)}% fixed rate`
      },
      { 
        days: 90, 
        label: '90 days (3 months)', 
        rate: LEGACY_BASE_RATES[90],
        description: `${(LEGACY_BASE_RATES[90] * 100).toFixed(0)}% fixed rate`
      },
    ];
  } else {
    const annualRate = LOAN_CONFIG.ANNUAL_INTEREST_RATE;
    return [
      { 
        days: 14, 
        label: '14 days (2 weeks)', 
        rate: `${annualRate}% p.a.`,
        description: `${annualRate}% annual rate, daily accrual`
      },
      { 
        days: 30, 
        label: '30 days (1 month)', 
        rate: `${annualRate}% p.a.`,
        description: `${annualRate}% annual rate, daily accrual`
      },
      { 
        days: 60, 
        label: '60 days (2 months)', 
        rate: `${annualRate}% p.a.`,
        description: `${annualRate}% annual rate, daily accrual`
      },
      { 
        days: 90, 
        label: '90 days (3 months)', 
        rate: `${annualRate}% p.a.`,
        description: `${annualRate}% annual rate, daily accrual`
      },
    ];
  }
}

/**
 * Get tier information and limits
 */
export function getTierInfo(): Array<{
  limit: number;
  name: string;
  description: string;
  requirements: string;
}> {
  return [
    {
      limit: 50,
      name: 'Bronze',
      description: 'Starting tier for new customers',
      requirements: 'Account registration and KYC verification',
    },
    {
      limit: 100,
      name: 'Silver',
      description: 'First upgrade tier',
      requirements: '2 consecutive on-time payments at Bronze tier',
    },
    {
      limit: 200,
      name: 'Gold',
      description: 'Mid-level tier with increased limits',
      requirements: '2 consecutive on-time payments at Silver tier',
    },
    {
      limit: 500,
      name: 'Platinum',
      description: 'High-value tier for reliable customers',
      requirements: '2 consecutive on-time payments at Gold tier',
    },
    {
      limit: 1000,
      name: 'Diamond',
      description: 'Maximum tier for trustworthy customers',
      requirements: '2 consecutive on-time payments at Platinum tier + Trustworthy status',
    },
  ];
}

/**
 * Calculate interest rate comparison between v1.0.0 and v2.0.0
 */
export function compareInterestRates(
  amount: number,
  termDays: number,
  isTrustworthy: boolean
): {
  v1: { rate: number; amount: number; total: number };
  v2: { rate: number; amount: number; total: number };
  difference: { amount: number; percentage: number };
  recommendation: string;
} {
  const v1Interest = calculateInterestV1(amount, termDays, isTrustworthy);
  const v2Interest = calculateInterestV2(amount, termDays);
  
  const v1Total = amount + v1Interest.amount;
  const v2Total = amount + v2Interest.amount;
  
  const difference = {
    amount: v2Interest.amount - v1Interest.amount,
    percentage: v1Interest.amount > 0 ? ((v2Interest.amount - v1Interest.amount) / v1Interest.amount) * 100 : 0,
  };
  
  let recommendation = '';
  if (difference.amount < 0) {
    recommendation = `v2.0.0 saves K${Math.abs(difference.amount).toFixed(2)} (${Math.abs(difference.percentage).toFixed(1)}% less)`;
  } else if (difference.amount > 0) {
    recommendation = `v2.0.0 costs K${difference.amount.toFixed(2)} more (${difference.percentage.toFixed(1)}% increase)`;
  } else {
    recommendation = 'Both versions have the same cost';
  }
  
  return {
    v1: {
      rate: v1Interest.rate,
      amount: v1Interest.amount,
      total: v1Total,
    },
    v2: {
      rate: v2Interest.rate,
      amount: v2Interest.amount,
      total: v2Total,
    },
    difference,
    recommendation,
  };
}

/**
 * Validate loan application parameters
 */
export function validateLoanApplication(
  amount: number,
  termDays: number,
  userLimit: number,
  loanVersion: LoanVersion = LoanVersion.V2
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Amount validation
  if (amount <= 0) {
    errors.push('Loan amount must be positive');
  }
  
  if (amount > userLimit) {
    errors.push(`Amount K${amount} exceeds your current limit of K${userLimit}`);
  }
  
  if (!LOAN_CONFIG.TIER_LIMITS.includes(userLimit as any)) {
    warnings.push(`Unusual tier limit: K${userLimit}`);
  }
  
  // Term validation
  if (loanVersion === LoanVersion.V1) {
    if (!LOAN_CONFIG.STANDARD_TERMS.includes(termDays as any)) {
      errors.push(`Invalid term for v1.0.0 loan: ${termDays} days. Valid terms: ${LOAN_CONFIG.STANDARD_TERMS.join(', ')}`);
    }
  } else {
    if (!LOAN_CONFIG.STANDARD_TERMS.includes(termDays as any) && termDays > LOAN_CONFIG.MAX_TERM_WITH_PARTIAL) {
      errors.push(`Invalid term: ${termDays} days. Valid terms: ${LOAN_CONFIG.STANDARD_TERMS.join(', ')} or up to ${LOAN_CONFIG.MAX_TERM_WITH_PARTIAL} days with partial payments`);
    }
    
    if (termDays > LOAN_CONFIG.MAX_TERM_STANDARD && termDays <= LOAN_CONFIG.MAX_TERM_WITH_PARTIAL) {
      warnings.push(`Extended term (${termDays} days) requires partial payment capability`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
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
  const now = getPNGNow();
  const diff = dueDate.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Calculate days overdue
 */
export function getDaysOverdue(dueDate: Date): number {
  const now = getPNGNow();
  const diff = now.getTime() - dueDate.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Get loan status based on due date and payment status
 */
export function getLoanStatus(
  dueDate: Date,
  isFullyPaid: boolean,
  isDisbursed: boolean
): string {
  if (isFullyPaid) {
    return 'PAID';
  }
  
  if (!isDisbursed) {
    return 'PENDING';
  }
  
  const daysOverdue = getDaysOverdue(dueDate);
  
  if (daysOverdue >= 14) {
    return 'DEFAULTED';
  } else if (daysOverdue > 0) {
    return 'LATE';
  } else {
    return 'ACTIVE';
  }
}

/**
 * Calculate effective annual rate for comparison
 */
export function calculateEffectiveAnnualRate(
  principal: number,
  interestAmount: number,
  termDays: number
): number {
  if (principal <= 0 || termDays <= 0) {
    return 0;
  }
  
  const rate = interestAmount / principal;
  const periodsPerYear = 365 / termDays;
  const effectiveAnnualRate = Math.pow(1 + rate, periodsPerYear) - 1;
  
  return effectiveAnnualRate * 100; // Convert to percentage
}

/**
 * Get loan summary for display
 */
export function getLoanSummary(
  amount: number,
  termDays: number,
  isTrustworthy: boolean,
  loanVersion: LoanVersion = LoanVersion.V2,
  annualRate?: number
): {
  principal: string;
  interest: string;
  total: string;
  term: string;
  dueDate: string;
  effectiveRate: string;
  dailyRate?: string;
  interestCap?: string;
} {
  const calculation = calculateLoanDetails(amount, termDays, isTrustworthy, loanVersion, annualRate);
  const effectiveRate = calculateEffectiveAnnualRate(amount, calculation.interestAmount, termDays);
  
  const summary = {
    principal: formatCurrency(amount),
    interest: formatCurrency(calculation.interestAmount),
    total: formatCurrency(calculation.totalRepayable),
    term: `${termDays} days`,
    dueDate: calculation.dueDate.toLocaleDateString('en-PG'),
    effectiveRate: `${effectiveRate.toFixed(2)}% p.a.`,
  };
  
  if (loanVersion === LoanVersion.V2) {
    const v2Calc = calculation as any;
    return {
      ...summary,
      dailyRate: `${((v2Calc.dailyInterestRate || 0) * 100).toFixed(6)}% per day`,
      interestCap: v2Calc.interestCap ? formatCurrency(v2Calc.interestCap) : undefined,
    };
  }
  
  return summary;
}

