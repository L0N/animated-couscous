/**
 * Enhanced Tier Service (v2.0.1)
 * 
 * Implements correct tier progression and trustworthy status logic:
 * - Tier Progression: 2 consecutive on-time payments advances to next tier
 * - Trustworthy Status Path 1: 10 consecutive on-time payments on any tier
 * - Trustworthy Status Path 2: Complete progression through all tiers (Bronze→Diamond)
 * - Diamond tier access: Requires trustworthy status achievement
 * - Default handling: Resets both tier progression AND trustworthy building progress
 */

import { IUser, UserStatus, TrustworthyPath, LoanVersion } from '@/types';
import { TierProgressionResult } from '@/types/services';
import { getPNGNow } from '@/lib/timezone';

/**
 * Tier limits and names
 */
export const TIER_LIMITS = [50, 100, 200, 500, 1000] as const;
export const TIER_NAMES: Record<number, string> = {
  50: 'Bronze',
  100: 'Silver', 
  200: 'Gold',
  500: 'Platinum',
  1000: 'Diamond',
};

/**
 * Trustworthy status requirements (v2.0.1 corrected)
 */
export const TRUSTWORTHY_REQUIREMENTS = {
  CONSECUTIVE_PAYMENTS: parseInt(process.env.TRUSTWORTHY_CONSECUTIVE_REQUIRED || '10'),
  COMPLETE_TIER_PROGRESSION: true, // Must reach Diamond tier through progression
} as const;

/**
 * Handle on-time repayment with corrected tier progression and trustworthy logic (v2.0.1)
 */
export function handleOnTimeRepayment(
  user: IUser,
  loanVersion: LoanVersion = LoanVersion.V2
): TierProgressionResult {
  const now = getPNGNow();
  
  // Update consecutive payment counters
  user.consecutiveOnTimePayments = (user.consecutiveOnTimePayments || 0) + 1;
  user.totalConsecutiveOnTimePayments = (user.totalConsecutiveOnTimePayments || 0) + 1;
  
  // Legacy v1.0.0 compatibility
  user.onTimeCount = user.consecutiveOnTimePayments;

  let tierUpgraded = false;
  let trustworthyGranted = false;
  let statusChanged = false;
  const messages: string[] = [];

  // Check for tier progression (after 2 consecutive payments at current tier)
  if (user.consecutiveOnTimePayments >= 2) {
    const currentTierIndex = TIER_LIMITS.indexOf(user.currentLimit);
    const nextTierIndex = currentTierIndex + 1;

    if (nextTierIndex < TIER_LIMITS.length) {
      const nextLimit = TIER_LIMITS[nextTierIndex];
      
      // Diamond tier requires trustworthy status
      if (nextLimit === 1000 && !user.isTrustworthy) {
        messages.push(`💎 Diamond tier requires trustworthy status. Continue making on-time payments!`);
      } else {
        const oldLimit = user.currentLimit;
        user.currentLimit = nextLimit;
        user.consecutiveOnTimePayments = 0; // Reset counter after upgrade
        user.lastTierUpgrade = now;
        tierUpgraded = true;
        
        messages.push(`🚀 Tier upgraded from ${TIER_NAMES[oldLimit]} (K${oldLimit}) to ${TIER_NAMES[nextLimit]} (K${nextLimit})!`);
        
        // Check if user reached Diamond tier through complete progression
        if (nextLimit === 1000) {
          user.isTrustworthy = true;
          user.trustworthyPath = TrustworthyPath.TIER_BASED;
          trustworthyGranted = true;
          messages.push(`🌟 Trustworthy status granted for completing full tier progression!`);
        }
      }
    } else {
      messages.push(`👑 You're at the maximum Diamond tier (K1000)!`);
    }
  }

  // Check for trustworthy status via 10 consecutive payments
  if (!user.isTrustworthy && user.totalConsecutiveOnTimePayments >= TRUSTWORTHY_REQUIREMENTS.CONSECUTIVE_PAYMENTS) {
    user.isTrustworthy = true;
    user.trustworthyPath = TrustworthyPath.EXPERIENCE_BASED;
    trustworthyGranted = true;
    messages.push(`🌟 Trustworthy status granted via 10 consecutive on-time payments!`);
  }

  // Update user status if in rebuilding
  if (user.status === UserStatus.REBUILDING) {
    user.status = UserStatus.ACTIVE;
    statusChanged = true;
    messages.push(`✅ Account status restored to ACTIVE!`);
  }

  // Progress messages
  if (!tierUpgraded && user.currentLimit < 1000) {
    const remaining = 2 - user.consecutiveOnTimePayments;
    const nextTierIndex = TIER_LIMITS.indexOf(user.currentLimit) + 1;
    const nextTierName = nextTierIndex < TIER_LIMITS.length ? TIER_NAMES[TIER_LIMITS[nextTierIndex]] : 'Maximum';
    
    if (remaining > 0) {
      messages.push(`📈 ${remaining} more on-time payment(s) needed for ${nextTierName} tier upgrade`);
    }
  }

  // Trustworthy progress messages
  if (!user.isTrustworthy) {
    const consecutiveRemaining = Math.max(0, TRUSTWORTHY_REQUIREMENTS.CONSECUTIVE_PAYMENTS - user.totalConsecutiveOnTimePayments);
    const tierProgressionPath = user.currentLimit < 1000 ? 'OR complete tier progression to Diamond' : '';
    
    messages.push(`🌟 Trustworthy progress: ${consecutiveRemaining} more consecutive payments ${tierProgressionPath}`);
  }

  return {
    upgraded: tierUpgraded,
    newLimit: user.currentLimit,
    trustworthyGranted,
    statusChanged,
    message: messages.join(' | '),
    consecutivePayments: user.consecutiveOnTimePayments,
    totalPayments: user.totalConsecutiveOnTimePayments,
    trustworthyPath: user.trustworthyPath,
  };
}

