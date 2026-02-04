/**
 * Customer Profile Management API
 * 
 * Handles customer profile viewing and updating with security guardrails.
 * 
 * Data Flow:
 * GET: Authentication → Database lookup → Profile sanitization → Response
 * PUT: Authentication → Validation → Immutable field protection → Database update → Response
 * 
 * Security Features:
 * - JWT authentication required
 * - Immutable field protection (email, ID numbers, KYC verification dates)
 * - Input validation and sanitization
 * - Rate limiting to prevent abuse
 * - Audit logging for profile changes
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { withCustomerAuth } from '@/middleware/customerAuth';
import { validateRequestBody } from '@/lib/validation';
import { applyRateLimit } from '@/lib/rateLimiting';
import User from '@/models/User';
import { IDType } from '@/types';

/**
 * Profile update validation schema
 * Defines which fields customers can modify and validation rules
 */
const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long').optional(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional(),
  // KYC fields that can be updated before verification
  kyc: z.object({
    idType: z.enum([IDType.NATIONAL, IDType.DRIVER, IDType.EMPLOYMENT]).optional(),
    idNumber: z.string().min(5, 'ID number too short').max(50, 'ID number too long').optional(),
  }).optional(),
}).strict(); // Prevent additional fields

/**
 * Fields that customers cannot modify for security and compliance
 * These fields require admin intervention or special processes
 */
const IMMUTABLE_FIELDS = [
  'email',           // Email changes require verification process
  'role',            // Role changes are admin-only
  'currentLimit',    // Credit limits are system-managed
  'onTimeCount',     // Payment history is system-managed
  'isTrustworthy',   // Trustworthy status is system-managed
  'status',          // Account status is admin-managed
  'consecutiveOnTimePayments', // Payment tracking is system-managed
  'totalConsecutiveOnTimePayments', // Payment tracking is system-managed
  'trustworthyPath', // Trustworthy path is system-determined
  'lastTierUpgrade', // Tier upgrades are system-managed
  'kyc.verified',    // KYC verification is admin-only
  'kyc.idDocumentUrl', // Document URLs are upload-only
  'kyc.employmentProof', // Document URLs are upload-only
  'kyc.bankStatement', // Document URLs are upload-only
];

/**
 * Sanitize user profile for customer viewing
 * Removes sensitive fields and formats data appropriately
 */
function sanitizeProfileForCustomer(user: any) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    // Credit information
    currentLimit: user.currentLimit,
    isTrustworthy: user.isTrustworthy,
    status: user.status,
    // KYC information (sanitized)
    kyc: {
      idType: user.kyc?.idType,
      idNumber: user.kyc?.idNumber ? `***${user.kyc.idNumber.slice(-4)}` : undefined, // Mask ID number
      verified: user.kyc?.verified || false,
      hasIdDocument: !!user.kyc?.idDocumentUrl,
      hasEmploymentProof: !!user.kyc?.employmentProof,
      hasBankStatement: !!user.kyc?.bankStatement,
    },
    // Tier progression info
    tierInfo: {
      onTimeCount: user.onTimeCount,
      consecutiveOnTimePayments: user.consecutiveOnTimePayments,
      totalConsecutiveOnTimePayments: user.totalConsecutiveOnTimePayments,
      trustworthyPath: user.trustworthyPath,
      lastTierUpgrade: user.lastTierUpgrade,
    },
    // Account timestamps
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * GET /api/customer/profile
 * 
 * Retrieve customer profile information with sensitive data sanitized
 * 
 * Data Flow:
 * 1. Authentication → Verify customer JWT token
 * 2. Database lookup → Fetch current user data
 * 3. Data sanitization → Remove/mask sensitive fields
 * 4. Response → Return sanitized profile data
 */
