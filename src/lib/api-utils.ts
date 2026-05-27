// CargoIQ — Shared API Utilities
// Extracted from duplicated definitions across API route files

import { NextRequest } from "next/server";

/**
 * Extract country code from a port code (first 2 characters).
 * e.g. "ZADUR" → "ZA", "GBFXT" → "GB"
 */
export function portToCountryCode(port: string | null): string {
  if (!port) return "";
  return port.substring(0, 2).toUpperCase();
}

/**
 * Estimate ZAR value from a foreign currency amount.
 * Uses approximate exchange rates (should be replaced with live rates in production).
 */
export function estimateZarValue(valueUsd: number | null, currency: string | null): number {
  if (!valueUsd) return 0;
  const rate = currency === "GBP" ? 23.5 : currency === "EUR" ? 20.0 : 18.5;
  return Math.round(valueUsd * rate * 100) / 100;
}

/**
 * Safely parse a JSON string, returning a fallback value on failure.
 */
export function safeJsonParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Get the org ID from the request headers (set by auth middleware)
 * Falls back to the first org in the DB for sandbox/dev mode
 */
export async function getOrgIdFromRequest(request: NextRequest): Promise<string> {
  const orgId = request.headers.get('x-org-id');
  if (orgId) return orgId;
  // Sandbox fallback: use first org
  const { db } = await import('@/lib/db');
  const org = await db.organisation.findFirst();
  return org?.id || 'sandbox';
}

/**
 * Sanitize error message for production - don't leak internals
 */
export function sanitizeError(error: unknown): string {
  if (process.env.NODE_ENV === 'production') {
    return 'An internal error occurred';
  }
  return error instanceof Error ? error.message : 'Unknown error';
}