/**
 * Handle late repayment - reset consecutive counter but preserve total
 */
export function handleLateRepayment(user: IUser): IUser {
  user.consecutiveOnTimePayments = 0;
  user.onTimeCount = 0; // Legacy v1.0.0 compatibility
  
  // Don't reset total consecutive payments - they're cumulative across loan lifecycle
  return user;
}

/**
 * Handle loan default (14+ days overdue) with credit rebuilding (v2.0.1 corrected)
 */
export function handleDefault(user: IUser): IUser {
  const now = getPNGNow();
  
  // Reset to Bronze tier
  user.currentLimit = 50;
  
  // Reset consecutive counters (both tier progression AND trustworthy building)
  user.consecutiveOnTimePayments = 0;
  user.onTimeCount = 0; // Legacy v1.0.0 compatibility
  
  // Reset total consecutive payments (fresh start after default)
  user.totalConsecutiveOnTimePayments = 0;
  
  // Revoke trustworthy status (must be re-earned)
  user.isTrustworthy = false;
  user.trustworthyPath = undefined;
  
  // Set to rebuilding status
  user.status = UserStatus.REBUILDING;
  user.lastTierUpgrade = now;
  
  return user;
}

/**
 * Get the next tier limit and requirements
 */
export function getNextTierInfo(currentLimit: number): {
  nextLimit: number | null;
  nextTierName: string | null;
  requiresTrustworthy: boolean;
  paymentsNeeded: number;
} {
  const currentIndex = TIER_LIMITS.indexOf(currentLimit);
  
  if (currentIndex === -1 || currentIndex === TIER_LIMITS.length - 1) {
    return {
      nextLimit: null,
      nextTierName: null,
      requiresTrustworthy: false,
      paymentsNeeded: 0,
    };
  }
  
  const nextLimit = TIER_LIMITS[currentIndex + 1];
  const nextTierName = TIER_NAMES[nextLimit];
  const requiresTrustworthy = nextLimit === 1000; // Diamond tier
  
  return {
    nextLimit,
    nextTierName,
    requiresTrustworthy,
    paymentsNeeded: 2,
  };
}

/**
 * Calculate tier progression percentage (0-100)
 */
export function getTierProgress(
  consecutivePayments: number,
  currentLimit: number,
  isTrustworthy: boolean
): number {
  const nextTierInfo = getNextTierInfo(currentLimit);
  
  if (!nextTierInfo.nextLimit) {
    return 100; // At maximum tier
  }
  
  // If next tier requires trustworthy status and user doesn't have it
  if (nextTierInfo.requiresTrustworthy && !isTrustworthy) {
    return 0; // Can't progress without trustworthy status
  }
  
  return Math.min((consecutivePayments / nextTierInfo.paymentsNeeded) * 100, 100);
}

/**
 * Calculate trustworthy progress for both paths (v2.0.1 corrected)
 */
export function getTrustworthyProgress(
  totalPayments: number,
  currentTier: number
): {
  consecutivePaymentsProgress: number;
  tierProgressionProgress: number;
  closestPath: 'consecutive_payments' | 'tier_progression';
  paymentsNeeded: number;
} {
  const consecutivePaymentsProgress = Math.min(
    (totalPayments / TRUSTWORTHY_REQUIREMENTS.CONSECUTIVE_PAYMENTS) * 100,
    100
  );
  
  // Calculate tier progression progress (Bronze=50 to Diamond=1000)
  const tierIndex = TIER_LIMITS.indexOf(currentTier);
  const tierProgressionProgress = tierIndex >= 0 ? ((tierIndex + 1) / TIER_LIMITS.length) * 100 : 0;
  
  const consecutiveRemaining = Math.max(0, TRUSTWORTHY_REQUIREMENTS.CONSECUTIVE_PAYMENTS - totalPayments);
  const tierProgressionRemaining = currentTier < 1000 ? 'Complete tier progression to Diamond' : 0;
  
  const closestPath = consecutiveRemaining <= 2 ? 'consecutive_payments' : 'tier_progression';
  const paymentsNeeded = consecutiveRemaining;
  
  return {
    consecutivePaymentsProgress,
    tierProgressionProgress,
    closestPath,
    paymentsNeeded,
  };
}

