import { z } from 'zod';

// Auth validation schemas
export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(7, 'Phone number must be at least 7 digits').max(20),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Loan validation schemas
export const applyLoanSchema = z.object({
  amount: z.number().positive('Amount must be positive').max(1000, 'Maximum loan amount is K1000'),
  termDays: z.enum(['14', '30', '60', '90']).transform(Number).or(
    z.number().refine((val) => [14, 30, 60, 90].includes(val), {
      message: 'Term must be 14, 30, 60, or 90 days',
    })
  ),
});

// Payment validation schemas
export const uploadPaymentSchema = z.object({
  loanId: z.string().min(1, 'Loan ID is required'),
  amount: z.number().positive('Amount must be positive'),
});

export const verifyPaymentSchema = z.object({
  principalPaid: z.number().min(0).optional(),
  interestPaid: z.number().min(0).optional(),
  approved: z.boolean(),
  rejectionReason: z.string().optional(),
});

// Admin validation schemas
export const setTrustworthySchema = z.object({
  isTrustworthy: z.boolean(),
});

export const rejectLoanSchema = z.object({
  reason: z.string().min(5, 'Rejection reason must be at least 5 characters'),
});

// KYC validation schema
export const updateKYCSchema = z.object({
  idType: z.enum(['national', 'driver', 'employment']),
  idNumber: z.string().min(5, 'ID number must be at least 5 characters'),
});

// System settings validation
export const addCashSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
});

// Helper function to validate request body
export async function validateRequestBody<T>(
  schema: z.ZodSchema<T>,
  body: any
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const data = await schema.parseAsync(body);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map((err) => err.message).join(', ');
      return { success: false, error: messages };
    }
    return { success: false, error: 'Validation failed' };
  }
}

// Helper to validate file uploads
export function validateFileUpload(
  file: File,
  allowedTypes: string[],
  maxSizeMB: number = 5
): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${allowedTypes.join(', ')}`,
    };
  }

  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${maxSizeMB}MB`,
    };
  }

  return { valid: true };
}

