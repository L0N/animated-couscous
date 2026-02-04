/**
 * Enhanced Audit Log Model - Immutable Compliance Logging for WanPaus v4.0
 * 
 * Provides comprehensive, immutable audit trail for regulatory compliance.
 * All admin actions, system events, and data changes are permanently logged.
 * 
 * Business Rules:
 * - Immutable records (no updates or deletes allowed)
 * - Tenant-scoped audit logs for data isolation
 * - Complete before/after state capture for data changes
 * - Regulatory export capabilities with CSV format
 * 
 * Data Flow:
 * 1. Admin/system action → Audit log creation
 * 2. Before/after state capture → Change tracking
 * 3. Immutable storage → Compliance guarantee
 * 4. Export functionality → Regulatory reporting
 */

import mongoose, { Schema, Model } from 'mongoose';

export enum AuditAction {
  // Loan Management
  LOAN_APPLIED = 'loan_applied',
  LOAN_APPROVED = 'loan_approved',
  LOAN_REJECTED = 'loan_rejected',
  LOAN_DISBURSED = 'loan_disbursed',
  LOAN_DEFAULTED = 'loan_defaulted',
  LOAN_REPAID = 'loan_repaid',
  
  // Payment Processing
  PAYMENT_UPLOADED = 'payment_uploaded',
  PAYMENT_VERIFIED = 'payment_verified',
  PAYMENT_REJECTED = 'payment_rejected',
  PAYMENT_ALLOCATED = 'payment_allocated',
  
  // Customer Management
  CUSTOMER_CREATED = 'customer_created',
  CUSTOMER_UPDATED = 'customer_updated',
  CUSTOMER_STATUS_CHANGED = 'customer_status_changed',
  CUSTOMER_TRUSTWORTHY_UPDATED = 'customer_trustworthy_updated',
  
  // KYC Management
  KYC_DOCUMENT_UPLOADED = 'kyc_document_uploaded',
  KYC_VERIFIED = 'kyc_verified',
  KYC_REJECTED = 'kyc_rejected',
  KYC_STATUS_CHANGED = 'kyc_status_changed',
  
  // Admin Actions
  ADMIN_LOGIN = 'admin_login',
  ADMIN_LOGOUT = 'admin_logout',
  ADMIN_CREATED = 'admin_created',
  ADMIN_ROLE_CHANGED = 'admin_role_changed',
  
  // System Events
  SYSTEM_CONFIGURED = 'system_configured',
  CAPITAL_ADJUSTED = 'capital_adjusted',
  INTEREST_ACCRUED = 'interest_accrued',
  DEFAULT_DETECTED = 'default_detected',
  
  // Tenant Management
  TENANT_CREATED = 'tenant_created',
  TENANT_UPDATED = 'tenant_updated',
  TENANT_DEACTIVATED = 'tenant_deactivated',
}

