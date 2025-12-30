/**
 * Tier Progression Data Correction Script (v2.0.1)
 * 
 * Identifies and corrects user records with incorrect tier progression
 * and trustworthy status based on the corrected business logic:
 * - Trustworthy status via 10 consecutive payments OR complete tier progression
 * - Diamond tier access requires trustworthy status
 * - Automatic execution on deployment with complete audit trail
 */

import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import Loan from '@/models/Loan';
import Payment from '@/models/Payment';
import AuditLog from '@/models/AuditLog';
import { sendEmail } from '@/lib/email';
import { IUser, UserStatus, TrustworthyPath, LoanStatus } from '@/types';
import { TIER_LIMITS, TIER_NAMES } from '@/services/tierService';

/**
 * Data correction result for individual user
 */
interface UserCorrectionResult {
  userId: string;
  email: string;
  name: string;
  correctionsMade: string[];
  beforeState: {
    currentLimit: number;
    isTrustworthy: boolean;
    status: UserStatus;
    consecutivePayments: number;
    totalPayments: number;
  };
  afterState: {
    currentLimit: number;
    isTrustworthy: boolean;
    status: UserStatus;
    consecutivePayments: number;
    totalPayments: number;
  };
  notificationSent: boolean;
  errors: string[];
}

/**
 * Overall correction summary
 */
interface CorrectionSummary {
  totalUsersScanned: number;
  usersNeedingCorrection: number;
  usersCorrected: number;
  correctionsFailed: number;
  notificationsSent: number;
  notificationsFailed: number;
  executionTime: number;
  correctionDetails: UserCorrectionResult[];
}

/**
 * Calculate user's payment history and determine correct status
 */
async function analyzeUserPaymentHistory(user: IUser): Promise<{
  totalOnTimePayments: number;
  consecutiveOnTimePayments: number;
  hasCompletedTierProgression: boolean;
  shouldBeTrustworthy: boolean;
  correctTrustworthyPath?: TrustworthyPath;
}> {
  // Get all user's loans ordered by creation date
  const loans = await Loan.find({ userId: user._id }).sort({ createdAt: 1 });
  
  let totalOnTimePayments = 0;
  let consecutiveOnTimePayments = 0;
  let hasCompletedTierProgression = false;
  
  // Track tier progression through loan history
  let currentTier = 50; // Start at Bronze
  const tierProgression: number[] = [50];
  
  for (const loan of loans) {
    // Check if loan was repaid on time
    if (loan.status === LoanStatus.REPAID || loan.status === 'REPAID' || loan.status === 'PAID') {
      if (loan.repaidAt && loan.dueDate && loan.repaidAt <= loan.dueDate) {
        totalOnTimePayments++;
        consecutiveOnTimePayments++;
        
        // Check for tier progression (every 2 consecutive payments)
        if (consecutiveOnTimePayments % 2 === 0 && currentTier < 1000) {
          const nextTierIndex = TIER_LIMITS.indexOf(currentTier) + 1;
          if (nextTierIndex < TIER_LIMITS.length) {
            currentTier = TIER_LIMITS[nextTierIndex];
            tierProgression.push(currentTier);
          }
        }
      } else {
        // Late payment resets consecutive counter
        consecutiveOnTimePayments = 0;
      }
    } else if (loan.status === LoanStatus.DEFAULTED || loan.status === 'DEFAULTED') {
      // Default resets everything
      consecutiveOnTimePayments = 0;
      totalOnTimePayments = 0; // Reset total as per business logic
      currentTier = 50;
      tierProgression.length = 1; // Keep only Bronze
    }
  }
  
  // Check if user completed full tier progression
  hasCompletedTierProgression = tierProgression.includes(1000);
  
  // Determine if user should be trustworthy
  const shouldBeTrustworthy = totalOnTimePayments >= 10 || hasCompletedTierProgression;
  const correctTrustworthyPath = hasCompletedTierProgression ? 
    TrustworthyPath.TIER_BASED : TrustworthyPath.EXPERIENCE_BASED;
  
  return {
    totalOnTimePayments,
    consecutiveOnTimePayments,
    hasCompletedTierProgression,
    shouldBeTrustworthy,
    correctTrustworthyPath: shouldBeTrustworthy ? correctTrustworthyPath : undefined,
  };
}

/**
 * Correct individual user's data
 */
