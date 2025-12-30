/**
 * Portfolio Simulation Service (v2.0.0)
 * 
 * Provides comprehensive portfolio analysis and simulation capabilities:
 * - Historical portfolio analysis with configurable date ranges
 * - Forward projection simulations with default rate assumptions
 * - Break-even analysis for profitability assessment
 * - Stress testing with predefined and custom scenarios
 * - Support for both v1.0.0 and v2.0.0 loan analysis
 */

import { ILoan, IPayment, LoanVersion, LoanStatus } from '@/types';
import { getPNGNow, getDaysBetween, addDays, getPNGStartOfDay } from '@/lib/timezone';
import { calculateInterestToDate, calculateTotalDue } from './interestService';
import Loan from '@/models/Loan';
import Payment from '@/models/Payment';

/**
 * Date range configuration
 */
export const DATE_RANGE_LIMITS = {
  MIN_DAYS: parseInt(process.env.SIMULATION_MIN_DAYS || '30'),
  MAX_DAYS: parseInt(process.env.SIMULATION_MAX_DAYS || '730'), // 2 years
  DEFAULT_DAYS: parseInt(process.env.SIMULATION_DEFAULT_DAYS || '180'), // 6 months
} as const;

/**
 * Predefined stress test scenarios
 */
export const STRESS_SCENARIOS = {
  MILD: { name: 'Mild Stress', defaultRate: 0.05, description: '5% default rate' },
  MODERATE: { name: 'Moderate Stress', defaultRate: 0.10, description: '10% default rate' },
  SEVERE: { name: 'Severe Stress', defaultRate: 0.15, description: '15% default rate' },
  EXTREME: { name: 'Extreme Stress', defaultRate: 0.20, description: '20% default rate' },
} as const;

/**
 * Historical portfolio analysis result
 */
export interface HistoricalAnalysis {
  dateRange: {
    startDate: Date;
    endDate: Date;
    totalDays: number;
  };
  portfolio: {
    totalLoans: number;
    v1Loans: number;
    v2Loans: number;
    totalDisbursed: number;
    totalRepaid: number;
    totalInterestEarned: number;
    averageLoanSize: number;
  };
  performance: {
    defaultRate: number;
    onTimeRate: number;
    averageRepaymentDays: number;
    profitMargin: number;
    roi: number;
  };
  breakdown: {
    byTier: Record<string, {
      count: number;
      disbursed: number;
      repaid: number;
      defaultRate: number;
    }>;
    byTerm: Record<string, {
      count: number;
      disbursed: number;
      repaid: number;
      averageInterest: number;
    }>;
    byMonth: Array<{
      month: string;
      loansIssued: number;
      disbursed: number;
      repaid: number;
      defaults: number;
    }>;
  };
  trends: {
    growthRate: number;
    defaultTrend: 'improving' | 'stable' | 'worsening';
    profitabilityTrend: 'improving' | 'stable' | 'declining';
  };
}

/**
 * Forward projection result
 */
export interface ForwardProjection {
  projectionPeriod: {
    startDate: Date;
    endDate: Date;
    totalDays: number;
  };
  assumptions: {
    defaultRate: number;
    growthRate: number;
    averageLoanSize: number;
    interestRate: number;
  };
  projections: {
    expectedLoans: number;
    expectedDisbursements: number;
    expectedRepayments: number;
    expectedDefaults: number;
    expectedProfit: number;
    expectedLoss: number;
    netExpectedReturn: number;
  };
  scenarios: {
    optimistic: {
      profit: number;
      roi: number;
    };
    realistic: {
      profit: number;
      roi: number;
    };
    pessimistic: {
      profit: number;
      roi: number;
    };
  };
  cashFlowProjection: Array<{
    month: string;
    disbursements: number;
    repayments: number;
    netCashFlow: number;
    cumulativeCashFlow: number;
  }>;
}

/**
 * Break-even analysis result
 */
