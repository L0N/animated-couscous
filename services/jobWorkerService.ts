/**
 * Job Worker Service - Background Processing for WanPaus v4.0
 * 
 * Processes background jobs for automated system operations including
 * interest accrual, default detection, grace period handling, and notifications.
 * 
 * Business Rules:
 * - Jobs processed in priority order (CRITICAL > NORMAL > LOW)
 * - Failed jobs retried with exponential backoff
 * - Tenant-scoped processing for data isolation
 * - PNG timezone handling for accurate scheduling
 * 
 * Data Flow:
 * 1. Worker startup → Job queue polling
 * 2. Job processing → Business logic execution
 * 3. Success/failure → Status updates and retry logic
 * 4. Monitoring → Health checks and metrics
 */

import mongoose from 'mongoose';
import JobQueue, { JobType, JobStatus, JobPriority } from '@/models/JobQueue';
import AuditLog, { AuditAction } from '@/models/AuditLog';
import Loan from '@/models/Loan';
import User from '@/models/User';
import Tenant from '@/models/Tenant';
import { interestService } from './interestService';
import { loanService } from './loanService';

export class JobWorkerService {
  private workerId: string;
  private isRunning: boolean = false;
  private pollInterval: number = 5000; // 5 seconds
  private maxConcurrentJobs: number = 3;
  private currentJobs: Set<string> = new Set();

