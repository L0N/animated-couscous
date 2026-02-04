/**
 * Customer Loan Application API
 * 
 * POST /api/customer/apply
 * 
 * Handles customer loan applications with:
 * - Input validation
 * - Eligibility checking
 * - Auto-approval integration
 * - Audit logging
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCustomerAuth } from '@/middleware/customerAuth';
import { validateRequestBody, applyLoanSchema } from '@/lib/validation';
import { connectDB } from '@/lib/db';
import Loan from '@/models/Loan';
import User from '@/models/User';
import { calculateLoanDetailsV2 } from '@/services/loanService';
import { tryAutoApprove } from '@/services/autoApprovalService';
import { checkEligibility } from '@/services/tierService';
import { LoanStatus, LoanVersion } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface LoanApplicationRequest {
  amount: number;
  termDays: number;
  purpose: string;
  monthlyIncome?: number;
  employmentStatus?: string;
}

/**
 * Main loan application handler
 * 
 * Data Flow:
 * 1. Request validation → Zod schema validation
 * 2. User verification → Database lookup and status check
 * 3. Eligibility check → Tier limits, KYC, account status
 * 4. Duplicate prevention → Check for existing active loans
 * 5. Loan calculation → Interest rates and repayment terms
 * 6. Auto-approval evaluation → 7-criteria validation
 * 7. Database persistence → Create loan record
 * 8. Response generation → Return loan details and status
 */
async function handleLoanApplication(
  request: NextRequest,
  user: any // JWT-decoded user from customerAuth middleware
): Promise<NextResponse> {
  try {
    await connectDB();

    // === STEP 1: REQUEST VALIDATION ===
    // Parse and validate request body against Zod schema
    const body = await request.json();
    const validation = await validateRequestBody(applyLoanSchema, body);
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validation.error,
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }

    const { amount, termDays, purpose, monthlyIncome, employmentStatus } = validation.data as LoanApplicationRequest;

    // === STEP 2: USER VERIFICATION ===
    // Get fresh user data from database (JWT token may be stale)
    const currentUser = await User.findById(user.id);
    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // === STEP 3: ELIGIBILITY VALIDATION ===
    // Check tier limits, KYC status, account status, and credit history
    const eligibilityCheck = await checkEligibility(currentUser, amount);
    if (!eligibilityCheck.eligible) {
      return NextResponse.json(
        {
          error: 'Loan application not eligible',
          reason: eligibilityCheck.reason,
          details: eligibilityCheck.details,
          code: 'ELIGIBILITY_FAILED'
        },
        { status: 400 }
      );
    }

    // === STEP 4: DUPLICATE PREVENTION ===
    // Ensure customer doesn't have multiple active loans
    const existingLoan = await Loan.findOne({
      userId: user.id,
      status: { $in: [LoanStatus.APPLIED, LoanStatus.APPROVED, LoanStatus.DISBURSED] }
    });

    if (existingLoan) {
      return NextResponse.json(
        {
          error: 'Active loan exists',
          message: 'You already have an active loan application or outstanding loan',
          existingLoan: {
            reference: existingLoan.reference,
            amount: existingLoan.amount,
            status: existingLoan.status
          },
          code: 'ACTIVE_LOAN_EXISTS'
        },
        { status: 400 }
      );
    }

    // Calculate loan terms using existing service
    const loanCalculation = calculateLoanDetailsV2(amount, termDays);

    // Create loan application
    const newLoan = new Loan({
      userId: user.id,
      amount,
      termDays,
      interestRate: loanCalculation.interestRate,
      interestAmount: loanCalculation.interestAmount,
      totalRepayable: loanCalculation.totalRepayable,
      dueDate: loanCalculation.dueDate,
      status: LoanStatus.APPLIED,
      loanVersion: LoanVersion.V2,
      annualInterestRate: loanCalculation.annualInterestRate,
      outstandingPrincipal: amount,
      accruedInterest: 0,
      lastInterestCalcDate: new Date(),
      totalInterestCharged: 0,
      hasPartialPayments: false
    });

    // Save loan to generate reference number
    await newLoan.save();

    // Try auto-approval
    const autoApprovalResult = await tryAutoApprove(newLoan, currentUser);
    
    if (autoApprovalResult.approved) {
      newLoan.status = LoanStatus.APPROVED;
      newLoan.isAutoApproved = true;
      await newLoan.save();
    }

    // Prepare response
    const response = {
      success: true,
      loan: {
        id: newLoan._id,
        reference: newLoan.reference,
        amount: newLoan.amount,
        termDays: newLoan.termDays,
        interestRate: newLoan.interestRate,
        interestAmount: newLoan.interestAmount,
        totalRepayable: newLoan.totalRepayable,
        dueDate: newLoan.dueDate,
        status: newLoan.status,
        isAutoApproved: newLoan.isAutoApproved,
        createdAt: newLoan.createdAt
      },
      calculation: {
        principal: amount,
        interestAmount: loanCalculation.interestAmount,
        totalRepayable: loanCalculation.totalRepayable,
        annualRate: loanCalculation.annualInterestRate,
        dailyRate: loanCalculation.dailyInterestRate,
        termDays
      },
      nextSteps: autoApprovalResult.approved 
        ? ['Your loan has been automatically approved!', 'Funds will be disbursed within 24 hours', 'You will receive an email confirmation']
        : ['Your application is under review', 'You will be notified within 24 hours', 'Please ensure your KYC documents are up to date']
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Loan application error:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to process loan application',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

// Export the POST handler with authentication
export const POST = withCustomerAuth(handleLoanApplication);
