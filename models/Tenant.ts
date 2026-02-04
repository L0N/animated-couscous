/**
 * Tenant Model - Multi-Tenant Support for WanPaus v4.0
 * 
 * Manages isolated lending operations for multiple organizations.
 * Each tenant has separate capital pools, configurations, and user bases.
 * 
 * Business Rules:
 * - Each tenant has isolated capital pool and loan limits
 * - Tenant-scoped admins can only access their tenant's data
 * - Default tenant created for single-tenant deployments
 * - Immutable tenant creation (no deletion after loans exist)
 * 
 * Data Flow:
 * 1. Tenant creation → Capital pool initialization
 * 2. Admin assignment → Tenant-scoped access control
 * 3. Customer registration → Tenant association
 * 4. Loan operations → Tenant-isolated processing
 */

import mongoose, { Schema, Model } from 'mongoose';

export interface ITenant extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  code: string; // Unique identifier (e.g., 'default', 'bank-a')
  displayName: string;
  
  // Capital Pool Management
  initialCapital: number;
  currentCapital: number;
  totalDisbursed: number;
  totalRepaid: number;
  reservedForOperations: number; // 50% of capital
  
  // Tenant Configuration
  maxLoanAmount: number;
  minLoanAmount: number;
  gracePeriodDays: number;
  interestRates: {
    term14: number;
    term30: number;
    term60: number;
    term90: number;
  };
  
  // Regulatory Settings
  kycRequired: boolean;
  complianceLevel: 'basic' | 'standard' | 'enhanced';
  regulatoryReporting: boolean;
  
  // Status and Metadata
  isActive: boolean;
  timezone: string; // Default: 'Pacific/Port_Moresby'
  currency: string; // Default: 'PGK'
  
  // Audit Fields
  createdAt: Date;
  updatedAt: Date;
  createdBy: mongoose.Types.ObjectId;
}

const tenantSchema = new Schema<ITenant>({
  name: {
    type: String,
    required: [true, 'Tenant name is required'],
    trim: true,
    maxlength: [100, 'Tenant name cannot exceed 100 characters'],
  },
  code: {
    type: String,
    required: [true, 'Tenant code is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9-]+$/, 'Tenant code must contain only lowercase letters, numbers, and hyphens'],
    maxlength: [50, 'Tenant code cannot exceed 50 characters'],
  },
  displayName: {
    type: String,
    required: [true, 'Display name is required'],
    trim: true,
    maxlength: [150, 'Display name cannot exceed 150 characters'],
  },
  
  // Capital Pool Management
  initialCapital: {
    type: Number,
    required: [true, 'Initial capital is required'],
    min: [1000, 'Minimum initial capital is K1,000'],
  },
  currentCapital: {
    type: Number,
    required: true,
    min: [0, 'Current capital cannot be negative'],
  },
  totalDisbursed: {
    type: Number,
    default: 0,
    min: [0, 'Total disbursed cannot be negative'],
  },
  totalRepaid: {
    type: Number,
    default: 0,
    min: [0, 'Total repaid cannot be negative'],
  },
  reservedForOperations: {
    type: Number,
    required: true,
    min: [0, 'Reserved operations amount cannot be negative'],
  },
  
  // Tenant Configuration
  maxLoanAmount: {
    type: Number,
    default: 1000,
    min: [100, 'Maximum loan amount must be at least K100'],
  },
  minLoanAmount: {
    type: Number,
    default: 50,
    min: [10, 'Minimum loan amount must be at least K10'],
  },
  gracePeriodDays: {
    type: Number,
    default: 7,
    min: [0, 'Grace period cannot be negative'],
    max: [30, 'Grace period cannot exceed 30 days'],
  },
  interestRates: {
    term14: {
      type: Number,
      default: 0.30,
      min: [0, 'Interest rate cannot be negative'],
      max: [2, 'Interest rate cannot exceed 200%'],
    },
    term30: {
      type: Number,
      default: 0.60,
      min: [0, 'Interest rate cannot be negative'],
      max: [2, 'Interest rate cannot exceed 200%'],
    },
    term60: {
      type: Number,
      default: 0.75,
      min: [0, 'Interest rate cannot be negative'],
      max: [2, 'Interest rate cannot exceed 200%'],
    },
    term90: {
      type: Number,
      default: 1.00,
      min: [0, 'Interest rate cannot be negative'],
      max: [2, 'Interest rate cannot exceed 200%'],
    },
  },
  
  // Regulatory Settings
  kycRequired: {
    type: Boolean,
    default: true,
  },
  complianceLevel: {
    type: String,
    enum: ['basic', 'standard', 'enhanced'],
    default: 'standard',
  },
  regulatoryReporting: {
    type: Boolean,
    default: true,
  },
  
  // Status and Metadata
  isActive: {
    type: Boolean,
    default: true,
  },
  timezone: {
    type: String,
    default: 'Pacific/Port_Moresby',
  },
  currency: {
    type: String,
    default: 'PGK',
    enum: ['PGK', 'USD', 'AUD'],
  },
  
  // Audit Fields
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required'],
  },
}, {
  timestamps: true,
  collection: 'tenants',
});

// Indexes for performance
tenantSchema.index({ code: 1 }, { unique: true });
tenantSchema.index({ isActive: 1 });
tenantSchema.index({ createdAt: 1 });

// Pre-save middleware to calculate reserved operations amount
tenantSchema.pre('save', function(next) {
  if (this.isModified('initialCapital') || this.isModified('currentCapital')) {
    // Reserve 50% of current capital for operations
    this.reservedForOperations = Math.floor(this.currentCapital * 0.5);
  }
  next();
});

// Virtual for available lending capital
tenantSchema.virtual('availableLendingCapital').get(function() {
  return this.currentCapital - this.reservedForOperations;
});

// Method to check if tenant can disburse loan
tenantSchema.methods.canDisburseLoan = function(amount: number): boolean {
  return this.availableLendingCapital >= amount && this.isActive;
};

// Method to update capital after disbursement
tenantSchema.methods.disburseLoan = function(amount: number) {
  if (!this.canDisburseLoan(amount)) {
    throw new Error('Insufficient capital for loan disbursement');
  }
  this.currentCapital -= amount;
  this.totalDisbursed += amount;
  this.reservedForOperations = Math.floor(this.currentCapital * 0.5);
};

// Method to update capital after repayment
tenantSchema.methods.receiveRepayment = function(amount: number) {
  this.currentCapital += amount;
  this.totalRepaid += amount;
  this.reservedForOperations = Math.floor(this.currentCapital * 0.5);
};

// Ensure JSON output includes virtuals
tenantSchema.set('toJSON', { virtuals: true });
tenantSchema.set('toObject', { virtuals: true });

const Tenant: Model<ITenant> = mongoose.models.Tenant || mongoose.model<ITenant>('Tenant', tenantSchema);

export default Tenant;
