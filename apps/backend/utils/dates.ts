/**
 * Date utilities for backend
 * Centralized date formatting and manipulation
 */

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Format a Date object to YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Get date N days ago in YYYY-MM-DD format
 */
export function getDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDate(date);
}

/**
 * Get date N days from now in YYYY-MM-DD format
 */
export function getDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

/**
 * Parse YYYY-MM-DD string to Date object
 */
export function parseDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00Z");
}

/**
 * Get yesterday's date in YYYY-MM-DD format
 */
export function getYesterdayDate(): string {
  return getDaysAgo(1);
}

/**
 * Calculate days between two dates
 */
export function daysBetween(startDate: string, endDate: string): number {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000);
}