export interface BreakEvenAnalysis {
  currentMetrics: {
    averageInterestRate: number;
    averageDefaultRate: number;
    operatingCosts: number;
    currentProfitMargin: number;
  };
  breakEvenPoints: {
    maxDefaultRate: number;
    minInterestRate: number;
    maxOperatingCosts: number;
    minLoanVolume: number;
  };
  sensitivity: {
    defaultRateImpact: Array<{
      defaultRate: number;
      profitMargin: number;
      breakEven: boolean;
    }>;
    interestRateImpact: Array<{
      interestRate: number;
      profitMargin: number;
      breakEven: boolean;
    }>;
  };
  recommendations: string[];
}

/**
 * Stress test result
 */
export interface StressTestResult {
  scenario: {
    name: string;
    defaultRate: number;
    description: string;
  };
  impact: {
    affectedLoans: number;
    additionalDefaults: number;
    lossAmount: number;
    profitReduction: number;
    newProfitMargin: number;
  };
  portfolioHealth: {
    healthScore: number; // 0-100
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    recommendations: string[];
  };
  recovery: {
    timeToRecover: number; // days
    requiredActions: string[];
  };
}

/**
 * Validate date range for analysis
 */
export function validateDateRange(startDate: Date, endDate: Date): {
  isValid: boolean;
  error?: string;
  adjustedStartDate?: Date;
  adjustedEndDate?: Date;
} {
  const now = getPNGNow();
  const daysDiff = getDaysBetween(startDate, endDate);
  
  if (daysDiff < 0) {
    return { isValid: false, error: 'End date must be after start date' };
  }
  
  if (daysDiff < DATE_RANGE_LIMITS.MIN_DAYS) {
    return { 
      isValid: false, 
      error: `Date range must be at least ${DATE_RANGE_LIMITS.MIN_DAYS} days` 
    };
  }
  
  if (daysDiff > DATE_RANGE_LIMITS.MAX_DAYS) {
    return { 
      isValid: false, 
      error: `Date range cannot exceed ${DATE_RANGE_LIMITS.MAX_DAYS} days (2 years)` 
    };
  }
  
  if (endDate > now) {
    return {
      isValid: true,
      adjustedEndDate: now,
    };
  }
  
  return { isValid: true };
}

/**
 * Perform historical portfolio analysis
 */
