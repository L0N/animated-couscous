import mongoose, { Schema, Model } from 'mongoose';
import { IPayment, PaymentStatus } from '@/types';

const paymentSchema = new Schema<IPayment>({
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
}, {
  timestamps: true,
});

// Indexes
paymentSchema.index({ loanId: 1 });
paymentSchema.index({ userId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ createdAt: -1 });

const Payment: Model<IPayment> = mongoose.models.Payment || mongoose.model<IPayment>('Payment', paymentSchema);

export default Payment;

