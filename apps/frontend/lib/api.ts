/**
 * API configuration and utilities
 * Shared across the frontend application
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7000";
export const ATHLETE_ID = process.env.NEXT_PUBLIC_ATHLETE_ID ?? "";

/**
 * SWR fetcher function
 */
export const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Build API endpoint URL
 */
export function apiUrl(path: string): string {
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
