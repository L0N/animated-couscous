/**
 * Admin Loan Rejection API
 * 
 * Handles loan rejection by administrators with reason tracking and customer notification.
 * 
 * Data Flow:
 * 1. Authentication → Verify admin access
 * 2. Loan validation → Ensure loan exists and is in correct status
 * 3. Rejection reason validation → Ensure proper reason is provided
 * 4. Status update → Change loan status to rejected with reason
 * 5. Customer notification → Email customer about rejection with reason
 * 6. Audit logging → Record admin action for compliance
 * 7. Response → Return updated loan details
 * 
 * Security Features:
 * - Admin authentication required
 * - Loan status validation (only APPLIED loans can be rejected)
 * - Mandatory rejection reason for transparency
 * - Audit trail for all rejection actions
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { requireAdmin } from '@/middleware/auth';
import { validateRequestBody } from '@/lib/validation';
import Loan from '@/models/Loan';
import User from '@/models/User';
import { LoanStatus } from '@/types';
import { sendEmail } from '@/lib/email';

/**
 * Predefined rejection reasons for consistency and analytics
 */
const REJECTION_REASONS = [
  'insufficient_income',
  'poor_credit_history',
  'incomplete_kyc',
  'invalid_documents',
  'debt_to_income_ratio',
  'employment_verification_failed',
  'duplicate_application',
  'policy_violation',
  'other'
] as const;

/**
 * Loan rejection request validation schema
 */
const rejectLoanSchema = z.object({
  reason: z.enum(REJECTION_REASONS, {
    errorMap: () => ({ message: 'Please select a valid rejection reason' })
  }),
  notes: z.string().min(10, 'Rejection notes must be at least 10 characters').max(500, 'Notes too long'),
  allowReapplication: z.boolean().default(true), // Whether customer can reapply
}).strict();

/**
 * Get human-readable rejection reason
 */
function getReasonDescription(reason: string): string {
  const descriptions: Record<string, string> = {
    insufficient_income: 'Insufficient income to support loan repayment',
    poor_credit_history: 'Credit history does not meet our requirements',
    incomplete_kyc: 'Know Your Customer (KYC) verification incomplete',
    invalid_documents: 'Submitted documents are invalid or insufficient',
    debt_to_income_ratio: 'Debt-to-income ratio exceeds acceptable limits',
    employment_verification_failed: 'Unable to verify employment status',
    duplicate_application: 'Duplicate loan application detected',
    policy_violation: 'Application violates lending policies',
    other: 'Other reasons (see notes for details)'
  };
  
  return descriptions[reason] || 'Unspecified reason';
}

/**
 * Validate loan is eligible for rejection
 */
async function validateLoanForRejection(loanId: string) {
  // Fetch loan with customer data
  const loan = await Loan.findById(loanId).populate('userId');
  
  if (!loan) {
    return { valid: false, error: 'Loan not found', loan: null };
  }

  // Check loan status
  if (loan.status !== LoanStatus.APPLIED) {
    return { 
      valid: false, 
      error: `Cannot reject loan with status: ${loan.status}. Only applied loans can be rejected.`,
      loan: null 
    };
  }

  // Check if customer exists
  const customer = loan.userId as any;
  if (!customer) {
    return { valid: false, error: 'Customer not found', loan: null };
  }

  return { valid: true, error: null, loan, customer };
}