  constructor(workerId?: string) {
    this.workerId = workerId || `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start the job worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log(`Worker ${this.workerId} is already running`);
      return;
    }

    this.isRunning = true;
    console.log(`🚀 Starting job worker: ${this.workerId}`);

    // Process retry jobs first
    await this.processRetryJobs();

    // Start main polling loop
    this.pollForJobs();
  }

  /**
   * Stop the job worker
   */
  async stop(): Promise<void> {
    console.log(`🛑 Stopping job worker: ${this.workerId}`);
    this.isRunning = false;

    // Wait for current jobs to complete
    while (this.currentJobs.size > 0) {
      console.log(`Waiting for ${this.currentJobs.size} jobs to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`✅ Job worker stopped: ${this.workerId}`);
  }

  /**
   * Main job polling loop
   */
  private async pollForJobs(): Promise<void> {
    while (this.isRunning) {
      try {
        // Check if we can process more jobs
        if (this.currentJobs.size < this.maxConcurrentJobs) {
          const job = await JobQueue.getNextJob(this.workerId);
          
          if (job) {
            this.currentJobs.add(job._id.toString());
            // Process job asynchronously
            this.processJob(job).finally(() => {
              this.currentJobs.delete(job._id.toString());
            });
          }
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, this.pollInterval));
      } catch (error) {
        console.error('Error in job polling loop:', error);
        await new Promise(resolve => setTimeout(resolve, this.pollInterval * 2));
      }
    }
  }

  /**
   * Process retry jobs
   */
  private async processRetryJobs(): Promise<void> {
    try {
      const retryJobs = await JobQueue.getRetryJobs(10);
      
      for (const job of retryJobs) {
        await job.retry();
        console.log(`🔄 Retrying job: ${job.type} (${job._id})`);
      }
    } catch (error) {
      console.error('Error processing retry jobs:', error);
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: any): Promise<void> {
    const startTime = Date.now();
    console.log(`🔧 Processing job: ${job.type} (${job._id}) - Attempt ${job.attempts}`);

    try {
      let result: any = {};

      switch (job.type) {
        case JobType.INTEREST_ACCRUAL:
          result = await this.processInterestAccrual(job);
          break;
        case JobType.DEFAULT_DETECTION:
          result = await this.processDefaultDetection(job);
          break;
        case JobType.GRACE_EXPIRY:
          result = await this.processGraceExpiry(job);
          break;
        case JobType.EMAIL_SENDING:
          result = await this.processEmailSending(job);
          break;
        case JobType.KYC_REMINDER:
          result = await this.processKYCReminder(job);
          break;
        case JobType.PAYMENT_REMINDER:
          result = await this.processPaymentReminder(job);
          break;
        case JobType.REGULATORY_EXPORT:
          result = await this.processRegulatoryExport(job);
          break;
        case JobType.DATA_CLEANUP:
          result = await this.processDataCleanup(job);
          break;
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      // Mark job as completed
      await job.complete(result);
      
      const duration = Date.now() - startTime;
      console.log(`✅ Completed job: ${job.type} (${job._id}) in ${duration}ms`);

      // Create audit log
      await AuditLog.createEntry({
        tenantId: job.tenantId,
        action: AuditAction.SYSTEM_CONFIGURED,
        actorId: new mongoose.Types.ObjectId('000000000000000000000000'), // System user
        actorType: 'system',
        entityType: 'system',
        entityId: job._id,
        entityReference: `job-${job.type}`,
        metadata: {
          jobType: job.type,
          processingTime: duration,
          result,
        },
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`❌ Failed job: ${job.type} (${job._id}) after ${duration}ms:`, errorMessage);

      // Mark job as failed
      await job.fail(errorMessage);

      // Create audit log for failure
      await AuditLog.createEntry({
        tenantId: job.tenantId,
        action: AuditAction.SYSTEM_CONFIGURED,
        actorId: new mongoose.Types.ObjectId('000000000000000000000000'), // System user
        actorType: 'system',
        entityType: 'system',
        entityId: job._id,
        entityReference: `job-${job.type}`,
        status: 'failed',
        errorMessage,
        metadata: {
          jobType: job.type,
          processingTime: duration,
          attempts: job.attempts,
        },
      });
    }
  }

  /**
   * Process interest accrual job
   */
  private async processInterestAccrual(job: any): Promise<any> {
    const { tenantId, targetDate } = job.payload;
    const date = targetDate ? new Date(targetDate) : new Date();

    // Get all active loans for the tenant
    const loans = await Loan.find({
      tenantId,
      status: { $in: ['disbursed', 'overdue'] },
      loanVersion: 'v2', // Only v2 loans have daily interest
    });

    let processedLoans = 0;
    let totalInterestAccrued = 0;

    for (const loan of loans) {
      try {
        const accrualResult = await interestService.calculateDailyInterest(loan._id, date);
        if (accrualResult.interestAccrued > 0) {
          processedLoans++;
          totalInterestAccrued += accrualResult.interestAccrued;
        }
      } catch (error) {
        console.error(`Error accruing interest for loan ${loan.reference}:`, error);
      }
    }

    return {
      processedLoans,
      totalInterestAccrued,
      targetDate: date.toISOString(),
    };
  }

  /**
   * Process default detection job
   */
  private async processDefaultDetection(job: any): Promise<any> {
    const { tenantId, gracePeriodDays = 7 } = job.payload;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - gracePeriodDays);

    // Find overdue loans past grace period
    const overdueLoans = await Loan.find({
      tenantId,
      status: 'overdue',
      dueDate: { $lt: cutoffDate },
    }).populate('userId', 'name email');

    let defaultedLoans = 0;

    for (const loan of overdueLoans) {
      try {
        // Mark loan as defaulted
        loan.status = 'defaulted';
        await loan.save();

        // Reset customer trustworthy status
        const user = await User.findById(loan.userId);
        if (user) {
          user.isTrustworthy = false;
          user.status = 'rebuilding';
          user.consecutiveOnTimePayments = 0;
          await user.save();
        }

        defaultedLoans++;

        // Create audit log
        await AuditLog.createEntry({
          tenantId,
          action: AuditAction.LOAN_DEFAULTED,
          actorId: new mongoose.Types.ObjectId('000000000000000000000000'), // System user
          actorType: 'system',
          entityType: 'loan',
          entityId: loan._id,
          entityReference: loan.reference,
          metadata: {
            daysOverdue: Math.floor((Date.now() - loan.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
            amount: loan.amount,
            customerId: loan.userId,
          },
        });

      } catch (error) {
        console.error(`Error defaulting loan ${loan.reference}:`, error);
      }
    }

    return {
      defaultedLoans,
      gracePeriodDays,
      cutoffDate: cutoffDate.toISOString(),
    };
  }

  /**
   * Process grace expiry job
   */
  private async processGraceExpiry(job: any): Promise<any> {
    const { tenantId } = job.payload;
    const today = new Date();

    // Find loans that should transition from overdue to defaulted
    const expiredLoans = await Loan.find({
      tenantId,
      status: 'overdue',
      dueDate: { $lt: new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000) }, // 14 days ago
    });

    let processedLoans = 0;

    for (const loan of expiredLoans) {
      try {
        loan.status = 'defaulted';
        await loan.save();
        processedLoans++;
      } catch (error) {
        console.error(`Error expiring grace period for loan ${loan.reference}:`, error);
      }
    }

    return {
      processedLoans,
      targetDate: today.toISOString(),
    };
  }

  /**
   * Process email sending job
   */
  private async processEmailSending(job: any): Promise<any> {
    const { emailType, recipient, subject, content, metadata } = job.payload;

    // TODO: Implement email sending logic using Resend
    console.log(`📧 Sending email: ${emailType} to ${recipient}`);

    return {
      emailType,
      recipient,
      sent: true,
      sentAt: new Date().toISOString(),
    };
  }

  /**
   * Process KYC reminder job
   */
  private async processKYCReminder(job: any): Promise<any> {
    const { tenantId } = job.payload;

    // Find users with incomplete KYC
    const incompleteKYCUsers = await User.find({
      tenantId,
      'kyc.verified': false,
      role: 'customer',
    });

    let remindersSent = 0;

    for (const user of incompleteKYCUsers) {
      try {
        // Enqueue email sending job
        await JobQueue.enqueue(
          tenantId,
          JobType.EMAIL_SENDING,
          {
            emailType: 'kyc_reminder',
            recipient: user.email,
            subject: 'Complete Your KYC Verification',
            content: `Dear ${user.name}, please complete your KYC verification to continue using WanPaus.`,
            metadata: { userId: user._id },
          },
          { priority: JobPriority.LOW }
        );

        remindersSent++;
      } catch (error) {
        console.error(`Error sending KYC reminder to ${user.email}:`, error);
      }
    }

    return {
      remindersSent,
      targetDate: new Date().toISOString(),
    };
  }

  /**
   * Process payment reminder job
   */
  private async processPaymentReminder(job: any): Promise<any> {
    const { tenantId } = job.payload;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find loans due tomorrow
    const upcomingLoans = await Loan.find({
      tenantId,
      status: 'disbursed',
      dueDate: {
        $gte: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate()),
        $lt: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate() + 1),
      },
    }).populate('userId', 'name email');

    let remindersSent = 0;

    for (const loan of upcomingLoans) {
      try {
        const user = loan.userId as any;
        
        // Enqueue email sending job
        await JobQueue.enqueue(
          tenantId,
          JobType.EMAIL_SENDING,
          {
            emailType: 'payment_reminder',
            recipient: user.email,
            subject: `Payment Due Tomorrow - Loan ${loan.reference}`,
            content: `Dear ${user.name}, your loan payment of K${loan.totalRepayable} is due tomorrow.`,
            metadata: { loanId: loan._id, userId: user._id },
          },
          { priority: JobPriority.NORMAL }
        );

        remindersSent++;
      } catch (error) {
        console.error(`Error sending payment reminder for loan ${loan.reference}:`, error);
      }
    }

    return {
      remindersSent,
      targetDate: tomorrow.toISOString(),
    };
  }

  /**
   * Process regulatory export job
   */
  private async processRegulatoryExport(job: any): Promise<any> {
    const { tenantId, exportType, startDate, endDate } = job.payload;

    // TODO: Implement regulatory export logic
    console.log(`📊 Generating regulatory export: ${exportType} for tenant ${tenantId}`);

    return {
      exportType,
      recordCount: 0,
      startDate,
      endDate,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Process data cleanup job
   */
  private async processDataCleanup(job: any): Promise<any> {
    const { tenantId, cleanupType, retentionDays = 90 } = job.payload;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    let cleanedRecords = 0;

    switch (cleanupType) {
      case 'completed_jobs':
        const result = await JobQueue.deleteMany({
          tenantId,
          status: JobStatus.COMPLETED,
          completedAt: { $lt: cutoffDate },
        });
        cleanedRecords = result.deletedCount || 0;
        break;
      
      default:
        console.log(`Unknown cleanup type: ${cleanupType}`);
    }

    return {
      cleanupType,
      cleanedRecords,
      retentionDays,
      cutoffDate: cutoffDate.toISOString(),
    };
  }

  /**
   * Get worker statistics
   */
  async getStats(): Promise<any> {
    return {
      workerId: this.workerId,
      isRunning: this.isRunning,
      currentJobs: this.currentJobs.size,
      maxConcurrentJobs: this.maxConcurrentJobs,
      pollInterval: this.pollInterval,
    };
  }
}

// Export singleton instance
export const jobWorkerService = new JobWorkerService();
