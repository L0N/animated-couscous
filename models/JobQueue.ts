/**
 * Job Queue Model - Background Processing for WanPaus v4.0
 * 
 * Manages background jobs for automated system processes including
 * interest accrual, default detection, grace period handling, and email sending.
 * 
 * Business Rules:
 * - Jobs are processed in priority order (CRITICAL > NORMAL > LOW)
 * - Failed jobs are retried with exponential backoff
 * - Dead letter queue for permanently failed jobs
 * - Tenant-scoped job processing for multi-tenant isolation
 * 
 * Data Flow:
 * 1. Job creation → Queue insertion with priority
 * 2. Worker processing → Status updates and progress tracking
 * 3. Success/failure → Completion logging and retry logic
 * 4. Monitoring → Health checks and alerting
 */

import mongoose, { Schema, Model } from 'mongoose';

export enum JobType {
  INTEREST_ACCRUAL = 'interest_accrual',
  DEFAULT_DETECTION = 'default_detection',
  GRACE_EXPIRY = 'grace_expiry',
  EMAIL_SENDING = 'email_sending',
  KYC_REMINDER = 'kyc_reminder',
  PAYMENT_REMINDER = 'payment_reminder',
  REGULATORY_EXPORT = 'regulatory_export',
  DATA_CLEANUP = 'data_cleanup',
}

export enum JobPriority {
  CRITICAL = 'critical',
  NORMAL = 'normal',
  LOW = 'low',
}

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
  DEAD_LETTER = 'dead_letter',
}

export interface IJobQueue extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  
  // Job Details
  type: JobType;
  priority: JobPriority;
  status: JobStatus;
  
  // Job Data
  payload: Record<string, any>; // Job-specific data
  result?: Record<string, any>; // Job execution result
  
  // Scheduling
  scheduledFor: Date; // When to execute the job
  startedAt?: Date;
  completedAt?: Date;
  
  // Retry Logic
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  nextRetryAt?: Date;
  
  // Processing Metadata
  workerId?: string; // Worker instance that processed the job
  processingTime?: number; // Execution time in milliseconds
  
  // Audit Trail
  createdBy?: mongoose.Types.ObjectId; // User or system that created the job
  createdAt: Date;
  updatedAt: Date;
}

const jobQueueSchema = new Schema<IJobQueue>({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    required: [true, 'Tenant ID is required'],
    index: true,
  },
  
  // Job Details
  type: {
    type: String,
    enum: Object.values(JobType),
    required: [true, 'Job type is required'],
    index: true,
  },
  priority: {
    type: String,
    enum: Object.values(JobPriority),
    default: JobPriority.NORMAL,
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: Object.values(JobStatus),
    default: JobStatus.PENDING,
    required: true,
    index: true,
  },
  
  // Job Data
  payload: {
    type: Schema.Types.Mixed,
    required: [true, 'Job payload is required'],
  },
  result: {
    type: Schema.Types.Mixed,
  },
  
  // Scheduling
  scheduledFor: {
    type: Date,
    default: Date.now,
    required: true,
    index: true,
  },
  startedAt: {
    type: Date,
    index: true,
  },
  completedAt: {
    type: Date,
    index: true,
  },
  
  // Retry Logic
  attempts: {
    type: Number,
    default: 0,
    min: [0, 'Attempts cannot be negative'],
  },
  maxAttempts: {
    type: Number,
    default: 3,
    min: [1, 'Max attempts must be at least 1'],
    max: [10, 'Max attempts cannot exceed 10'],
  },
  lastError: {
    type: String,
    trim: true,
  },
  nextRetryAt: {
    type: Date,
    index: true,
  },
  
  // Processing Metadata
  workerId: {
    type: String,
    trim: true,
    index: true,
  },
  processingTime: {
    type: Number,
    min: [0, 'Processing time cannot be negative'],
  },
  
  // Audit Trail
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
  collection: 'jobqueue',
});

// Compound indexes for efficient job processing
jobQueueSchema.index({ tenantId: 1, status: 1, priority: 1, scheduledFor: 1 });
jobQueueSchema.index({ tenantId: 1, type: 1, status: 1 });
jobQueueSchema.index({ status: 1, nextRetryAt: 1 });
jobQueueSchema.index({ workerId: 1, status: 1 });
jobQueueSchema.index({ createdAt: 1 });

// Priority order for job processing
const priorityOrder = {
  [JobPriority.CRITICAL]: 1,
  [JobPriority.NORMAL]: 2,
  [JobPriority.LOW]: 3,
};

