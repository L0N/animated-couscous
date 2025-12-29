import mongoose, { Schema, Model } from 'mongoose';
import { IUser, UserRole, IDType, UserStatus, TrustworthyPath } from '@/types';

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

const userSchema = new Schema<IUser>({
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
  },
  role: {
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.CUSTOMER,
  },
  currentLimit: {
    type: Number,
    default: 50,
    min: [50, 'Minimum limit is K50'],
  },
  onTimeCount: {
    type: Number,
    default: 0,
    min: [0, 'On-time count cannot be negative'],
  },
  isTrustworthy: {
    type: Boolean,
    default: false,
  },
  kyc: {
    type: kycSchema,
    default: () => ({ verified: false }),
  },
  // v2.0.0 fields
  status: {
    type: String,
    enum: Object.values(UserStatus),
    default: UserStatus.NEW,
  },
  consecutiveOnTimePayments: {
    type: Number,
    default: 0,
    min: [0, 'Consecutive on-time payments cannot be negative'],
  },
  totalConsecutiveOnTimePayments: {
    type: Number,
    default: 0,
    min: [0, 'Total consecutive on-time payments cannot be negative'],
  },
  trustworthyPath: {
    type: String,
    enum: Object.values(TrustworthyPath),
  },
  lastTierUpgrade: Date,
}, {
  timestamps: true,
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ currentLimit: 1 });
userSchema.index({ isTrustworthy: 1 });
// v2.0.0 indexes
userSchema.index({ status: 1 });
userSchema.index({ consecutiveOnTimePayments: 1 });
userSchema.index({ totalConsecutiveOnTimePayments: 1 });

// Don't return password in JSON
userSchema.set('toJSON', {
  transform: function (_doc, ret) {
    delete ret.password;
    return ret;
  },
});

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', userSchema);

export default User;