/**
 * POST /api/admin/loans/[id]/reject
 * 
 * Reject a loan application with reason tracking and customer notification
 * 
 * Data Flow:
 * 1. Authentication → Verify admin access
 * 2. Request validation → Validate rejection parameters
 * 3. Loan validation → Ensure loan is eligible for rejection
 * 4. Status update → Change loan status to rejected with reason
 * 5. Customer notification → Email customer about rejection
 * 6. Audit logging → Record admin action
 * 7. Response → Return updated loan details
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // === STEP 1: AUTHENTICATION ===
    // Verify admin access
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return auth.error;
    }

    await connectDB();

    const loanId = params.id;
    const adminId = auth.userId;

    // === STEP 2: REQUEST VALIDATION ===
    // Parse and validate request body
    const body = await request.json();
    const validation = await validateRequestBody(rejectLoanSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const { reason, notes, allowReapplication } = validation.data;

    // === STEP 3: LOAN VALIDATION ===
    // Validate loan eligibility for rejection
    const loanValidation = await validateLoanForRejection(loanId);
    if (!loanValidation.valid) {
      return NextResponse.json(
        { success: false, error: loanValidation.error },
        { status: 400 }
      );
    }

    const { loan, customer } = loanValidation;

    // === STEP 4: LOAN STATUS UPDATE ===
    // Update loan status to rejected with reason and admin details
    const updatedLoan = await Loan.findByIdAndUpdate(
      loanId,
      {
        $set: {
          status: LoanStatus.REJECTED,
          rejectedAt: new Date(),
          rejectedBy: adminId,
          rejectionReason: reason,
          rejectionNotes: notes,
          allowReapplication: allowReapplication,
        }
      },
      { new: true, runValidators: true }
    );

    if (!updatedLoan) {
      return NextResponse.json(
        { success: false, error: 'Failed to update loan status' },
        { status: 500 }
      );
    }

    // === STEP 5: CUSTOMER NOTIFICATION ===
    // Send rejection notification to customer with reason and guidance
    try {
      const reasonDescription = getReasonDescription(reason);
      
      await sendEmail({
        to: customer.email,
        subject: `Loan Application Update - ${loan.reference}`,
        html: `
          <h2>Loan Application Update</h2>
          <p>Dear ${customer.name},</p>
          <p>Thank you for your loan application. After careful review, we are unable to approve your loan at this time.</p>
          
          <div style="background: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #ffc107;">
            <h3>Application Details:</h3>
            <p><strong>Loan Reference:</strong> ${loan.reference}</p>
            <p><strong>Amount Requested:</strong> K${loan.amount}</p>
            <p><strong>Reason:</strong> ${reasonDescription}</p>
            ${notes ? `<p><strong>Additional Notes:</strong> ${notes}</p>` : ''}
          </div>
          
          ${allowReapplication ? `
            <div style="background: #d1ecf1; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #17a2b8;">
              <h3>Next Steps:</h3>
              <p>You may reapply for a loan after addressing the concerns mentioned above. We recommend:</p>
              <ul>
                <li>Reviewing and updating your application information</li>
                <li>Ensuring all required documents are complete and valid</li>
                <li>Contacting our support team if you need assistance</li>
              </ul>
              <p>We appreciate your interest in WanPaus and look forward to serving you in the future.</p>
            </div>
          ` : `
            <div style="background: #f8d7da; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #dc3545;">
              <p><strong>Please Note:</strong> Based on our review, you may not be eligible to reapply at this time. Please contact our support team for more information.</p>
            </div>
          `}
          
          <p>If you have any questions about this decision, please don't hesitate to contact our customer support team.</p>
          
          <p>Best regards,<br>The WanPaus Team</p>
        `
      });
    } catch (emailError) {
      console.error('Failed to send rejection notification:', emailError);
      // Don't fail the rejection if email fails
    }

    // === STEP 6: AUDIT LOGGING ===
    // Log admin action for compliance and analytics
    console.log(`Loan rejected by admin:`, {
      loanId: loan._id,
      loanReference: loan.reference,
      customerId: customer._id,
      customerEmail: customer.email,
      amount: loan.amount,
      adminId: adminId,
      rejectedAt: new Date(),
      reason: reason,
      reasonDescription: getReasonDescription(reason),
      notes: notes,
      allowReapplication: allowReapplication,
      ip: request.headers.get('x-forwarded-for') || 'unknown'
    });

    // === STEP 7: RESPONSE ===
    // Return success response with updated loan details
    return NextResponse.json({
      success: true,
      loan: {
        id: updatedLoan._id,
        reference: updatedLoan.reference,
        amount: updatedLoan.amount,
        status: updatedLoan.status,
        rejectedAt: updatedLoan.rejectedAt,
        rejectionReason: reason,
        rejectionReasonDescription: getReasonDescription(reason),
        allowReapplication: allowReapplication,
        customer: {
          name: customer.name,
          email: customer.email,
          phone: customer.phone
        }
      },
      message: `Loan ${loan.reference} rejected. Customer has been notified.`
    });

  } catch (error) {
    console.error('Loan rejection error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reject loan' },
      { status: 500 }
    );
  }
}