export interface IAuditLog extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId; // Multi-tenant support
  
  // Action Details
  action: AuditAction;
  timestamp: Date;
  
  // Actor Information
  actorId: mongoose.Types.ObjectId; // Admin or system user
  actorType: 'admin' | 'system' | 'customer';
  actorEmail?: string;
  
  // Entity Information
  entityType: 'loan' | 'user' | 'payment' | 'tenant' | 'system';
  entityId: mongoose.Types.ObjectId;
  entityReference?: string; // Human-readable reference (e.g., loan reference)
  
  // Change Tracking
  beforeValues?: Record<string, any>;
  afterValues?: Record<string, any>;
  changes?: Record<string, any>; // Only fields that changed
  
  // Request Context
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  
  // Status and Metadata
  status: 'success' | 'failed';
  errorMessage?: string;
  metadata?: Record<string, any>; // Additional context
  
  // Immutability Guarantee
  readonly createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    required: [true, 'Tenant ID is required'],
    index: true,
  },
  
  // Action Details
  action: {
    type: String,
    enum: Object.values(AuditAction),
    required: [true, 'Action is required'],
    index: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true,
  },
  
  // Actor Information
  actorId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Actor ID is required'],
    index: true,
  },
  actorType: {
    type: String,
    enum: ['admin', 'system', 'customer'],
    required: [true, 'Actor type is required'],
  },
  actorEmail: {
    type: String,
    trim: true,
    lowercase: true,
  },
  
  // Entity Information
  entityType: {
    type: String,
    enum: ['loan', 'user', 'payment', 'tenant', 'system'],
    required: [true, 'Entity type is required'],
    index: true,
  },
  entityId: {
    type: Schema.Types.ObjectId,
    required: [true, 'Entity ID is required'],
    index: true,
  },
  entityReference: {
    type: String,
    trim: true,
    index: true,
  },
  
  // Change Tracking
  beforeValues: {
    type: Schema.Types.Mixed,
  },
  afterValues: {
    type: Schema.Types.Mixed,
  },
  changes: {
    type: Schema.Types.Mixed,
  },
  
  // Request Context
  ipAddress: {
    type: String,
    trim: true,
  },
  userAgent: {
    type: String,
    trim: true,
  },
  requestId: {
    type: String,
    trim: true,
    index: true,
  },
  
  // Status and Metadata
  status: {
    type: String,
    enum: ['success', 'failed'],
    default: 'success',
    required: true,
  },
  errorMessage: {
    type: String,
    trim: true,
  },
  metadata: {
    type: Schema.Types.Mixed,
  },
}, {
  timestamps: { createdAt: true, updatedAt: false }, // Only createdAt, no updates allowed
  collection: 'auditlogs',
});

// Compound indexes for efficient querying
auditLogSchema.index({ tenantId: 1, timestamp: -1 });
auditLogSchema.index({ tenantId: 1, actorId: 1, timestamp: -1 });
auditLogSchema.index({ tenantId: 1, entityType: 1, entityId: 1, timestamp: -1 });
auditLogSchema.index({ tenantId: 1, action: 1, timestamp: -1 });
auditLogSchema.index({ tenantId: 1, status: 1, timestamp: -1 });

// Prevent updates and deletes to ensure immutability
auditLogSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], function() {
  throw new Error('Audit logs are immutable and cannot be updated');
});

auditLogSchema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete'], function() {
  throw new Error('Audit logs are immutable and cannot be deleted');
});

// Static method to create audit log entry
auditLogSchema.statics.createEntry = async function(data: Partial<IAuditLog>) {
  try {
    const auditLog = new this(data);
    await auditLog.save();
    return auditLog;
  } catch (error) {
    console.error('Failed to create audit log entry:', error);
    // Don't throw error to prevent breaking main operations
    return null;
  }
};

// Static method for regulatory export
auditLogSchema.statics.exportForCompliance = async function(
  tenantId: mongoose.Types.ObjectId,
  startDate: Date,
  endDate: Date,
  actions?: AuditAction[]
) {
  const query: any = {
    tenantId,
    timestamp: { $gte: startDate, $lte: endDate },
  };
  
  if (actions && actions.length > 0) {
    query.action = { $in: actions };
  }
  
  return this.find(query)
    .populate('actorId', 'name email')
    .sort({ timestamp: -1 })
    .lean();
};

// Legacy compatibility method
auditLogSchema.statics.log = async function (
  action: string,
  entityType: 'user' | 'loan' | 'payment' | 'system',
  details: Record<string, any>,
  userId?: string,
  entityId?: string,
  ipAddress?: string
) {
  try {
    // Convert to new format for backward compatibility
    await this.createEntry({
      tenantId: new mongoose.Types.ObjectId('000000000000000000000000'), // Default tenant
      action: action as AuditAction,
      actorId: userId ? new mongoose.Types.ObjectId(userId) : new mongoose.Types.ObjectId('000000000000000000000000'),
      actorType: 'admin',
      entityType,
      entityId: entityId ? new mongoose.Types.ObjectId(entityId) : new mongoose.Types.ObjectId('000000000000000000000000'),
      metadata: details,
      ipAddress,
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
};

const AuditLog: Model<IAuditLog> = mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', auditLogSchema);

export default AuditLog;
