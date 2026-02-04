/**
 * KYC Document Model - Regulatory Compliance for WanPaus v4.0
 * 
 * Manages Know Your Customer (KYC) document workflow for regulatory compliance.
 * Provides immutable document tracking with verification status and audit trail.
 * 
 * Business Rules:
 * - Immutable document records (no deletion after verification)
 * - Tenant-scoped document management
 * - Required documents: ID, Employment Proof, Bank Statement
 * - Compliance gating: Unverified KYC blocks loan processing
 * 
 * Data Flow:
 * 1. Customer document upload → PENDING status
 * 2. Admin verification → VERIFIED/REJECTED status
 * 3. Compliance check → Loan eligibility gating
 * 4. Regulatory export → Compliance reporting
 */

import mongoose, { Schema, Model } from 'mongoose';

export enum KYCDocumentType {
  NATIONAL_ID = 'national_id',
  DRIVERS_LICENSE = 'drivers_license',
  EMPLOYMENT_ID = 'employment_id',
  EMPLOYMENT_LETTER = 'employment_letter',
  PAYSLIP = 'payslip',
  BANK_STATEMENT = 'bank_statement',
  UTILITY_BILL = 'utility_bill',
  OTHER = 'other',
}

export enum KYCStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

export interface IKYCDocument extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId; // Customer who uploaded the document
  
  // Document Information
  documentType: KYCDocumentType;
  documentUrl: string; // Vercel Blob URL
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  
  // Verification Details
  status: KYCStatus;
  verifiedBy?: mongoose.Types.ObjectId; // Admin who verified
  verifiedAt?: Date;
  rejectionReason?: string;
  expiryDate?: Date; // For documents with expiration
  
  // Compliance Metadata
  documentNumber?: string; // ID number, license number, etc.
  issuingAuthority?: string;
  issueDate?: Date;
  
  // Audit Trail
  submittedAt: Date;
  reviewStartedAt?: Date;
  lastStatusChange: Date;
  
  // Immutability
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

const kycDocumentSchema = new Schema<IKYCDocument>({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    required: [true, 'Tenant ID is required'],
    index: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true,
  },
  
  // Document Information
  documentType: {
    type: String,
    enum: Object.values(KYCDocumentType),
    required: [true, 'Document type is required'],
    index: true,
  },
  documentUrl: {
    type: String,
    required: [true, 'Document URL is required'],
    trim: true,
  },
  originalFilename: {
    type: String,
    required: [true, 'Original filename is required'],
    trim: true,
  },
  fileSize: {
    type: Number,
    required: [true, 'File size is required'],
    min: [1, 'File size must be greater than 0'],
    max: [10485760, 'File size cannot exceed 10MB'], // 10MB limit
  },
  mimeType: {
    type: String,
    required: [true, 'MIME type is required'],
    enum: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ],
  },
  
  // Verification Details
  status: {
    type: String,
    enum: Object.values(KYCStatus),
    default: KYCStatus.PENDING,
    required: true,
    index: true,
  },
  verifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  verifiedAt: {
    type: Date,
    index: true,
  },
  rejectionReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Rejection reason cannot exceed 500 characters'],
  },
  expiryDate: {
    type: Date,
    index: true,
  },
  
  // Compliance Metadata
  documentNumber: {
    type: String,
    trim: true,
    maxlength: [50, 'Document number cannot exceed 50 characters'],
  },
  issuingAuthority: {
    type: String,
    trim: true,
    maxlength: [100, 'Issuing authority cannot exceed 100 characters'],
  },
  issueDate: {
    type: Date,
  },
  
  // Audit Trail
  submittedAt: {
    type: Date,
    default: Date.now,
    required: true,
    index: true,
  },
  reviewStartedAt: {
    type: Date,
    index: true,
  },
  lastStatusChange: {
    type: Date,
    default: Date.now,
    required: true,
    index: true,
  },
}, {
  timestamps: true,
  collection: 'kycdocuments',
});

// Compound indexes for efficient querying
kycDocumentSchema.index({ tenantId: 1, userId: 1, documentType: 1 });
kycDocumentSchema.index({ tenantId: 1, status: 1, submittedAt: -1 });
kycDocumentSchema.index({ tenantId: 1, verifiedBy: 1, verifiedAt: -1 });
kycDocumentSchema.index({ expiryDate: 1 }, { sparse: true });

