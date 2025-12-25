import mongoose, { Schema, Model } from 'mongoose';
import { ISystemSettings } from '@/types';

const systemSettingsSchema = new Schema<ISystemSettings>({
  _id: {
    type: String,
    default: 'singleton',
  },
  cashOnHand: {
    type: Number,
    required: true,
    default: 0,
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
}, {
  timestamps: true,
  _id: false,
});

// Static method to get or create singleton
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

