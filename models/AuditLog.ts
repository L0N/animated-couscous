import mongoose, { Schema, Model } from 'mongoose';
import { IAuditLog } from '@/types';

const auditLogSchema = new Schema<IAuditLog>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  action: {
    type: String,
    required: [true, 'Action is required'],
  },
  entityType: {
    type: String,
    enum: ['user', 'loan', 'payment', 'system'],
    required: [true, 'Entity type is required'],
  },
  entityId: {
    type: Schema.Types.ObjectId,
  },
  details: {
    type: Schema.Types.Mixed,
    default: {},
  },
  ipAddress: String,
}, {
  timestamps: true,
});

// Indexes
auditLogSchema.index({ userId: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ createdAt: -1 });

// Static method for logging
auditLogSchema.statics.log = async function (
  action: string,
  entityType: 'user' | 'loan' | 'payment' | 'system',
  details: Record<string, any>,
  userId?: string,
  entityId?: string,
  ipAddress?: string
) {
  try {
    await this.create({
      userId,
      action,
      entityType,
      entityId,
      details,
      ipAddress,
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
};

const AuditLog: Model<IAuditLog> = mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', auditLogSchema);

export default AuditLog;