// Prevent deletion of verified documents
kycDocumentSchema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete'], function() {
  throw new Error('KYC documents cannot be deleted for compliance reasons');
});

// Update lastStatusChange on status modification
kycDocumentSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    this.lastStatusChange = new Date();
    
    if (this.status === KYCStatus.VERIFIED) {
      this.verifiedAt = new Date();
    } else if (this.status === KYCStatus.UNDER_REVIEW && !this.reviewStartedAt) {
      this.reviewStartedAt = new Date();
    }
  }
  next();
});

// Virtual for document age in days
kycDocumentSchema.virtual('ageInDays').get(function() {
  return Math.floor((Date.now() - this.submittedAt.getTime()) / (1000 * 60 * 60 * 24));
});

// Virtual for expiry status
kycDocumentSchema.virtual('isExpired').get(function() {
  return this.expiryDate && this.expiryDate < new Date();
});

// Static method to get customer's KYC compliance status
kycDocumentSchema.statics.getComplianceStatus = async function(
  tenantId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId
) {
  const requiredDocuments = [
    KYCDocumentType.NATIONAL_ID,
    KYCDocumentType.EMPLOYMENT_LETTER,
    KYCDocumentType.BANK_STATEMENT,
  ];
  
  const documents = await this.find({
    tenantId,
    userId,
    documentType: { $in: requiredDocuments },
    status: KYCStatus.VERIFIED,
  });
  
  const verifiedTypes = documents.map(doc => doc.documentType);
  const missingDocuments = requiredDocuments.filter(type => !verifiedTypes.includes(type));
  
  return {
    isCompliant: missingDocuments.length === 0,
    verifiedDocuments: verifiedTypes,
    missingDocuments,
    totalDocuments: documents.length,
    lastVerification: documents.length > 0 ? Math.max(...documents.map(d => d.verifiedAt?.getTime() || 0)) : null,
  };
};

// Static method to get pending documents for admin review
kycDocumentSchema.statics.getPendingReview = async function(
  tenantId: mongoose.Types.ObjectId,
  limit: number = 50
) {
  return this.find({
    tenantId,
    status: { $in: [KYCStatus.SUBMITTED, KYCStatus.UNDER_REVIEW] },
  })
    .populate('userId', 'name email phone')
    .sort({ submittedAt: 1 }) // Oldest first
    .limit(limit)
    .lean();
};

// Static method for regulatory export
kycDocumentSchema.statics.exportForCompliance = async function(
  tenantId: mongoose.Types.ObjectId,
  startDate: Date,
  endDate: Date
) {
  return this.find({
    tenantId,
    submittedAt: { $gte: startDate, $lte: endDate },
  })
    .populate('userId', 'name email phone')
    .populate('verifiedBy', 'name email')
    .sort({ submittedAt: -1 })
    .lean();
};

// Method to verify document
kycDocumentSchema.methods.verify = async function(
  adminId: mongoose.Types.ObjectId,
  documentNumber?: string,
  issuingAuthority?: string,
  issueDate?: Date,
  expiryDate?: Date
) {
  this.status = KYCStatus.VERIFIED;
  this.verifiedBy = adminId;
  this.verifiedAt = new Date();
  
  if (documentNumber) this.documentNumber = documentNumber;
  if (issuingAuthority) this.issuingAuthority = issuingAuthority;
  if (issueDate) this.issueDate = issueDate;
  if (expiryDate) this.expiryDate = expiryDate;
  
  await this.save();
  return this;
};

// Method to reject document
kycDocumentSchema.methods.reject = async function(
  adminId: mongoose.Types.ObjectId,
  reason: string
) {
  this.status = KYCStatus.REJECTED;
  this.verifiedBy = adminId;
  this.rejectionReason = reason;
  
  await this.save();
  return this;
};

// Ensure JSON output includes virtuals
kycDocumentSchema.set('toJSON', { virtuals: true });
kycDocumentSchema.set('toObject', { virtuals: true });

const KYCDocument: Model<IKYCDocument> = mongoose.models.KYCDocument || mongoose.model<IKYCDocument>('KYCDocument', kycDocumentSchema);

export default KYCDocument;
