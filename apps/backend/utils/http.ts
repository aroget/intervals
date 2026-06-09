/**
 * HTTP utilities for Hono API routes
 * Centralized request/response helpers
 */

import type { Context } from "hono";

/**
 * Extract athleteId from route params
 */
export function getAthleteId(c: Context): string {
  return c.req.param("athleteId");
}

/**
 * Parse query parameter as integer with default
 */
export function getQueryInt(
  c: Context,
  param: string,
  defaultValue: number,
): number {
  const value = c.req.query(param);
  return value ? parseInt(value, 10) : defaultValue;
}

/**
 * Parse query parameter as string with default
 */
export function getQueryString(
  c: Context,
  param: string,
  defaultValue: string,
): string {
  return c.req.query(param) ?? defaultValue;
}

/**
 * Standard success response
 */
export function successResponse(data: any, status = 200) {
  return Response.json(data, { status });
}

/**
 * Standard error response
 */
export function errorResponse(message: string, status = 500) {
  return Response.json({ error: message }, { status });
}

/**
 * Try-catch wrapper for async route handlers
 */
export async function handleAsync<T>(
  handler: () => Promise<T>,
): Promise<{ data?: T; error?: string }> {
  try {
    const data = await handler();
    return { data };
  } catch (err) {
    return { error: String(err) };
  }
}