/**
 * Get tier name with limit
 */
export function getTierName(limit: number): string {
  const tierName = TIER_NAMES[limit];
  return tierName ? `${tierName} (K${limit})` : `K${limit}`;
}

/**
 * Get full tier information for display
 */
export function getTierInfo(user: IUser): {
  currentTier: string;
  currentLimit: number;
  nextTier: string | null;
  nextLimit: number | null;
  tierProgress: number;
  trustworthyProgress: {
    tierBasedProgress: number;
    experienceBasedProgress: number;
    closestPath: 'tier_based' | 'experience_based';
    paymentsNeeded: number;
  } | null;
  status: UserStatus;
  consecutivePayments: number;
  totalPayments: number;
  canUpgrade: boolean;
} {
  const nextTierInfo = getNextTierInfo(user.currentLimit);
  const tierProgress = getTierProgress(
    user.consecutiveOnTimePayments || 0,
    user.currentLimit,
    user.isTrustworthy
  );
  
  const trustworthyProgress = user.isTrustworthy 
    ? null 
    : getTrustworthyProgress(
        user.totalConsecutiveOnTimePayments || 0,
        user.currentLimit
      );
  
  const canUpgrade = nextTierInfo.nextLimit !== null && 
    (!nextTierInfo.requiresTrustworthy || user.isTrustworthy) &&
    (user.consecutiveOnTimePayments || 0) >= 2;
  
  return {
    currentTier: getTierName(user.currentLimit),
    currentLimit: user.currentLimit,
    nextTier: nextTierInfo.nextTierName ? getTierName(nextTierInfo.nextLimit!) : null,
    nextLimit: nextTierInfo.nextLimit,
    tierProgress,
    trustworthyProgress,
    status: user.status || UserStatus.ACTIVE,
    consecutivePayments: user.consecutiveOnTimePayments || 0,
    totalPayments: user.totalConsecutiveOnTimePayments || 0,
    canUpgrade,
  };
}

/**
 * Check if user can apply for a specific amount
 */
export function canApplyForAmount(
  user: IUser,
  amount: number
): {
  canApply: boolean;
  reason?: string;
  suggestedAmount?: number;
} {
  if (user.status === UserStatus.REBUILDING) {
    return {
      canApply: false,
      reason: 'Account is in rebuilding status. Make on-time payments to restore access.',
    };
  }
  
  if (amount <= 0) {
    return {
      canApply: false,
      reason: 'Loan amount must be positive.',
    };
  }
  
  if (amount > user.currentLimit) {
    return {
      canApply: false,
      reason: `Amount exceeds your current limit of K${user.currentLimit}.`,
      suggestedAmount: user.currentLimit,
    };
  }
  
  return { canApply: true };
}

/**
 * Check loan eligibility for customer API
 */
export async function checkEligibility(user: IUser, amount: number): Promise<{
  eligible: boolean;
  reason?: string;
  details?: any;
}> {
  // Check if amount exceeds current limit
  if (amount > user.currentLimit) {
    return {
      eligible: false,
      reason: 'Amount exceeds credit limit',
      details: {
        requestedAmount: amount,
        currentLimit: user.currentLimit,
        maxAllowed: user.currentLimit
      }
    };
  }

  // Check minimum amount
  if (amount < 10) {
    return {
      eligible: false,
      reason: 'Amount below minimum',
      details: {
        requestedAmount: amount,
        minimumAmount: 10
      }
    };
  }

  // Check if user is in rebuilding status
  if (user.status === UserStatus.REBUILDING) {
    // Rebuilding users can only access Bronze tier (K50)
    if (amount > 50) {
      return {
        eligible: false,
        reason: 'Account in rebuilding status',
        details: {
          status: user.status,
          maxAllowedInRebuilding: 50,
          guidance: 'Make on-time payments to restore full access'
        }
      };
    }
  }

  return { eligible: true };
}

/**
 * Get credit rebuilding status and guidance
 */
export function getCreditRebuildingInfo(user: IUser): {
  isRebuilding: boolean;
  guidance: string[];
  nextMilestone: string;
  paymentsToRestore: number;
} {
  const isRebuilding = user.status === UserStatus.REBUILDING;
  const guidance: string[] = [];
  
  if (isRebuilding) {
    guidance.push('Your account is in rebuilding status after a loan default.');
    guidance.push('Make on-time payments to restore your account and rebuild your credit.');
    guidance.push('You can still apply for loans within your current Bronze (K50) limit.');
  }
  
  const consecutivePayments = user.consecutiveOnTimePayments || 0;
  const paymentsToRestore = Math.max(0, 2 - consecutivePayments);
  
  let nextMilestone = '';
  if (isRebuilding) {
    if (paymentsToRestore > 0) {
      nextMilestone = `${paymentsToRestore} more on-time payment(s) to restore ACTIVE status`;
    } else {
      nextMilestone = 'Ready for status restoration on next payment';
    }
  } else {
    nextMilestone = 'Account in good standing';
  }
  
  return {
    isRebuilding,
    guidance,
    nextMilestone,
    paymentsToRestore,
  };
}
