/**
 * Customer Payment Upload API
 * 
 * Handles payment proof submission with file validation and secure storage.
 * 
 * Data Flow:
 * 1. Request validation → JWT authentication + multipart form parsing
 * 2. File validation → Type, size, and format checks
 * 3. Loan verification → Ensure payment is for valid customer loan
 * 4. File storage → Upload to Vercel Blob with secure naming
 * 5. Payment record creation → Create pending payment record in database
 * 6. Admin notification → Email notification for payment verification
 * 7. Response generation → Return payment reference and status
 * 
 * Security Features:
 * - JWT authentication required
 * - File type validation (images, PDFs only)
 * - File size limits (max 10MB)
 * - Secure file naming to prevent conflicts
 * - Rate limiting to prevent abuse
 */

import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { withCustomerAuth } from '@/middleware/customerAuth';
import { validateRequestBody } from '@/lib/validation';
import { applyRateLimit } from '@/lib/rateLimiting';
import User from '@/models/User';
import Loan from '@/models/Loan';
import Payment from '@/models/Payment';
import { LoanStatus, PaymentStatus } from '@/types';
import { sendEmail } from '@/lib/email';

/**
 * Payment upload request validation schema
 * Ensures all required fields are present and valid
 */
const uploadPaymentSchema = z.object({
  loanId: z.string().min(1, 'Loan ID is required'),
  amount: z.number().min(1, 'Payment amount must be at least K1').max(10000, 'Payment amount too large'),
  description: z.string().optional(),
});

/**
 * Supported file types for payment proof
 * Images and PDFs are accepted for payment verification
 */
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/webp',
  'application/pdf'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit

/**
 * Validate uploaded file meets security and format requirements
 */
function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File size must be less than 10MB' };
  }

  // Check file type
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return { valid: false, error: 'Only images (JPEG, PNG, WebP) and PDF files are allowed' };
  }

  // Check file name length
  if (file.name.length > 255) {
    return { valid: false, error: 'File name too long' };
  }

  return { valid: true };
}

/**
 * Generate secure file name to prevent conflicts and maintain organization
 */
function generateSecureFileName(originalName: string, userId: string, loanId: string): string {
  const timestamp = Date.now();
  const extension = originalName.split('.').pop() || 'bin';
  const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
  
  return `payments/${userId}/${loanId}/${timestamp}_${sanitizedName}`;
}

/**
 * Main payment upload handler
 * 
 * Data Flow:
 * 1. Authentication → Verify customer JWT token
 * 2. Rate limiting → Prevent abuse (5 uploads per minute)
 * 3. Form parsing → Extract file and metadata from multipart form
 * 4. File validation → Security and format checks
 * 5. Loan verification → Ensure customer owns the loan and it's active
 * 6. File upload → Store securely in Vercel Blob
 * 7. Payment creation → Create pending payment record
 * 8. Admin notification → Email admin for verification
 * 9. Response → Return payment reference and next steps
 */
async function handlePaymentUpload(
  request: NextRequest,
  user: any // JWT-decoded user from customerAuth middleware
): Promise<NextResponse> {
  try {
    await connectDB();

    // === STEP 1: RATE LIMITING ===
    // Prevent abuse with 5 uploads per minute per user
    const rateLimitResult = await applyRateLimit(request, `payment-upload:${user.id}`, 5, 60);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Too many upload attempts. Please wait before trying again.' 
        },
        { status: 429 }
      );
    }

    // === STEP 2: FORM DATA PARSING ===
    // Parse multipart form data containing file and metadata
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const loanId = formData.get('loanId') as string;
    const amount = parseFloat(formData.get('amount') as string);
    const description = formData.get('description') as string;

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Payment proof file is required' },
        { status: 400 }
      );
    }

    // === STEP 3: REQUEST VALIDATION ===
    // Validate payment metadata against schema
    const validation = await validateRequestBody(uploadPaymentSchema, {
      loanId,
      amount,
      description
    });

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    // === STEP 4: FILE VALIDATION ===
    // Security and format validation for uploaded file
    const fileValidation = validateFile(file);
    if (!fileValidation.valid) {
      return NextResponse.json(
        { success: false, error: fileValidation.error },
        { status: 400 }
      );
    }

    // === STEP 5: LOAN VERIFICATION ===
    // Ensure customer owns the loan and it's in a valid state for payments
    const loan = await Loan.findOne({
      _id: loanId,
      userId: user.id,
      status: { $in: [LoanStatus.DISBURSED, LoanStatus.OVERDUE] }
    });

    if (!loan) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Loan not found or not eligible for payments' 
        },
        { status: 404 }
      );
    }

    // Check if payment amount is reasonable
    const remainingBalance = loan.totalRepayable - (loan.totalPrincipalRepaid + loan.totalInterestRepaid);
    if (amount > remainingBalance * 1.1) { // Allow 10% overpayment
      return NextResponse.json(
        { 
          success: false, 
          error: `Payment amount (K${amount}) exceeds remaining balance (K${remainingBalance.toFixed(2)})` 
        },
        { status: 400 }
      );
    }

    // === STEP 6: FILE UPLOAD ===
    // Upload file to Vercel Blob with secure naming
    const fileName = generateSecureFileName(file.name, user.id, loanId);
    
    const blob = await put(fileName, file, {
      access: 'public', // Admin needs to view for verification
      addRandomSuffix: true, // Additional security
    });

    // === STEP 7: PAYMENT RECORD CREATION ===
    // Create pending payment record for admin verification
    const payment = new Payment({
      loanId: loan._id,
      userId: user.id,
      amount: amount,
      proofUrl: blob.url,
      status: PaymentStatus.PENDING,
      // v2.0.1 fields for interest calculation
      interestCalculatedToDate: new Date(),
      outstandingPrincipalBefore: loan.outstandingPrincipal || loan.amount,
      accruedInterestBefore: loan.accruedInterest || 0,
    });

    await payment.save();

    // === STEP 8: ADMIN NOTIFICATION ===
    // Notify admin of new payment for verification
    try {
      await sendEmail({
        to: process.env.ADMIN_EMAIL || 'admin@wanpaus.com.pg',
        subject: `New Payment Submitted - ${loan.reference}`,
        html: `
          <h2>Payment Verification Required</h2>
          <p><strong>Loan:</strong> ${loan.reference}</p>
          <p><strong>Customer:</strong> ${user.name} (${user.email})</p>
          <p><strong>Amount:</strong> K${amount}</p>
          <p><strong>Remaining Balance:</strong> K${remainingBalance.toFixed(2)}</p>
          <p><strong>Payment Proof:</strong> <a href="${blob.url}" target="_blank">View Document</a></p>
          <p><strong>Description:</strong> ${description || 'None provided'}</p>
          <br>
          <p>Please verify this payment in the admin dashboard.</p>
        `
      });
    } catch (emailError) {
      console.error('Failed to send admin notification:', emailError);
      // Don't fail the request if email fails
    }

    // === STEP 9: RESPONSE GENERATION ===
    // Return success response with payment details
    return NextResponse.json({
      success: true,
      payment: {
        id: payment._id,
        amount: payment.amount,
        status: payment.status,
        proofUrl: payment.proofUrl,
        submittedAt: payment.createdAt,
        loan: {
          reference: loan.reference,
          remainingBalance: remainingBalance
        }
      },
      message: 'Payment proof uploaded successfully. It will be verified by our team within 24 hours.'
    });

  } catch (error) {
    console.error('Payment upload error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to upload payment proof. Please try again.' 
      },
      { status: 500 }
    );
  }
}

// Export POST handler with customer authentication
export const POST = withCustomerAuth(handlePaymentUpload);
