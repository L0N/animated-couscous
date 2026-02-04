/**
 * User Model - Customer and Admin Management
 * 
 * Manages user accounts with comprehensive credit tracking and KYC verification.
 * 
 * Data Flow:
 * 1. User registration → Basic profile creation
 * 2. KYC document upload → Verification process
 * 3. Loan applications → Credit limit and tier tracking
 * 4. Payment history → Tier progression and trustworthy status
 * 
 * Key Features:
 * - Tier-based credit limits (Bronze K50 → Diamond K1000)
 * - Dual trustworthy paths (10 consecutive payments OR complete progression)
 * - Credit rebuilding system after defaults
 * - Complete KYC document management
 * - Role-based access control (Customer/Admin)
 */

import mongoose, { Schema, Model } from 'mongoose';
import { IUser, UserRole, IDType, UserStatus, TrustworthyPath } from '@/types';

/**
 * KYC (Know Your Customer) document schema
 * Stores verification documents and status for regulatory compliance
 */
const kycSchema = new Schema({
  idType: {
    type: String,
    enum: Object.values(IDType),
  },
  idNumber: String,
  idDocumentUrl: String,
  employmentProof: String,
  bankStatement: String,
  verified: {
    type: Boolean,
    default: false,
  },
}, { _id: false });

/**
 * Main user schema with comprehensive credit tracking
 * Supports both v1.0.0 legacy fields and v2.0.1 enhanced features
 */
const userSchema = new Schema<IUser>({
  // === BASIC PROFILE INFORMATION ===
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    // Note: Hashed with bcrypt before storage
  },
  role: {
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.CUSTOMER,
    // Controls access to admin vs customer endpoints
  },

  // === CREDIT SYSTEM (v2.0.1 Enhanced) ===
  currentLimit: {
    type: Number,
    default: 50, // Bronze tier starting limit
    min: [50, 'Minimum limit is K50'],
    // Tier progression: 50→100→200→500→1000 (Bronze→Silver→Gold→Platinum→Diamond)
  },
  onTimeCount: {
    type: Number,
    default: 0,
    min: [0, 'On-time count cannot be negative'],
    // Legacy v1.0.0 field - maintained for backward compatibility
  },
  isTrustworthy: {
    type: Boolean,
    default: false,
    // Unlocks Diamond tier access and auto-approval eligibility
    // Achieved via: 10 consecutive payments OR complete tier progression
  },
  kyc: {
    type: kycSchema,
    default: () => ({ verified: false }),
    // Required for loan applications and regulatory compliance
  },

  // === v2.0.1 ENHANCED CREDIT TRACKING ===
  status: {
    type: String,
    enum: Object.values(UserStatus),
    default: UserStatus.NEW,
    // NEW → ACTIVE → REBUILDING (after default) → ACTIVE (after recovery)
  },
  consecutiveOnTimePayments: {
    type: Number,
    default: 0,
    min: [0, 'Consecutive on-time payments cannot be negative'],
    // Resets to 0 after tier upgrade or late payment
    // Used for tier progression (2 payments = tier upgrade)
  },
  totalConsecutiveOnTimePayments: {
    type: Number,
    default: 0,
    min: [0, 'Total consecutive on-time payments cannot be negative'],
    // Cumulative across all loans - never resets except on default
    // Used for trustworthy status (10 payments = trustworthy)
  },
  trustworthyPath: {
    type: String,
    enum: Object.values(TrustworthyPath),
    // TIER_BASED: Achieved via complete progression (Bronze→Diamond)
    // EXPERIENCE_BASED: Achieved via 10 consecutive payments
  },
  lastTierUpgrade: Date,
  // Timestamp of most recent tier advancement for audit trail
}, {
  timestamps: true, // Adds createdAt and updatedAt for audit trail
});

/**
 * Database indexes for query optimization
 * Critical for performance with large user bases
 */
// Authentication and basic queries
userSchema.index({ email: 1 }); // Unique login lookup
userSchema.index({ role: 1 }); // Admin vs customer filtering

// Credit system queries
userSchema.index({ currentLimit: 1 }); // Tier-based analytics
userSchema.index({ isTrustworthy: 1 }); // Auto-approval eligibility
userSchema.index({ status: 1 }); // Active vs rebuilding users

// Payment tracking queries (v2.0.1)
userSchema.index({ consecutiveOnTimePayments: 1 }); // Tier progression tracking
userSchema.index({ totalConsecutiveOnTimePayments: 1 }); // Trustworthy status tracking

/**
 * Security: Remove password from JSON responses
 * Prevents accidental password exposure in API responses
 */
userSchema.set('toJSON', {
  transform: function (_doc, ret) {
    delete ret.password;
    return ret;
  },
});

/**
 * Export User model with Mongoose hot-reload support
 * Prevents model re-compilation errors in development
 */
const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', userSchema);

export default User;
