import { IUser } from '@/types';
import { TierProgressionResult } from '@/types/services';

/**
 * Handle on-time repayment and check for tier upgrade
 * After 2 consecutive on-time payments, upgrade tier (double limit)
 */
export function handleOnTimeRepayment(user: IUser): TierProgressionResult {
  user.onTimeCount += 1;

  if (user.onTimeCount >= 2 && !user.isTrustworthy) {
    const oldLimit = user.currentLimit;
    const newLimit = Math.min(user.currentLimit * 2, 1000);
    
    if (newLimit > oldLimit) {
      user.currentLimit = newLimit;
      user.onTimeCount = 0; // Reset counter after upgrade
      
      return {
        upgraded: true,
        newLimit,
        message: `Tier upgraded from K${oldLimit} to K${newLimit}!`,
      };
    }
  }

  return {
    upgraded: false,
    message: `${user.onTimeCount} on-time payment(s) recorded. ${2 - user.onTimeCount} more for tier upgrade.`,
  };
}

/**
 * Handle late repayment - reset on-time counter
 */
export function handleLateRepayment(user: IUser): IUser {
  user.onTimeCount = 0;
  return user;
}

/**
 * Handle loan default (14+ days overdue)
 * - Reset tier to K50
 * - Reset on-time counter
 * - Remove trustworthy status
 */
export function handleDefault(user: IUser): IUser {
  user.currentLimit = 50;
  user.onTimeCount = 0;
  user.isTrustworthy = false;
  return user;
}

/**
 * Get the next tier limit
 */
export function getNextTierLimit(currentLimit: number): number | null {
  const tierLimits = [50, 100, 200, 500, 1000];
  const currentIndex = tierLimits.indexOf(currentLimit);
  
  if (currentIndex === -1 || currentIndex === tierLimits.length - 1) {
    return null; // Already at max tier or invalid limit
  }
  
  return tierLimits[currentIndex + 1];
}

/**
 * Calculate progress to next tier (0-100)
 */
export function getTierProgress(onTimeCount: number, isTrustworthy: boolean): number {
  if (isTrustworthy) return 100; // Trustworthy customers are at max
  return Math.min((onTimeCount / 2) * 100, 100);
}

/**
 * Get tier name based on limit
 */
export function getTierName(limit: number): string {
  const tierMap: Record<number, string> = {
    50: 'Bronze (K50)',
    100: 'Silver (K100)',
    200: 'Gold (K200)',
    500: 'Platinum (K500)',
    1000: 'Diamond (K1000)',
  };
  return tierMap[limit] || `K${limit}`;
}