async function handleGetProfile(
  request: NextRequest,
  user: any // JWT-decoded user from customerAuth middleware
): Promise<NextResponse> {
  try {
    await connectDB();

    // === STEP 1: FETCH CURRENT USER DATA ===
    // Get fresh user data from database (JWT may be stale)
    const currentUser = await User.findById(user.id);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // === STEP 2: SANITIZE AND RETURN PROFILE ===
    // Remove sensitive fields and format for customer viewing
    const sanitizedProfile = sanitizeProfileForCustomer(currentUser);

    return NextResponse.json({
      success: true,
      profile: sanitizedProfile
    });

  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve profile' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/customer/profile
 * 
 * Update customer profile with security guardrails and validation
 * 
 * Data Flow:
 * 1. Authentication → Verify customer JWT token
 * 2. Rate limiting → Prevent abuse (3 updates per hour)
 * 3. Request validation → Validate against schema
 * 4. Immutable field protection → Reject attempts to modify protected fields
 * 5. Database update → Apply changes to allowed fields only
 * 6. Audit logging → Record profile changes for compliance
 * 7. Response → Return updated profile data
 */
async function handleUpdateProfile(
  request: NextRequest,
  user: any // JWT-decoded user from customerAuth middleware
): Promise<NextResponse> {
  try {
    await connectDB();

    // === STEP 1: RATE LIMITING ===
    // Prevent abuse with 3 profile updates per hour
    const rateLimitResult = await applyRateLimit(request, `profile-update:${user.id}`, 3, 3600);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Too many profile updates. Please wait before trying again.' 
        },
        { status: 429 }
      );
    }

    // === STEP 2: REQUEST VALIDATION ===
    // Parse and validate request body
    const body = await request.json();
    const validation = await validateRequestBody(updateProfileSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const updateData = validation.data;

    // === STEP 3: IMMUTABLE FIELD PROTECTION ===
    // Check for attempts to modify protected fields
    const attemptedFields = Object.keys(body);
    const protectedAttempts = attemptedFields.filter(field => 
      IMMUTABLE_FIELDS.some(immutable => field.startsWith(immutable.split('.')[0]))
    );

    if (protectedAttempts.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Cannot modify protected fields: ${protectedAttempts.join(', ')}` 
        },
        { status: 403 }
      );
    }

    // === STEP 4: FETCH CURRENT USER ===
    // Get current user data for update
    const currentUser = await User.findById(user.id);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // === STEP 5: SPECIAL VALIDATION FOR KYC UPDATES ===
    // Prevent KYC updates if already verified
    if (updateData.kyc && currentUser.kyc?.verified) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cannot modify KYC information after verification. Contact support for changes.' 
        },
        { status: 403 }
      );
    }

    // === STEP 6: APPLY UPDATES ===
    // Update only the allowed fields
    const updateFields: any = {};

    if (updateData.name) {
      updateFields.name = updateData.name.trim();
    }

    if (updateData.phone) {
      // Check if phone number is already in use by another user
      const existingUser = await User.findOne({ 
        phone: updateData.phone, 
        _id: { $ne: user.id } 
      });
      
      if (existingUser) {
        return NextResponse.json(
          { success: false, error: 'Phone number already in use' },
          { status: 409 }
        );
      }
      
      updateFields.phone = updateData.phone;
    }

    if (updateData.kyc) {
      // Merge KYC updates with existing data
      updateFields.kyc = {
        ...currentUser.kyc,
        ...updateData.kyc
      };
    }

    // Perform the update
    const updatedUser = await User.findByIdAndUpdate(
      user.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    // === STEP 7: AUDIT LOGGING ===
    // Log profile changes for compliance (simplified for now)
    console.log(`Profile updated for user ${user.id}:`, {
      userId: user.id,
      updatedFields: Object.keys(updateFields),
      timestamp: new Date(),
      ip: request.headers.get('x-forwarded-for') || 'unknown'
    });

    // === STEP 8: RESPONSE ===
    // Return updated profile data
    const sanitizedProfile = sanitizeProfileForCustomer(updatedUser);

    return NextResponse.json({
      success: true,
      profile: sanitizedProfile,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}

// Export handlers with customer authentication
export const GET = withCustomerAuth(handleGetProfile);
export const PUT = withCustomerAuth(handleUpdateProfile);
