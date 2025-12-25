import mongoose, { Schema, Model } from 'mongoose';
import { ILoan, LoanStatus } from '@/types';

const loanSchema = new Schema<ILoan>({
  reference: {
    type: String,
    required: true,
    unique: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
  },
  amount: {
    type: Number,
    required: [true, 'Loan amount is required'],
    min: [10, 'Minimum loan amount is K10'],
  },
  termDays: {
    type: Number,
    required: [true, 'Loan term is required'],
    enum: [14, 30, 60, 90],
  },
  interestRate: {
    type: Number,
    required: [true, 'Interest rate is required'],
    min: [0, 'Interest rate cannot be negative'],
  },
  interestAmount: {
    type: Number,
    required: [true, 'Interest amount is required'],
    min: [0, 'Interest amount cannot be negative'],
  },
  totalRepayable: {
    type: Number,
    required: [true, 'Total repayable is required'],
  },
  totalPrincipalRepaid: {
    type: Number,
    default: 0,
    min: [0, 'Principal repaid cannot be negative'],
  },
  totalInterestRepaid: {
    type: Number,
    default: 0,
    min: [0, 'Interest repaid cannot be negative'],
  },
  status: {
    type: String,
    enum: Object.values(LoanStatus),
    default: LoanStatus.APPLIED,
  },
  disbursedAt: Date,
  dueDate: {
    type: Date,
    required: [true, 'Due date is required'],
  },
  repaidAt: Date,
  overdueSince: Date,
  isAutoApproved: {
    type: Boolean,
    default: false,
  },
  rejectionReason: String,
}, {
  timestamps: true,
});

// Indexes
loanSchema.index({ userId: 1 });
loanSchema.index({ status: 1 });
loanSchema.index({ dueDate: 1 });
loanSchema.index({ reference: 1 });
loanSchema.index({ createdAt: -1 });

// Pre-save: generate reference number
loanSchema.pre('save', async function (next) {
  if (this.isNew && !this.reference) {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const yearMonth = year + month;

    // Count existing loans with this prefix
    const count = await mongoose.models.Loan.countDocuments({
      reference: new RegExp(`^WP-${yearMonth}`),
    });

    this.reference = `WP-${yearMonth}-${(count + 1).toString().padStart(5, '0')}`;
  }
  next();
});

const Loan: Model<ILoan> = mongoose.models.Loan || mongoose.model<ILoan>('Loan', loanSchema);

export default Loan;