export async function analyzeHistoricalPortfolio(
  startDate: Date,
  endDate: Date
): Promise<HistoricalAnalysis> {
  const validation = validateDateRange(startDate, endDate);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }
  
  const adjustedEndDate = validation.adjustedEndDate || endDate;
  const totalDays = getDaysBetween(startDate, adjustedEndDate);
  
  // Fetch loans in date range
  const loans = await Loan.find({
    createdAt: {
      $gte: startDate,
      $lte: adjustedEndDate,
    },
  }).populate('userId');
  
  // Fetch payments for these loans
  const loanIds = loans.map(loan => loan._id);
  const payments = await Payment.find({
    loanId: { $in: loanIds },
    status: 'VERIFIED',
  });
  
  // Calculate portfolio metrics
  const v1Loans = loans.filter(loan => loan.loanVersion === LoanVersion.V1);
  const v2Loans = loans.filter(loan => loan.loanVersion === LoanVersion.V2);
  
  const totalDisbursed = loans.reduce((sum, loan) => sum + loan.amount, 0);
  const totalRepaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  
  // Calculate interest earned
  let totalInterestEarned = 0;
  for (const payment of payments) {
    if (payment.interestPortion) {
      totalInterestEarned += payment.interestPortion;
    } else if (payment.interestPaid) {
      totalInterestEarned += payment.interestPaid;
    }
  }
  
  // Calculate performance metrics
  const defaultedLoans = loans.filter(loan => 
    loan.status === LoanStatus.DEFAULTED || loan.status === 'DEFAULTED'
  );
  const defaultRate = loans.length > 0 ? defaultedLoans.length / loans.length : 0;
  
  const repaidLoans = loans.filter(loan => 
    loan.status === LoanStatus.REPAID || loan.status === 'REPAID'
  );
  const onTimeRate = loans.length > 0 ? repaidLoans.length / loans.length : 0;
  
  // Calculate average repayment days
  let totalRepaymentDays = 0;
  let repaymentCount = 0;
  for (const loan of repaidLoans) {
    if (loan.repaidAt && loan.disbursedAt) {
      totalRepaymentDays += getDaysBetween(loan.disbursedAt, loan.repaidAt);
      repaymentCount++;
    }
  }
  const averageRepaymentDays = repaymentCount > 0 ? totalRepaymentDays / repaymentCount : 0;
  
  const profitMargin = totalDisbursed > 0 ? (totalInterestEarned / totalDisbursed) * 100 : 0;
  const roi = totalDisbursed > 0 ? ((totalRepaid - totalDisbursed) / totalDisbursed) * 100 : 0;
  
  // Breakdown by tier
  const byTier: Record<string, any> = {};
  for (const loan of loans) {
    const tierKey = `K${loan.amount <= 50 ? '50' : loan.amount <= 100 ? '100' : loan.amount <= 200 ? '200' : loan.amount <= 500 ? '500' : '1000'}`;
    if (!byTier[tierKey]) {
      byTier[tierKey] = { count: 0, disbursed: 0, repaid: 0, defaults: 0 };
    }
    byTier[tierKey].count++;
    byTier[tierKey].disbursed += loan.amount;
    
    const loanPayments = payments.filter(p => p.loanId.toString() === loan._id.toString());
    byTier[tierKey].repaid += loanPayments.reduce((sum, p) => sum + p.amount, 0);
    
    if (loan.status === LoanStatus.DEFAULTED || loan.status === 'DEFAULTED') {
      byTier[tierKey].defaults++;
    }
  }
  
  // Calculate default rates for each tier
  Object.keys(byTier).forEach(tier => {
    byTier[tier].defaultRate = byTier[tier].count > 0 ? byTier[tier].defaults / byTier[tier].count : 0;
  });
  
  // Breakdown by term
  const byTerm: Record<string, any> = {};
  for (const loan of loans) {
    const termKey = `${loan.termDays}d`;
    if (!byTerm[termKey]) {
      byTerm[termKey] = { count: 0, disbursed: 0, repaid: 0, totalInterest: 0 };
    }
    byTerm[termKey].count++;
    byTerm[termKey].disbursed += loan.amount;
    byTerm[termKey].totalInterest += loan.interestAmount || 0;
    
    const loanPayments = payments.filter(p => p.loanId.toString() === loan._id.toString());
    byTerm[termKey].repaid += loanPayments.reduce((sum, p) => sum + p.amount, 0);
  }
  
  // Calculate average interest for each term
  Object.keys(byTerm).forEach(term => {
    byTerm[term].averageInterest = byTerm[term].count > 0 ? byTerm[term].totalInterest / byTerm[term].count : 0;
  });
  
  // Monthly breakdown
  const byMonth: Array<any> = [];
  const monthlyData: Record<string, any> = {};
  
  for (const loan of loans) {
    const monthKey = loan.createdAt.toISOString().substring(0, 7); // YYYY-MM
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { loansIssued: 0, disbursed: 0, repaid: 0, defaults: 0 };
    }
    monthlyData[monthKey].loansIssued++;
    monthlyData[monthKey].disbursed += loan.amount;
    
    if (loan.status === LoanStatus.DEFAULTED || loan.status === 'DEFAULTED') {
      monthlyData[monthKey].defaults++;
    }
  }
  
  // Add repayment data to monthly breakdown
  for (const payment of payments) {
    if (payment.verifiedAt) {
      const monthKey = payment.verifiedAt.toISOString().substring(0, 7);
      if (monthlyData[monthKey]) {
        monthlyData[monthKey].repaid += payment.amount;
      }
    }
  }
  
  // Convert to array and sort by month
  Object.keys(monthlyData).sort().forEach(month => {
    byMonth.push({
      month,
      ...monthlyData[month],
    });
  });
  
  // Calculate trends
  const recentMonths = byMonth.slice(-3);
  const earlierMonths = byMonth.slice(0, 3);
  
  let growthRate = 0;
  if (earlierMonths.length > 0 && recentMonths.length > 0) {
    const earlierAvg = earlierMonths.reduce((sum, m) => sum + m.disbursed, 0) / earlierMonths.length;
    const recentAvg = recentMonths.reduce((sum, m) => sum + m.disbursed, 0) / recentMonths.length;
    growthRate = earlierAvg > 0 ? ((recentAvg - earlierAvg) / earlierAvg) * 100 : 0;
  }
  
  const defaultTrend = recentMonths.length >= 2 ? 
    (recentMonths[recentMonths.length - 1].defaults > recentMonths[0].defaults ? 'worsening' : 
     recentMonths[recentMonths.length - 1].defaults < recentMonths[0].defaults ? 'improving' : 'stable') : 'stable';
  
  const profitabilityTrend = recentMonths.length >= 2 ?
    (recentMonths[recentMonths.length - 1].repaid > recentMonths[0].repaid ? 'improving' :
     recentMonths[recentMonths.length - 1].repaid < recentMonths[0].repaid ? 'declining' : 'stable') : 'stable';
  
  return {
    dateRange: {
      startDate,
      endDate: adjustedEndDate,
      totalDays,
    },
    portfolio: {
      totalLoans: loans.length,
      v1Loans: v1Loans.length,
      v2Loans: v2Loans.length,
      totalDisbursed,
      totalRepaid,
      totalInterestEarned,
      averageLoanSize: loans.length > 0 ? totalDisbursed / loans.length : 0,
    },
    performance: {
      defaultRate,
      onTimeRate,
      averageRepaymentDays,
      profitMargin,
      roi,
    },
    breakdown: {
      byTier,
      byTerm,
      byMonth,
    },
    trends: {
      growthRate,
      defaultTrend,
      profitabilityTrend,
    },
  };
}

