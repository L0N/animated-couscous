import mongoose, { Schema, Model } from 'mongoose';
import { IPayment, PaymentStatus } from '@/types';

const paymentSchema = new Schema<IPayment>({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    required: [true, 'Tenant ID is required'],
    index: true,
  },
  loanId: {
    type: Schema.Types.ObjectId,
    ref: 'Loan',
    required: [true, 'Loan ID is required'],
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
  },
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [1, 'Payment amount must be at least K1'],
  },
  proofUrl: {
    type: String,
    required: [true, 'Payment proof is required'],
  },
  status: {
    type: String,
    enum: Object.values(PaymentStatus),
    default: PaymentStatus.PENDING,
  },
  principalPaid: {
    type: Number,
    default: 0,
    min: [0, 'Principal paid cannot be negative'],
  },
  interestPaid: {
    type: Number,
    default: 0,
    min: [0, 'Interest paid cannot be negative'],
  },
  verifiedAt: Date,
  verifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  rejectionReason: String,
  // v2.0.0 fields
  interestPortion: {
    type: Number,
    min: [0, 'Interest portion cannot be negative'],
  },
  principalPortion: {
    type: Number,
    min: [0, 'Principal portion cannot be negative'],
  },
  interestCalculatedToDate: Date,
  outstandingPrincipalBefore: {
    type: Number,
    min: [0, 'Outstanding principal before cannot be negative'],
  },
  outstandingPrincipalAfter: {
    type: Number,
    min: [0, 'Outstanding principal after cannot be negative'],
  },
  accruedInterestBefore: {
    type: Number,
    min: [0, 'Accrued interest before cannot be negative'],
  },
  accruedInterestAfter: {
    type: Number,
    min: [0, 'Accrued interest after cannot be negative'],
  },
}, {
  timestamps: true,
});

// Indexes (tenant-scoped for v4.0)
paymentSchema.index({ tenantId: 1, loanId: 1 });
paymentSchema.index({ tenantId: 1, userId: 1 });
paymentSchema.index({ tenantId: 1, status: 1 });
paymentSchema.index({ tenantId: 1, createdAt: -1 });
// v2.0.0 indexes (tenant-scoped)
paymentSchema.index({ tenantId: 1, interestCalculatedToDate: 1 });
paymentSchema.index({ tenantId: 1, loanId: 1, createdAt: 1 });
// Legacy indexes (for backward compatibility)
paymentSchema.index({ loanId: 1 });
paymentSchema.index({ userId: 1 });
paymentSchema.index({ status: 1 });

const Payment: Model<IPayment> = mongoose.models.Payment || mongoose.model<IPayment>('Payment', paymentSchema);

export default Payment;
