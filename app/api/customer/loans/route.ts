/**
 * Customer Loan History API
 * 
 * GET /api/customer/loans
 * 
 * Retrieves customer's loan history with:
 * - Filtering by status
 * - Pagination support
 * - Detailed loan information
 * - Payment history per loan
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCustomerAuth } from '@/middleware/customerAuth';
import { connectDB } from '@/lib/db';
import Loan from '@/models/Loan';
import Payment from '@/models/Payment';
import { LoanStatus } from '@/types';

async function handleLoanHistory(
  request: NextRequest,
  user: any
): Promise<NextResponse> {
  try {
    await connectDB();

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const includePayments = searchParams.get('includePayments') === 'true';

    // Build query filter
    const filter: any = { userId: user.id };
    
    if (status && Object.values(LoanStatus).includes(status as LoanStatus)) {
      filter.status = status;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const totalLoans = await Loan.countDocuments(filter);
    const totalPages = Math.ceil(totalLoans / limit);

    // Fetch loans with pagination
    const loans = await Loan.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // If includePayments is true, fetch payment history for each loan
    const loansWithDetails = await Promise.all(
      loans.map(async (loan) => {
        const loanData: any = {
          id: loan._id,
          reference: loan.reference,
          amount: loan.amount,
          termDays: loan.termDays,
          interestRate: loan.interestRate,
          interestAmount: loan.interestAmount,
          totalRepayable: loan.totalRepayable,
          totalPrincipalRepaid: loan.totalPrincipalRepaid || 0,
          totalInterestRepaid: loan.totalInterestRepaid || 0,
          status: loan.status,
          isAutoApproved: loan.isAutoApproved,
          disbursedAt: loan.disbursedAt,
          dueDate: loan.dueDate,
          repaidAt: loan.repaidAt,
          overdueSince: loan.overdueSince,
          createdAt: loan.createdAt,
          updatedAt: loan.updatedAt,
          
          // v2.0.1 fields
          loanVersion: loan.loanVersion,
          outstandingPrincipal: loan.outstandingPrincipal,
          accruedInterest: loan.accruedInterest || 0,
          annualInterestRate: loan.annualInterestRate,
          hasPartialPayments: loan.hasPartialPayments || false,
          
          // Calculated fields
          remainingBalance: (loan.outstandingPrincipal || loan.amount) + (loan.accruedInterest || 0),
          isOverdue: loan.dueDate && new Date() > new Date(loan.dueDate),
          daysOverdue: loan.dueDate ? Math.max(0, Math.floor((Date.now() - new Date(loan.dueDate).getTime()) / (1000 * 60 * 60 * 24))) : 0
        };

        // Include payment history if requested
        if (includePayments) {
          const payments = await Payment.find({ loanId: loan._id })
            .sort({ createdAt: -1 })
            .select('amount status principalPaid interestPaid verifiedAt createdAt proofUrl')
            .lean();

          loanData.payments = payments.map(payment => ({
            id: payment._id,
            amount: payment.amount,
            status: payment.status,
            principalPaid: payment.principalPaid || 0,
            interestPaid: payment.interestPaid || 0,
            verifiedAt: payment.verifiedAt,
            createdAt: payment.createdAt,
            hasProof: !!payment.proofUrl
          }));

          loanData.paymentSummary = {
            totalPayments: payments.length,
            totalAmountPaid: payments
              .filter(p => p.status === 'verified')
              .reduce((sum, p) => sum + p.amount, 0),
            pendingPayments: payments.filter(p => p.status === 'pending').length,
            lastPaymentDate: payments.length > 0 ? payments[0].createdAt : null
          };
        }

        return loanData;
      })
    );

    // Calculate summary statistics
    const summaryStats = await Loan.aggregate([
      { $match: { userId: user.id } },
      {
        $group: {
          _id: null,
          totalLoans: { $sum: 1 },
          totalBorrowed: { $sum: '$amount' },
          totalRepaid: { $sum: { $add: ['$totalPrincipalRepaid', '$totalInterestRepaid'] } },
          activeLoans: {
            $sum: {
              $cond: [
                { $in: ['$status', [LoanStatus.APPLIED, LoanStatus.APPROVED, LoanStatus.DISBURSED]] },
                1,
                0
              ]
            }
          },
          completedLoans: {
            $sum: {
              $cond: [{ $eq: ['$status', LoanStatus.REPAID] }, 1, 0]
            }
          },
          overdueLoans: {
            $sum: {
              $cond: [{ $eq: ['$status', LoanStatus.OVERDUE] }, 1, 0]
            }
          }
        }
      }
    ]);

    const stats = summaryStats[0] || {
      totalLoans: 0,
      totalBorrowed: 0,
      totalRepaid: 0,
      activeLoans: 0,
      completedLoans: 0,
      overdueLoans: 0
    };

    // Prepare response
    const response = {
      loans: loansWithDetails,
      pagination: {
        currentPage: page,
        totalPages,
        totalLoans,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        limit
      },
      summary: {
        totalLoans: stats.totalLoans,
        totalBorrowed: stats.totalBorrowed,
        totalRepaid: stats.totalRepaid,
        activeLoans: stats.activeLoans,
        completedLoans: stats.completedLoans,
        overdueLoans: stats.overdueLoans,
        repaymentRate: stats.totalBorrowed > 0 ? (stats.totalRepaid / stats.totalBorrowed) * 100 : 0
      },
      filters: {
        status: status || 'all',
        includePayments
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Loan history error:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to retrieve loan history',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

// Export the GET handler with authentication
export const GET = withCustomerAuth(handleLoanHistory);