// Static method to enqueue a job
jobQueueSchema.statics.enqueue = async function(
  tenantId: mongoose.Types.ObjectId,
  type: JobType,
  payload: Record<string, any>,
  options: {
    priority?: JobPriority;
    scheduledFor?: Date;
    maxAttempts?: number;
    createdBy?: mongoose.Types.ObjectId;
  } = {}
) {
  const job = new this({
    tenantId,
    type,
    payload,
    priority: options.priority || JobPriority.NORMAL,
    scheduledFor: options.scheduledFor || new Date(),
    maxAttempts: options.maxAttempts || 3,
    createdBy: options.createdBy,
  });
  
  await job.save();
  return job;
};

// Static method to get next job for processing
jobQueueSchema.statics.getNextJob = async function(
  workerId: string,
  tenantId?: mongoose.Types.ObjectId
) {
  const query: any = {
    status: JobStatus.PENDING,
    scheduledFor: { $lte: new Date() },
  };
  
  if (tenantId) {
    query.tenantId = tenantId;
  }
  
  // Find and update in one atomic operation
  const job = await this.findOneAndUpdate(
    query,
    {
      status: JobStatus.PROCESSING,
      startedAt: new Date(),
      workerId,
      $inc: { attempts: 1 },
    },
    {
      sort: {
        priority: 1, // CRITICAL first
        scheduledFor: 1, // Oldest first within priority
      },
      new: true,
    }
  );
  
  return job;
};

// Static method to get retry jobs
jobQueueSchema.statics.getRetryJobs = async function(limit: number = 10) {
  return this.find({
    status: JobStatus.RETRYING,
    nextRetryAt: { $lte: new Date() },
  })
    .sort({ nextRetryAt: 1 })
    .limit(limit);
};

// Static method for job statistics
jobQueueSchema.statics.getStats = async function(
  tenantId?: mongoose.Types.ObjectId,
  hours: number = 24
) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const query: any = { createdAt: { $gte: since } };
  
  if (tenantId) {
    query.tenantId = tenantId;
  }
  
  const stats = await this.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgProcessingTime: { $avg: '$processingTime' },
      },
    },
  ]);
  
  const result = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    retrying: 0,
    deadLetter: 0,
    avgProcessingTime: 0,
  };
  
  stats.forEach(stat => {
    const status = stat._id.toLowerCase().replace('_', '');
    result[status] = stat.count;
    if (stat.avgProcessingTime) {
      result.avgProcessingTime = Math.max(result.avgProcessingTime, stat.avgProcessingTime);
    }
  });
  
  return result;
};

// Method to mark job as completed
jobQueueSchema.methods.complete = async function(result?: Record<string, any>) {
  this.status = JobStatus.COMPLETED;
  this.completedAt = new Date();
  this.processingTime = this.startedAt ? Date.now() - this.startedAt.getTime() : 0;
  
  if (result) {
    this.result = result;
  }
  
  await this.save();
  return this;
};

// Method to mark job as failed with retry logic
jobQueueSchema.methods.fail = async function(error: string) {
  this.lastError = error;
  
  if (this.attempts >= this.maxAttempts) {
    // Move to dead letter queue
    this.status = JobStatus.DEAD_LETTER;
  } else {
    // Schedule for retry with exponential backoff
    this.status = JobStatus.RETRYING;
    const backoffMinutes = Math.pow(2, this.attempts) * 5; // 5, 10, 20, 40 minutes
    this.nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);
  }
  
  await this.save();
  return this;
};

// Method to reset job for retry
jobQueueSchema.methods.retry = async function() {
  if (this.status !== JobStatus.RETRYING) {
    throw new Error('Job is not in retrying status');
  }
  
  this.status = JobStatus.PENDING;
  this.nextRetryAt = undefined;
  this.startedAt = undefined;
  this.workerId = undefined;
  
  await this.save();
  return this;
};

// Virtual for job age
jobQueueSchema.virtual('ageInMinutes').get(function() {
  return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60));
});

// Virtual for processing duration
jobQueueSchema.virtual('processingDuration').get(function() {
  if (!this.startedAt) return 0;
  const endTime = this.completedAt || new Date();
  return Math.floor((endTime.getTime() - this.startedAt.getTime()) / 1000);
});

// Ensure JSON output includes virtuals
jobQueueSchema.set('toJSON', { virtuals: true });
jobQueueSchema.set('toObject', { virtuals: true });

const JobQueue: Model<IJobQueue> = mongoose.models.JobQueue || mongoose.model<IJobQueue>('JobQueue', jobQueueSchema);

export default JobQueue;
