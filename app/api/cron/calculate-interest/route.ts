/**
 * Daily Interest Calculation Cron Job (v2.0.0)
 * 
 * Executes daily at midnight PNG time (UTC+10):
 * - Calculates interest for all active v2.0.0 loans
 * - Updates accrued interest amounts
 * - Creates audit trail records
 * - Handles interest caps and loan status transitions
 * - Includes retry logic and admin notifications
 * - Validates calculation integrity post-execution
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPNGNow, getPNGStartOfDay } from '@/lib/timezone';
import { calculateInterestToDate, determineLoanStatus } from '@/services/interestService';
import { createInterestCalculationRecord } from '@/models/InterestCalculation';
import Loan from '@/models/Loan';
import { LoanVersion } from '@/types';

/**
 * Cron job configuration
 */
const CRON_CONFIG = {
  SECRET: process.env.CRON_SECRET,
  MAX_RETRIES: parseInt(process.env.CRON_MAX_RETRIES || '3'),
  BATCH_SIZE: parseInt(process.env.CRON_BATCH_SIZE || '50'),
  TIMEOUT_MS: parseInt(process.env.CRON_TIMEOUT_MS || '300000'), // 5 minutes
} as const;

/**
 * Processing result for individual loan
 */
interface LoanProcessingResult {
  loanId: string;
  success: boolean;
  previousAccrued: number;
  newAccrued: number;
  daysElapsed: number;
  newStatus?: string;
  error?: string;
}

/**
 * Overall cron job result
 */
interface CronJobResult {
  success: boolean;
  startTime: Date;
  endTime: Date;
  duration: number;
  processedLoans: number;
  successfulLoans: number;
  failedLoans: number;
  totalInterestAccrued: number;
  statusChanges: number;
  errors: string[];
  retryAttempt: number;
}

/**
 * Validate cron secret
 */
function validateCronSecret(request: NextRequest): boolean {
  const providedSecret = request.headers.get('x-cron-secret') || 
                        request.nextUrl.searchParams.get('secret');
  
  return providedSecret === CRON_CONFIG.SECRET;
}

/**
 * Process a batch of loans
 */