async function correctUserData(user: IUser): Promise<UserCorrectionResult> {
  const result: UserCorrectionResult = {
    userId: user._id.toString(),
    email: user.email,
    name: user.name,
    correctionsMade: [],
    beforeState: {
      currentLimit: user.currentLimit,
      isTrustworthy: user.isTrustworthy,
      status: user.status || UserStatus.ACTIVE,
      consecutivePayments: user.consecutiveOnTimePayments || 0,
      totalPayments: user.totalConsecutiveOnTimePayments || 0,
    },
    afterState: {
      currentLimit: user.currentLimit,
      isTrustworthy: user.isTrustworthy,
      status: user.status || UserStatus.ACTIVE,
      consecutivePayments: user.consecutiveOnTimePayments || 0,
      totalPayments: user.totalConsecutiveOnTimePayments || 0,
    },
    notificationSent: false,
    errors: [],
  };
  
  try {
    // Analyze payment history
    const analysis = await analyzeUserPaymentHistory(user);
    
    // Check for corrections needed
    let needsCorrection = false;
    
    // Correct total consecutive payments
    if ((user.totalConsecutiveOnTimePayments || 0) !== analysis.totalOnTimePayments) {
      user.totalConsecutiveOnTimePayments = analysis.totalOnTimePayments;
      result.correctionsMade.push(`Updated total consecutive payments: ${result.beforeState.totalPayments} → ${analysis.totalOnTimePayments}`);
      needsCorrection = true;
    }
    
    // Correct consecutive payments for tier progression
    if ((user.consecutiveOnTimePayments || 0) !== analysis.consecutiveOnTimePayments) {
      user.consecutiveOnTimePayments = analysis.consecutiveOnTimePayments;
      user.onTimeCount = analysis.consecutiveOnTimePayments; // Legacy compatibility
      result.correctionsMade.push(`Updated consecutive payments: ${result.beforeState.consecutivePayments} → ${analysis.consecutiveOnTimePayments}`);
      needsCorrection = true;
    }
    
    // Correct trustworthy status
    if (user.isTrustworthy !== analysis.shouldBeTrustworthy) {
      user.isTrustworthy = analysis.shouldBeTrustworthy;
      user.trustworthyPath = analysis.correctTrustworthyPath;
      result.correctionsMade.push(`Updated trustworthy status: ${result.beforeState.isTrustworthy} → ${analysis.shouldBeTrustworthy} (${analysis.correctTrustworthyPath || 'none'})`);
      needsCorrection = true;
    }
    
    // Correct Diamond tier access (must have trustworthy status)
    if (user.currentLimit === 1000 && !user.isTrustworthy) {
      // Downgrade to Platinum if not trustworthy
      user.currentLimit = 500;
      result.correctionsMade.push(`Downgraded from Diamond to Platinum: User lacks trustworthy status`);
      needsCorrection = true;
    }
    
    // Update after state
    result.afterState = {
      currentLimit: user.currentLimit,
      isTrustworthy: user.isTrustworthy,
      status: user.status || UserStatus.ACTIVE,
      consecutivePayments: user.consecutiveOnTimePayments || 0,
      totalPayments: user.totalConsecutiveOnTimePayments || 0,
    };
    
    // Save changes if needed
    if (needsCorrection) {
      await user.save();
      
      // Create audit log entry
      await AuditLog.create({
        userId: user._id,
        action: 'DATA_CORRECTION',
        details: {
          type: 'tier_progression_fix',
          version: '2.0.1',
          corrections: result.correctionsMade,
          beforeState: result.beforeState,
          afterState: result.afterState,
          timestamp: new Date(),
        },
        performedBy: 'system',
        ipAddress: 'internal',
      });
      
      // Send notification to user
      try {
        await sendUserCorrectionNotification(user, result);
        result.notificationSent = true;
      } catch (error) {
        result.errors.push(`Failed to send notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
  }
  
  return result;
}

/**
 * Send notification to user about corrections
 */
async function sendUserCorrectionNotification(user: IUser, correction: UserCorrectionResult): Promise<void> {
  const tierName = TIER_NAMES[user.currentLimit];
  const trustworthyStatus = user.isTrustworthy ? 'Trustworthy' : 'Standard';
  
  const emailContent = `
    <h2>WanPaus Account Update</h2>
    <p>Dear ${user.name},</p>
    
    <p>We've updated your account information to ensure accuracy with our latest system improvements (v2.0.1).</p>
    
    <h3>Your Updated Account Status:</h3>
    <ul>
      <li><strong>Tier:</strong> ${tierName} (K${user.currentLimit} limit)</li>
      <li><strong>Status:</strong> ${trustworthyStatus}</li>
      <li><strong>Consecutive Payments:</strong> ${user.totalConsecutiveOnTimePayments || 0}</li>
    </ul>
    
    ${correction.correctionsMade.length > 0 ? `
    <h3>Changes Made:</h3>
    <ul>
      ${correction.correctionsMade.map(change => `<li>${change}</li>`).join('')}
    </ul>
    ` : ''}
    
    <p>These updates ensure your account reflects your actual payment history and tier progression. No action is required on your part.</p>
    
    <p>If you have any questions about these changes, please contact our support team.</p>
    
    <p>Thank you for being a valued WanPaus customer!</p>
    
    <p>Best regards,<br>The WanPaus Team</p>
  `;
  
  await sendEmail({
    to: user.email,
    subject: 'WanPaus Account Update - Tier Progression Correction',
    html: emailContent,
  });
}

/**
 * Main data correction function
 */
export async function fixTierProgressionData(): Promise<CorrectionSummary> {
  const startTime = Date.now();
  
  console.log('🔧 Starting tier progression data correction (v2.0.1)...');
  
  try {
    await connectToDatabase();
    
    // Get all users
    const users = await User.find({});
    console.log(`📊 Found ${users.length} users to analyze`);
    
    const correctionResults: UserCorrectionResult[] = [];
    let usersNeedingCorrection = 0;
    let usersCorrected = 0;
    let correctionsFailed = 0;
    let notificationsSent = 0;
    let notificationsFailed = 0;
    
    // Process users in batches
    const batchSize = 50;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(users.length / batchSize)}`);
      
      for (const user of batch) {
        const result = await correctUserData(user);
        correctionResults.push(result);
        
        if (result.correctionsMade.length > 0) {
          usersNeedingCorrection++;
          
          if (result.errors.length === 0) {
            usersCorrected++;
          } else {
            correctionsFailed++;
          }
          
          if (result.notificationSent) {
            notificationsSent++;
          } else if (result.correctionsMade.length > 0) {
            notificationsFailed++;
          }
        }
      }
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const executionTime = Date.now() - startTime;
    
    const summary: CorrectionSummary = {
      totalUsersScanned: users.length,
      usersNeedingCorrection,
      usersCorrected,
      correctionsFailed,
      notificationsSent,
      notificationsFailed,
      executionTime,
      correctionDetails: correctionResults.filter(r => r.correctionsMade.length > 0),
    };
    
    console.log('✅ Tier progression data correction completed:', {
      totalScanned: summary.totalUsersScanned,
      needingCorrection: summary.usersNeedingCorrection,
      corrected: summary.usersCorrected,
      failed: summary.correctionsFailed,
      executionTimeMs: summary.executionTime,
    });
    
    // Create summary audit log
    await AuditLog.create({
      action: 'DATA_CORRECTION_SUMMARY',
      details: {
        type: 'tier_progression_fix_summary',
        version: '2.0.1',
        summary,
        timestamp: new Date(),
      },
      performedBy: 'system',
      ipAddress: 'internal',
    });
    
    return summary;
    
  } catch (error) {
    console.error('❌ Tier progression data correction failed:', error);
    throw error;
  }
}

/**
 * Rollback data corrections (emergency use only)
 */
export async function rollbackTierProgressionCorrections(): Promise<{
  success: boolean;
  rolledBackUsers: number;
  errors: string[];
}> {
  console.log('🔄 Starting tier progression correction rollback...');
  
  try {
    await connectToDatabase();
    
    // Find all correction audit logs
    const correctionLogs = await AuditLog.find({
      action: 'DATA_CORRECTION',
      'details.type': 'tier_progression_fix',
      'details.version': '2.0.1',
    });
    
    let rolledBackUsers = 0;
    const errors: string[] = [];
    
    for (const log of correctionLogs) {
      try {
        const user = await User.findById(log.userId);
        if (user && log.details.beforeState) {
          // Restore previous state
          user.currentLimit = log.details.beforeState.currentLimit;
          user.isTrustworthy = log.details.beforeState.isTrustworthy;
          user.status = log.details.beforeState.status;
          user.consecutiveOnTimePayments = log.details.beforeState.consecutivePayments;
          user.totalConsecutiveOnTimePayments = log.details.beforeState.totalPayments;
          user.onTimeCount = log.details.beforeState.consecutivePayments;
          
          await user.save();
          rolledBackUsers++;
          
          // Create rollback audit log
          await AuditLog.create({
            userId: user._id,
            action: 'DATA_CORRECTION_ROLLBACK',
            details: {
              type: 'tier_progression_rollback',
              version: '2.0.1',
              restoredState: log.details.beforeState,
              timestamp: new Date(),
            },
            performedBy: 'system',
            ipAddress: 'internal',
          });
        }
      } catch (error) {
        errors.push(`Failed to rollback user ${log.userId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    console.log(`✅ Rollback completed: ${rolledBackUsers} users restored`);
    
    return {
      success: true,
      rolledBackUsers,
      errors,
    };
    
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    return {
      success: false,
      rolledBackUsers: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

// Export for use in migration service
export { UserCorrectionResult, CorrectionSummary };
