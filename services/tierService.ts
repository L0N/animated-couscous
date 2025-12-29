/**
 * Enhanced Tier Service (v2.0.0)
 * 
 * Implements dual trustworthy paths and credit rebuilding:
 * - Path 1 (Tier-Based): 2 consecutive on-time payments at current tier
 * - Path 2 (Experience-Based): 10 total consecutive on-time payments across all loans
 * - Credit rebuilding with REBUILDING status after default
 * - Enhanced tier progression with Diamond tier requiring trustworthy status
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
 * Trustworthy path requirements
 */
export const TRUSTWORTHY_REQUIREMENTS = {
  TIER_BASED_CONSECUTIVE: parseInt(process.env.TRUSTWORTHY_CONSECUTIVE_REQUIRED || '2'),
  EXPERIENCE_BASED_TOTAL: parseInt(process.env.TRUSTWORTHY_TOTAL_ALTERNATIVE || '10'),
} as const;

/**
 * Handle on-time repayment with dual trustworthy paths and tier progression
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

  // Check for trustworthy status (both paths)
  if (!user.isTrustworthy) {
    const tierBasedEligible = user.consecutiveOnTimePayments >= TRUSTWORTHY_REQUIREMENTS.TIER_BASED_CONSECUTIVE;
    const experienceBasedEligible = user.totalConsecutiveOnTimePayments >= TRUSTWORTHY_REQUIREMENTS.EXPERIENCE_BASED_TOTAL;

    if (tierBasedEligible || experienceBasedEligible) {
      user.isTrustworthy = true;
      user.trustworthyPath = tierBasedEligible ? TrustworthyPath.TIER_BASED : TrustworthyPath.EXPERIENCE_BASED;
      trustworthyGranted = true;
      messages.push(`🌟 Trustworthy status granted via ${user.trustworthyPath.toLowerCase().replace('_', '-')} path!`);
    }
  }

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
      }
    } else {
      messages.push(`👑 You're at the maximum Diamond tier (K1000)!`);
    }
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
    const tierBasedRemaining = Math.max(0, TRUSTWORTHY_REQUIREMENTS.TIER_BASED_CONSECUTIVE - user.consecutiveOnTimePayments);
    const experienceBasedRemaining = Math.max(0, TRUSTWORTHY_REQUIREMENTS.EXPERIENCE_BASED_TOTAL - user.totalConsecutiveOnTimePayments);
    
    messages.push(`🌟 Trustworthy progress: ${tierBasedRemaining} more consecutive OR ${experienceBasedRemaining} more total payments`);
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
 * Handle loan default (14+ days overdue) with credit rebuilding
 */
export function handleDefault(user: IUser): IUser {
  const now = getPNGNow();
  
  // Reset to Bronze tier
  user.currentLimit = 50;
  
  // Reset consecutive counters
  user.consecutiveOnTimePayments = 0;
  user.onTimeCount = 0; // Legacy v1.0.0 compatibility
  
  // Reset total consecutive payments (fresh start after default)
  user.totalConsecutiveOnTimePayments = 0;
  
  // Revoke trustworthy status
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
 * Calculate trustworthy progress for both paths
 */
export function getTrustworthyProgress(
  consecutivePayments: number,
  totalPayments: number
): {
  tierBasedProgress: number;
  experienceBasedProgress: number;
  closestPath: 'tier_based' | 'experience_based';
  paymentsNeeded: number;
} {
  const tierBasedProgress = Math.min(
    (consecutivePayments / TRUSTWORTHY_REQUIREMENTS.TIER_BASED_CONSECUTIVE) * 100,
    100
  );
  
  const experienceBasedProgress = Math.min(
    (totalPayments / TRUSTWORTHY_REQUIREMENTS.EXPERIENCE_BASED_TOTAL) * 100,
    100
  );
  
  const tierBasedRemaining = Math.max(0, TRUSTWORTHY_REQUIREMENTS.TIER_BASED_CONSECUTIVE - consecutivePayments);
  const experienceBasedRemaining = Math.max(0, TRUSTWORTHY_REQUIREMENTS.EXPERIENCE_BASED_TOTAL - totalPayments);
  
  const closestPath = tierBasedRemaining <= experienceBasedRemaining ? 'tier_based' : 'experience_based';
  const paymentsNeeded = closestPath === 'tier_based' ? tierBasedRemaining : experienceBasedRemaining;
  
  return {
    tierBasedProgress,
    experienceBasedProgress,
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
        user.consecutiveOnTimePayments || 0,
        user.totalConsecutiveOnTimePayments || 0
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

