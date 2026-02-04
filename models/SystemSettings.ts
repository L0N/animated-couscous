/**
 * System Settings Model - Tenant-Scoped Configuration for WanPaus v4.0
 * 
 * Manages system-wide settings and financial tracking per tenant.
 * Each tenant has its own singleton configuration record.
 * 
 * Business Rules:
 * - One settings record per tenant (singleton pattern per tenant)
 * - Financial tracking isolated per tenant
 * - Backward compatibility with global singleton for single-tenant deployments
 * 
 * Data Flow:
 * 1. Tenant creation → Settings initialization
 * 2. Financial operations → Settings updates
 * 3. Admin queries → Tenant-scoped settings retrieval
 */

import mongoose, { Schema, Model } from 'mongoose';
import { ISystemSettings } from '@/types';

export interface ITenantSystemSettings extends mongoose.Document {
  _id: string; // Format: 'tenant-{tenantId}' or 'singleton' for legacy
  tenantId?: mongoose.Types.ObjectId; // Optional for backward compatibility
  
  // Financial Tracking
  cashOnHand: number;
  totalDisbursed: number;
  totalRepaid: number;
  interestEarned: number;
  
  // System Configuration
  maxLoanAmount?: number;
  minLoanAmount?: number;
  gracePeriodDays?: number;
  
  // Audit Fields
  createdAt: Date;
  updatedAt: Date;
}

const systemSettingsSchema = new Schema<ITenantSystemSettings>({
  _id: {
    type: String,
    required: true,
    // Format: 'tenant-{tenantId}' or 'singleton' for legacy
  },
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true,
    // Optional for backward compatibility with legacy singleton
  },
  
  // Financial Tracking
  cashOnHand: {
    type: Number,
    required: true,
    default: 0,
    min: [0, 'Cash on hand cannot be negative'],
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
  interestEarned: {
    type: Number,
    default: 0,
    min: [0, 'Interest earned cannot be negative'],
  },
  
  // System Configuration (optional, defaults from tenant)
  maxLoanAmount: {
    type: Number,
    min: [100, 'Maximum loan amount must be at least K100'],
  },
  minLoanAmount: {
    type: Number,
    min: [10, 'Minimum loan amount must be at least K10'],
  },
  gracePeriodDays: {
    type: Number,
    min: [0, 'Grace period cannot be negative'],
    max: [30, 'Grace period cannot exceed 30 days'],
  },
}, {
  timestamps: true,
  _id: false, // Use custom _id
});

// Index for tenant-scoped queries
systemSettingsSchema.index({ tenantId: 1 });

// Static method to get or create tenant-scoped singleton
systemSettingsSchema.statics.getTenantSingleton = async function (
  tenantId: mongoose.Types.ObjectId,
  initialCash?: number
) {
  const settingsId = `tenant-${tenantId.toString()}`;
  let settings = await this.findById(settingsId);
  
  if (!settings) {
    settings = await this.create({
      _id: settingsId,
      tenantId,
      cashOnHand: initialCash || parseFloat(process.env.INITIAL_CASH_BALANCE || '10000'),
      totalDisbursed: 0,
      totalRepaid: 0,
      interestEarned: 0,
    });
  }
  
  return settings;
};

// Legacy method for backward compatibility
systemSettingsSchema.statics.getSingleton = async function () {
  let settings = await this.findById('singleton');
  if (!settings) {
    settings = await this.create({
      _id: 'singleton',
      cashOnHand: parseFloat(process.env.INITIAL_CASH_BALANCE || '10000'),
      totalDisbursed: 0,
      totalRepaid: 0,
      interestEarned: 0,
    });
  }
  return settings;
};

const SystemSettings: Model<ISystemSettings> = mongoose.models.SystemSettings || 
  mongoose.model<ISystemSettings>('SystemSettings', systemSettingsSchema);

export default SystemSettings;