/**
 * Generate forward projection
 */
export async function generateForwardProjection(
  projectionDays: number,
  assumptions: {
    defaultRate?: number;
    growthRate?: number;
    averageLoanSize?: number;
    interestRate?: number;
  } = {}
): Promise<ForwardProjection> {
  const now = getPNGNow();
  const endDate = addDays(now, projectionDays);
  
  // Get historical data for baseline
  const historicalStartDate = addDays(now, -180); // 6 months back
  const historical = await analyzeHistoricalPortfolio(historicalStartDate, now);
  
  // Use provided assumptions or derive from historical data
  const defaultRate = assumptions.defaultRate ?? historical.performance.defaultRate;
  const growthRate = assumptions.growthRate ?? (historical.trends.growthRate / 100);
  const averageLoanSize = assumptions.averageLoanSize ?? historical.portfolio.averageLoanSize;
  const interestRate = assumptions.interestRate ?? (historical.performance.profitMargin / 100);
  
  // Calculate projections
  const monthsInProjection = projectionDays / 30;
  const baseMonthlyLoans = historical.portfolio.totalLoans / 6; // 6 months of historical data
  
  const expectedLoans = Math.round(baseMonthlyLoans * monthsInProjection * (1 + growthRate));
  const expectedDisbursements = expectedLoans * averageLoanSize;
  const expectedDefaults = Math.round(expectedLoans * defaultRate);
  const expectedSuccessfulLoans = expectedLoans - expectedDefaults;
  const expectedRepayments = expectedSuccessfulLoans * averageLoanSize * (1 + interestRate);
  const expectedProfit = expectedRepayments - expectedDisbursements;
  const expectedLoss = expectedDefaults * averageLoanSize;
  const netExpectedReturn = expectedProfit - expectedLoss;
  
  // Generate scenarios
  const scenarios = {
    optimistic: {
      profit: expectedProfit * 1.2, // 20% better
      roi: (expectedProfit * 1.2 / expectedDisbursements) * 100,
    },
    realistic: {
      profit: expectedProfit,
      roi: (expectedProfit / expectedDisbursements) * 100,
    },
    pessimistic: {
      profit: expectedProfit * 0.7, // 30% worse
      roi: (expectedProfit * 0.7 / expectedDisbursements) * 100,
    },
  };
  
  // Generate monthly cash flow projection
  const cashFlowProjection: Array<any> = [];
  let cumulativeCashFlow = 0;
  
  for (let month = 1; month <= Math.ceil(monthsInProjection); month++) {
    const monthlyDisbursements = expectedDisbursements / monthsInProjection;
    const monthlyRepayments = expectedRepayments / monthsInProjection;
    const netCashFlow = monthlyRepayments - monthlyDisbursements;
    cumulativeCashFlow += netCashFlow;
    
    const monthDate = addDays(now, month * 30);
    cashFlowProjection.push({
      month: monthDate.toISOString().substring(0, 7),
      disbursements: monthlyDisbursements,
      repayments: monthlyRepayments,
      netCashFlow,
      cumulativeCashFlow,
    });
  }
  
  return {
    projectionPeriod: {
      startDate: now,
      endDate,
      totalDays: projectionDays,
    },
    assumptions: {
      defaultRate,
      growthRate,
      averageLoanSize,
      interestRate,
    },
    projections: {
      expectedLoans,
      expectedDisbursements,
      expectedRepayments,
      expectedDefaults,
      expectedProfit,
      expectedLoss,
      netExpectedReturn,
    },
    scenarios,
    cashFlowProjection,
  };
}

