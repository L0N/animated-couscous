/**
 * Customer Dashboard API
 * 
 * GET /api/customer/dashboard
 * 
 * Provides customer overview including:
 * - Current loans and status
 * - Payment history summary
 * - Tier information
 * - Available credit
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCustomerAuth } from '@/middleware/customerAuth';
import { connectDB } from '@/lib/db';
import Loan from '@/models/Loan';
import Payment from '@/models/Payment';
import User from '@/models/User';
import { LoanStatus, PaymentStatus } from '@/types';

async function handleDashboard(
  request: NextRequest,
  user: any
): Promise<NextResponse> {
  try {
    await connectDB();

    // Get fresh user data
    const currentUser = await User.findById(user.id).select('-password');
    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get current active loans
    const activeLoans = await Loan.find({
      userId: user.id,
      status: { $in: [LoanStatus.APPLIED, LoanStatus.APPROVED, LoanStatus.DISBURSED] }
    }).sort({ createdAt: -1 });

    // Get recent loan history (last 5 loans)
    const recentLoans = await Loan.find({
      userId: user.id
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('reference amount status createdAt dueDate totalRepayable');

    // Get payment statistics
    const paymentStats = await Payment.aggregate([
      { $match: { userId: user.id } },
      {
        $group: {
          _id: null,
          totalPaid: { $sum: '$amount' },
          totalPayments: { $sum: 1 },
          pendingPayments: {
            $sum: { $cond: [{ $eq: ['$status', PaymentStatus.PENDING] }, 1, 0] }
          },
          verifiedPayments: {
            $sum: { $cond: [{ $eq: ['$status', PaymentStatus.VERIFIED] }, 1, 0] }
          }
        }
      }
    ]);

    // Calculate tier information
    const tierLimits = [50, 100, 200, 500, 1000];
    const currentTierIndex = tierLimits.indexOf(currentUser.currentLimit);
    const nextTierLimit = currentTierIndex < tierLimits.length - 1 
      ? tierLimits[currentTierIndex + 1] 
      : null;

    // Calculate available credit (current limit minus active loan amounts)
    const totalActiveLoanAmount = activeLoans.reduce((sum, loan) => sum + loan.amount, 0);
    const availableCredit = Math.max(0, currentUser.currentLimit - totalActiveLoanAmount);

    // Get overdue loans
    const now = new Date();
    const overdueLoans = await Loan.find({
      userId: user.id,
      status: { $in: [LoanStatus.DISBURSED] },
      dueDate: { $lt: now }
    });

    // Prepare dashboard response
    const dashboardData = {
      user: {
        id: currentUser._id,
        name: currentUser.name,
        email: currentUser.email,
        phone: currentUser.phone,
        currentLimit: currentUser.currentLimit,
        isTrustworthy: currentUser.isTrustworthy,
        status: currentUser.status,
        consecutiveOnTimePayments: currentUser.consecutiveOnTimePayments,
        kycVerified: currentUser.kyc?.verified || false,
        memberSince: currentUser.createdAt
      },
      
      creditInfo: {
        currentLimit: currentUser.currentLimit,
        availableCredit,
        nextTierLimit,
        progressToNextTier: {
          currentPayments: currentUser.consecutiveOnTimePayments,
          requiredPayments: 2,
          percentage: Math.min(100, (currentUser.consecutiveOnTimePayments / 2) * 100)
        },
        isTrustworthy: currentUser.isTrustworthy
      },

      activeLoans: activeLoans.map(loan => ({
        id: loan._id,
        reference: loan.reference,
        amount: loan.amount,
        status: loan.status,
        dueDate: loan.dueDate,
        totalRepayable: loan.totalRepayable,
        outstandingPrincipal: loan.outstandingPrincipal,
        accruedInterest: loan.accruedInterest,
        isOverdue: loan.dueDate < now,
        daysUntilDue: Math.ceil((loan.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      })),

      recentActivity: recentLoans.map(loan => ({
        id: loan._id,
        reference: loan.reference,
        amount: loan.amount,
        status: loan.status,
        createdAt: loan.createdAt,
        dueDate: loan.dueDate
      })),

      paymentSummary: {
        totalPaid: paymentStats[0]?.totalPaid || 0,
        totalPayments: paymentStats[0]?.totalPayments || 0,
        pendingPayments: paymentStats[0]?.pendingPayments || 0,
        verifiedPayments: paymentStats[0]?.verifiedPayments || 0
      },

      alerts: [
        ...(overdueLoans.length > 0 ? [{
          type: 'warning',
          message: `You have ${overdueLoans.length} overdue loan(s). Please make payment to avoid penalties.`,
          action: 'Make Payment'
        }] : []),
        
        ...(!currentUser.kyc?.verified ? [{
          type: 'info',
          message: 'Complete your KYC verification to unlock higher loan limits.',
          action: 'Verify KYC'
        }] : []),

        ...(currentUser.consecutiveOnTimePayments >= 1 ? [{
          type: 'success',
          message: `Great! ${2 - currentUser.consecutiveOnTimePayments} more on-time payment(s) to upgrade your tier.`,
          action: 'View Progress'
        }] : [])
      ],

      quickActions: [
        {
          title: 'Apply for Loan',
          description: `Apply for up to K${availableCredit}`,
          enabled: availableCredit > 0 && activeLoans.length === 0,
          action: 'apply'
        },
        {
          title: 'Make Payment',
          description: 'Pay your active loan',
          enabled: activeLoans.length > 0,
          action: 'payment'
        },
        {
          title: 'Upload KYC',
          description: 'Complete verification',
          enabled: !currentUser.kyc?.verified,
          action: 'kyc'
        },
        {
          title: 'View History',
          description: 'See all transactions',
          enabled: true,
          action: 'history'
        }
      ]
    };

    return NextResponse.json(dashboardData);

  } catch (error) {
    console.error('Dashboard error:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to load dashboard data',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

// Export the GET handler with authentication
export const GET = withCustomerAuth(handleDashboard);
