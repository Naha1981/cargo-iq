// CargoIQ — Shared API Utilities
// Extracted from duplicated definitions across API route files

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