/**
 * Perform break-even analysis
 */
export async function performBreakEvenAnalysis(): Promise<BreakEvenAnalysis> {
  // Get current portfolio metrics
  const now = getPNGNow();
  const startDate = addDays(now, -365); // 1 year back
  const historical = await analyzeHistoricalPortfolio(startDate, now);
  
  const currentMetrics = {
    averageInterestRate: historical.performance.profitMargin / 100,
    averageDefaultRate: historical.performance.defaultRate,
    operatingCosts: 0.02, // Assume 2% operating costs
    currentProfitMargin: historical.performance.profitMargin / 100,
  };
  
  // Calculate break-even points
  const maxDefaultRate = currentMetrics.averageInterestRate - currentMetrics.operatingCosts;
  const minInterestRate = currentMetrics.averageDefaultRate + currentMetrics.operatingCosts;
  const maxOperatingCosts = currentMetrics.averageInterestRate - currentMetrics.averageDefaultRate;
  const minLoanVolume = historical.portfolio.totalDisbursed * 0.5; // 50% of current volume
  
  // Sensitivity analysis
  const defaultRateImpact = [];
  for (let rate = 0; rate <= 0.3; rate += 0.05) {
    const profitMargin = currentMetrics.averageInterestRate - rate - currentMetrics.operatingCosts;
    defaultRateImpact.push({
      defaultRate: rate,
      profitMargin,
      breakEven: profitMargin >= 0,
    });
  }
  
  const interestRateImpact = [];
  for (let rate = 0; rate <= 0.2; rate += 0.02) {
    const profitMargin = rate - currentMetrics.averageDefaultRate - currentMetrics.operatingCosts;
    interestRateImpact.push({
      interestRate: rate,
      profitMargin,
      breakEven: profitMargin >= 0,
    });
  }
  
  // Generate recommendations
  const recommendations = [];
  if (currentMetrics.averageDefaultRate > 0.1) {
    recommendations.push('Consider tightening credit criteria to reduce default rate');
  }
  if (currentMetrics.averageInterestRate < 0.05) {
    recommendations.push('Consider increasing interest rates to improve profitability');
  }
  if (currentMetrics.currentProfitMargin < 0.02) {
    recommendations.push('Profit margin is low - review pricing and risk management');
  }
  
  return {
    currentMetrics,
    breakEvenPoints: {
      maxDefaultRate,
      minInterestRate,
      maxOperatingCosts,
      minLoanVolume,
    },
    sensitivity: {
      defaultRateImpact,
      interestRateImpact,
    },
    recommendations,
  };
}

/**
 * Perform stress testing
 */