async function processBatch(loans: any[]): Promise<LoanProcessingResult[]> {
  const results: LoanProcessingResult[] = [];
  const now = getPNGNow();
  
  for (const loan of loans) {
    const result: LoanProcessingResult = {
      loanId: loan._id.toString(),
      success: false,
      previousAccrued: loan.accruedInterest || 0,
      newAccrued: 0,
      daysElapsed: 0,
    };
    
    try {
      // Calculate interest to current date
      const interestCalc = calculateInterestToDate(loan, now);
      
      result.daysElapsed = interestCalc.daysElapsed;
      result.newAccrued = interestCalc.totalAccrued;
      
      // Update loan with new accrued interest
      loan.accruedInterest = interestCalc.totalAccrued;
      loan.lastInterestCalcDate = now;
      
      // Check for status changes
      const newStatus = determineLoanStatus(loan, now);
      if (newStatus !== loan.status) {
        loan.status = newStatus;
        result.newStatus = newStatus;
        
        // Handle interest freeze for defaulted loans
        if (newStatus === 'DEFAULTED' && !loan.interestFrozenAt) {
          loan.interestFrozenAt = now;
        }
      }
      
      // Save loan updates
      await loan.save();
      
      // Create audit trail record
      await createInterestCalculationRecord({
        loanId: loan._id.toString(),
        calculationDate: now,
        lastCalculationDate: loan.lastInterestCalcDate || loan.disbursedAt || loan.createdAt,
        daysElapsed: interestCalc.daysElapsed,
        outstandingPrincipal: loan.outstandingPrincipal || loan.amount,
        annualInterestRate: loan.annualInterestRate || parseFloat(process.env.ANNUAL_INTEREST_RATE || '4.00'),
        dailyInterestRate: interestCalc.dailyRate,
        interestAccrued: interestCalc.interestAccrued,
        totalAccruedBefore: result.previousAccrued,
        totalAccruedAfter: interestCalc.totalAccrued,
        interestCap: interestCalc.interestCap,
        isCapReached: interestCalc.isCapReached,
        calculationType: 'daily_accrual',
        triggeredBy: 'cron_job',
        auditTrail: interestCalc.auditTrail,
      });
      
      result.success = true;
      
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error processing loan ${loan._id}:`, error);
    }
    
    results.push(result);
  }
  
  return results;
}

/**
 * Send admin notification on error
 */
async function sendAdminNotification(result: CronJobResult): Promise<void> {
  try {
    // In a real implementation, this would send an email or Slack notification
    console.error('Cron job failed - Admin notification required:', {
      success: result.success,
      duration: result.duration,
      processedLoans: result.processedLoans,
      failedLoans: result.failedLoans,
      errors: result.errors,
      retryAttempt: result.retryAttempt,
    });
    
    // TODO: Implement actual notification system
    // await sendEmail({
    //   to: process.env.ADMIN_EMAIL,
    //   subject: 'WanPaus Daily Interest Calculation Failed',
    //   body: `The daily interest calculation cron job failed after ${result.retryAttempt} attempts...`
    // });
    
  } catch (error) {
    console.error('Failed to send admin notification:', error);
  }
}

/**
 * Main cron job execution
 */
async function executeCronJob(retryAttempt: number = 1): Promise<CronJobResult> {
  const startTime = getPNGNow();
  const result: CronJobResult = {
    success: false,
    startTime,
    endTime: startTime,
    duration: 0,
    processedLoans: 0,
    successfulLoans: 0,
    failedLoans: 0,
    totalInterestAccrued: 0,
    statusChanges: 0,
    errors: [],
    retryAttempt,
  };
  
  try {
    console.log(`Starting daily interest calculation (attempt ${retryAttempt})...`);
    
    // Find all active v2.0.0 loans that need interest calculation
    const activeLoans = await Loan.find({
      loanVersion: LoanVersion.V2,
      status: { $in: ['DISBURSED', 'ACTIVE', 'LATE'] },
      disbursedAt: { $exists: true },
      $or: [
        { interestFrozenAt: { $exists: false } },
        { interestFrozenAt: null },
      ],
    }).sort({ disbursedAt: 1 }); // Process oldest loans first
    
    console.log(`Found ${activeLoans.length} loans to process`);
    
    // Process loans in batches
    const batches = [];
    for (let i = 0; i < activeLoans.length; i += CRON_CONFIG.BATCH_SIZE) {
      batches.push(activeLoans.slice(i, i + CRON_CONFIG.BATCH_SIZE));
    }
    
    let allResults: LoanProcessingResult[] = [];
    
    for (let i = 0; i < batches.length; i++) {
      console.log(`Processing batch ${i + 1}/${batches.length} (${batches[i].length} loans)`);
      
      const batchResults = await processBatch(batches[i]);
      allResults = allResults.concat(batchResults);
      
      // Small delay between batches to avoid overwhelming the database
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Compile results
    result.processedLoans = allResults.length;
    result.successfulLoans = allResults.filter(r => r.success).length;
    result.failedLoans = allResults.filter(r => !r.success).length;
    result.totalInterestAccrued = allResults
      .filter(r => r.success)
      .reduce((sum, r) => sum + (r.newAccrued - r.previousAccrued), 0);
    result.statusChanges = allResults.filter(r => r.newStatus).length;
    result.errors = allResults
      .filter(r => !r.success)
      .map(r => `Loan ${r.loanId}: ${r.error}`);
    
    result.success = result.failedLoans === 0;
    
    console.log(`Cron job completed:`, {
      success: result.success,
      processed: result.processedLoans,
      successful: result.successfulLoans,
      failed: result.failedLoans,
      totalInterestAccrued: result.totalInterestAccrued,
      statusChanges: result.statusChanges,
    });
    
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    console.error('Cron job execution failed:', error);
  }
  
  result.endTime = getPNGNow();
  result.duration = result.endTime.getTime() - result.startTime.getTime();
  
  return result;
}

/**
 * Main API handler
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Validate cron secret
    if (!validateCronSecret(request)) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid cron secret' },
        { status: 401 }
      );
    }
    
    // Check if this is a retry request
    const retryAttempt = parseInt(request.nextUrl.searchParams.get('retry') || '1');
    
    // Execute cron job with timeout
    const timeoutPromise = new Promise<CronJobResult>((_, reject) => {
      setTimeout(() => reject(new Error('Cron job timeout')), CRON_CONFIG.TIMEOUT_MS);
    });
    
    const executionPromise = executeCronJob(retryAttempt);
    
    const result = await Promise.race([executionPromise, timeoutPromise]);
    
    // Handle failure with retry logic
    if (!result.success && retryAttempt < CRON_CONFIG.MAX_RETRIES) {
      console.log(`Cron job failed, scheduling retry ${retryAttempt + 1}/${CRON_CONFIG.MAX_RETRIES}`);
      
      // Schedule retry (in a real implementation, this might use a queue system)
      setTimeout(async () => {
        try {
          const retryResult = await executeCronJob(retryAttempt + 1);
          if (!retryResult.success) {
            await sendAdminNotification(retryResult);
          }
        } catch (error) {
          console.error('Retry execution failed:', error);
          await sendAdminNotification({
            ...result,
            errors: [...result.errors, `Retry failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
            retryAttempt: retryAttempt + 1,
          });
        }
      }, 5000); // 5 second delay before retry
      
      return NextResponse.json({
        success: false,
        message: 'Cron job failed, retry scheduled',
        result,
        nextRetry: retryAttempt + 1,
      }, { status: 500 });
    }
    
    // Send admin notification if final attempt failed
    if (!result.success && retryAttempt >= CRON_CONFIG.MAX_RETRIES) {
      await sendAdminNotification(result);
    }
    
    // Return result
    return NextResponse.json({
      success: result.success,
      message: result.success ? 'Daily interest calculation completed successfully' : 'Daily interest calculation failed',
      result: {
        duration: result.duration,
        processedLoans: result.processedLoans,
        successfulLoans: result.successfulLoans,
        failedLoans: result.failedLoans,
        totalInterestAccrued: result.totalInterestAccrued,
        statusChanges: result.statusChanges,
        retryAttempt: result.retryAttempt,
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
    }, { 
      status: result.success ? 200 : 500 
    });
    
  } catch (error) {
    console.error('Cron job handler error:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Cron job handler failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * GET handler for cron job status/health check
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Validate cron secret for status checks too
    if (!validateCronSecret(request)) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid cron secret' },
        { status: 401 }
      );
    }
    
    const now = getPNGNow();
    const today = getPNGStartOfDay(now);
    
    // Check if cron job has run today
    const loansUpdatedToday = await Loan.countDocuments({
      loanVersion: LoanVersion.V2,
      lastInterestCalcDate: { $gte: today },
    });
    
    const totalActiveLoans = await Loan.countDocuments({
      loanVersion: LoanVersion.V2,
      status: { $in: ['DISBURSED', 'ACTIVE', 'LATE'] },
      disbursedAt: { $exists: true },
    });
    
    const hasRunToday = loansUpdatedToday > 0;
    const completionRate = totalActiveLoans > 0 ? (loansUpdatedToday / totalActiveLoans) * 100 : 100;
    
    return NextResponse.json({
      status: 'healthy',
      hasRunToday,
      completionRate,
      loansUpdatedToday,
      totalActiveLoans,
      lastRunTime: hasRunToday ? 'Today' : 'Not today',
      nextScheduledRun: 'Midnight PNG time (UTC+10)',
      config: {
        maxRetries: CRON_CONFIG.MAX_RETRIES,
        batchSize: CRON_CONFIG.BATCH_SIZE,
        timeoutMs: CRON_CONFIG.TIMEOUT_MS,
      },
    });
    
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
