import SystemSettings from '@/models/SystemSettings';
import { FinancialUpdate } from '@/types/services';
import Loan from '@/models/Loan';
import { LoanStatus } from '@/types';

/**
 * Update financial tracking when loan is disbursed
 */
export async function updateFinancialsOnDisbursement(amount: number): Promise<void> {
  await SystemSettings.updateOne(
    { _id: 'singleton' },
    {
      $inc: {
        cashOnHand: -amount,
        totalDisbursed: amount,
      },
    },
    { upsert: true }
  );
}

/**
 * Update financial tracking when payment is received
 */
export async function updateFinancialsOnRepayment(
  principal: number,
  interest: number
): Promise<void> {
  await SystemSettings.updateOne(
    { _id: 'singleton' },
    {
      $inc: {
        cashOnHand: principal + interest,
        totalRepaid: principal,
        interestEarned: interest,
      },
    },
    { upsert: true }
  );
}

/**
 * Get current financial summary
 */
export async function getFinancialSummary(): Promise<FinancialUpdate> {
  const settings = await SystemSettings.findById('singleton');
  
  if (!settings) {
    return {
      cashOnHand: 0,
      totalDisbursed: 0,
      totalRepaid: 0,
      interestEarned: 0,
    };
  }

  return {
    cashOnHand: settings.cashOnHand,
    totalDisbursed: settings.totalDisbursed,
    totalRepaid: settings.totalRepaid,
    interestEarned: settings.interestEarned,
  };
}

/**
 * Calculate outstanding loans (disbursed but not fully repaid)
 */
export async function getOutstandingLoans(): Promise<{
  count: number;
  amount: number;
}> {
  const loans = await Loan.find({
    status: { $in: [LoanStatus.DISBURSED, LoanStatus.OVERDUE] },
  });

  const amount = loans.reduce((sum, loan) => {
    const remainingPrincipal = loan.amount - (loan.totalPrincipalRepaid || 0);
    const remainingInterest = loan.interestAmount - (loan.totalInterestRepaid || 0);
    return sum + remainingPrincipal + remainingInterest;
  }, 0);

  return {
    count: loans.length,
    amount: Math.round(amount * 100) / 100,
  };
}

/**
 * Calculate overdue loans
 */
export async function getOverdueLoans(): Promise<{
  count: number;
  amount: number;
}> {
  const loans = await Loan.find({
    status: LoanStatus.OVERDUE,
  });

  const amount = loans.reduce((sum, loan) => {
    const remainingPrincipal = loan.amount - (loan.totalPrincipalRepaid || 0);
    const remainingInterest = loan.interestAmount - (loan.totalInterestRepaid || 0);
    return sum + remainingPrincipal + remainingInterest;
  }, 0);

  return {
    count: loans.length,
    amount: Math.round(amount * 100) / 100,
  };
}

/**
 * Get complete financial report
 */
export async function getFinancialReport() {
  const summary = await getFinancialSummary();
  const outstanding = await getOutstandingLoans();
  const overdue = await getOverdueLoans();

  return {
    ...summary,
    outstandingLoans: outstanding.count,
    outstandingAmount: outstanding.amount,
    overdueLoans: overdue.count,
    overdueAmount: overdue.amount,
    netCash: summary.cashOnHand + outstanding.amount, // Cash + what's owed
  };
}

/**
 * Add cash to system (for admin top-ups)
 */
export async function addCash(amount: number): Promise<void> {
  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }

  await SystemSettings.updateOne(
    { _id: 'singleton' },
    {
      $inc: {
        cashOnHand: amount,
      },
    },
    { upsert: true }
  );
}

/**
 * Check if system has sufficient cash for disbursement
 */
export async function hasSufficientCash(amount: number): Promise<boolean> {
  const settings = await SystemSettings.findById('singleton');
  return settings ? settings.cashOnHand >= amount : false;
}

