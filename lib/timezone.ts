/**
 * Timezone utilities for Papua New Guinea operations
 * Handles all date/time operations in PNG timezone (UTC+10)
 */

/**
 * Get current date/time in Papua New Guinea timezone
 */
export function getPNGNow(): Date {
  const timezone = process.env.PNG_TIMEZONE || 'Pacific/Port_Moresby';
  
  // Create date in PNG timezone
  const now = new Date();
  const pngTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  
  return pngTime;
}

/**
 * Convert any date to PNG timezone
 */
export function toPNGTime(date: Date): Date {
  const timezone = process.env.PNG_TIMEZONE || 'Pacific/Port_Moresby';
  const pngTime = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  return pngTime;
}

/**
 * Get start of day in PNG timezone
 */
export function getPNGStartOfDay(date?: Date): Date {
  const targetDate = date || getPNGNow();
  const pngDate = toPNGTime(targetDate);
  
  // Set to start of day (00:00:00.000)
  pngDate.setHours(0, 0, 0, 0);
  
  return pngDate;
}

/**
 * Get end of day in PNG timezone
 */
export function getPNGEndOfDay(date?: Date): Date {
  const targetDate = date || getPNGNow();
  const pngDate = toPNGTime(targetDate);
  
  // Set to end of day (23:59:59.999)
  pngDate.setHours(23, 59, 59, 999);
  
  return pngDate;
}

/**
 * Calculate days between two dates in PNG timezone
 * Returns positive number if endDate is after startDate
 */
export function getDaysBetween(startDate: Date, endDate: Date): number {
  const start = getPNGStartOfDay(startDate);
  const end = getPNGStartOfDay(endDate);
  
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Add days to a date in PNG timezone
 */
export function addDays(date: Date, days: number): Date {
  const pngDate = toPNGTime(date);
  pngDate.setDate(pngDate.getDate() + days);
  return pngDate;
}

/**
 * Check if a date is today in PNG timezone
 */
export function isPNGToday(date: Date): boolean {
  const today = getPNGStartOfDay();
  const checkDate = getPNGStartOfDay(date);
  
  return today.getTime() === checkDate.getTime();
}

/**
 * Check if a date is in the past in PNG timezone
 */
export function isPNGPast(date: Date): boolean {
  const now = getPNGNow();
  const checkDate = toPNGTime(date);
  
  return checkDate.getTime() < now.getTime();
}

/**
 * Format date for PNG timezone display
 */
export function formatPNGDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
  const timezone = process.env.PNG_TIMEZONE || 'Pacific/Port_Moresby';
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };
  
  const formatOptions = { ...defaultOptions, ...options };
  
  return date.toLocaleString('en-US', formatOptions);
}

/**
 * Get PNG timezone offset in hours
 */
export function getPNGTimezoneOffset(): number {
  const timezone = process.env.PNG_TIMEZONE || 'Pacific/Port_Moresby';
  const now = new Date();
  
  // Get offset in minutes, convert to hours
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const pngTime = new Date(utcTime + (10 * 3600000)); // PNG is UTC+10
  
  return 10; // PNG is always UTC+10
}

/**
 * Validate that a date calculation is timezone-consistent
 * Used for audit trail verification
 */
export function validateTimezoneConsistency(
  inputDate: Date,
  calculatedDate: Date,
  expectedDaysDiff: number
): boolean {
  const actualDaysDiff = getDaysBetween(inputDate, calculatedDate);
  return actualDaysDiff === expectedDaysDiff;
}

/**
 * Create a PNG timezone-aware date from components
 */
export function createPNGDate(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number = 0,
  minute: number = 0,
  second: number = 0
): Date {
  // Create date in PNG timezone
  const timezone = process.env.PNG_TIMEZONE || 'Pacific/Port_Moresby';
  
  // Month is 0-indexed in Date constructor
  const date = new Date(year, month - 1, day, hour, minute, second);
  
  // Convert to PNG timezone
  return toPNGTime(date);
}

/**
 * Get the current PNG date as ISO string for database storage
 */
export function getPNGISOString(): string {
  return getPNGNow().toISOString();
}

/**
 * Parse ISO string and convert to PNG timezone
 */
export function parsePNGDate(isoString: string): Date {
  const date = new Date(isoString);
  return toPNGTime(date);
}