export async function performStressTest(
  scenario: keyof typeof STRESS_SCENARIOS | 'custom',
  customDefaultRate?: number
): Promise<StressTestResult> {
  let stressScenario;
  
  if (scenario === 'custom' && customDefaultRate !== undefined) {
    stressScenario = {
      name: 'Custom Scenario',
      defaultRate: customDefaultRate,
      description: `${(customDefaultRate * 100).toFixed(1)}% default rate`,
    };
  } else if (scenario !== 'custom') {
    stressScenario = STRESS_SCENARIOS[scenario];
  } else {
    throw new Error('Custom default rate required for custom scenario');
  }
  
  // Get current portfolio
  const now = getPNGNow();
  const startDate = addDays(now, -180); // 6 months back
  const historical = await analyzeHistoricalPortfolio(startDate, now);
  
  // Calculate stress impact
  const currentDefaultRate = historical.performance.defaultRate;
  const additionalDefaultRate = Math.max(0, stressScenario.defaultRate - currentDefaultRate);
  const affectedLoans = Math.round(historical.portfolio.totalLoans * additionalDefaultRate);
  const additionalDefaults = affectedLoans;
  const lossAmount = additionalDefaults * historical.portfolio.averageLoanSize;
  const profitReduction = (lossAmount / historical.portfolio.totalDisbursed) * 100;
  const newProfitMargin = historical.performance.profitMargin - profitReduction;
  
  // Calculate health score (0-100)
  let healthScore = 100;
  if (stressScenario.defaultRate > 0.05) healthScore -= 20;
  if (stressScenario.defaultRate > 0.10) healthScore -= 30;
  if (stressScenario.defaultRate > 0.15) healthScore -= 30;
  if (stressScenario.defaultRate > 0.20) healthScore -= 20;
  healthScore = Math.max(0, healthScore);
  
  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'critical';
  if (healthScore >= 80) riskLevel = 'low';
  else if (healthScore >= 60) riskLevel = 'medium';
  else if (healthScore >= 40) riskLevel = 'high';
  else riskLevel = 'critical';
  
  // Generate recommendations
  const recommendations = [];
  if (stressScenario.defaultRate > 0.10) {
    recommendations.push('Implement stricter credit scoring and approval criteria');
    recommendations.push('Increase interest rates to compensate for higher risk');
    recommendations.push('Reduce maximum loan amounts for new customers');
  }
  if (stressScenario.defaultRate > 0.15) {
    recommendations.push('Consider temporary suspension of new loan approvals');
    recommendations.push('Focus on collection efforts for existing overdue loans');
    recommendations.push('Review and strengthen risk management policies');
  }
  if (newProfitMargin < 0) {
    recommendations.push('Immediate action required - portfolio is unprofitable under this scenario');
    recommendations.push('Consider emergency measures to preserve capital');
  }
  
  // Calculate recovery time
  const monthlyProfitRate = historical.performance.profitMargin / 100 / 12; // Monthly profit rate
  const timeToRecover = monthlyProfitRate > 0 ? Math.ceil(lossAmount / (historical.portfolio.totalDisbursed * monthlyProfitRate)) * 30 : 365;
  
  const requiredActions = [];
  if (timeToRecover > 180) {
    requiredActions.push('Implement immediate cost reduction measures');
    requiredActions.push('Seek additional capital or credit facilities');
  }
  if (timeToRecover > 365) {
    requiredActions.push('Consider strategic restructuring of operations');
    requiredActions.push('Evaluate business model sustainability');
  }
  
  return {
    scenario: stressScenario,
    impact: {
      affectedLoans,
      additionalDefaults,
      lossAmount,
      profitReduction,
      newProfitMargin,
    },
    portfolioHealth: {
      healthScore,
      riskLevel,
      recommendations,
    },
    recovery: {
      timeToRecover,
      requiredActions,
    },
  };
}

/**
 * Get default date range for analysis
 */
export function getDefaultDateRange(): { startDate: Date; endDate: Date } {
  const endDate = getPNGNow();
  const startDate = addDays(endDate, -DATE_RANGE_LIMITS.DEFAULT_DAYS);
  
  return { startDate, endDate };
}

/**
 * Get available stress test scenarios
 */
export function getAvailableStressScenarios(): Array<{
  key: keyof typeof STRESS_SCENARIOS;
  name: string;
  defaultRate: number;
  description: string;
}> {
  return Object.entries(STRESS_SCENARIOS).map(([key, scenario]) => ({
    key: key as keyof typeof STRESS_SCENARIOS,
    ...scenario,
  }));
}

