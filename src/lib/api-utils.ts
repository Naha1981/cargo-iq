import type { NextRequest } from "next/server";
import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// South African port → country code mapping
// ---------------------------------------------------------------------------

const PORT_COUNTRY_MAP: Record<string, string> = {
  ZADUR: "ZA", // Durban
  ZACPT: "ZA", // Cape Town
  ZAJNB: "ZA", // Johannesburg (dry port)
  ZAPRI: "ZA", // Port Elizabeth / Gqeberha
  ZAELN: "ZA", // East London
  ZARBY: "ZA", // Richards Bay
  ZASDB: "ZA", // Saldanha Bay
};

// ---------------------------------------------------------------------------
// Approximate exchange rates to ZAR (as of early 2025 — for estimation only)
// ---------------------------------------------------------------------------

const EXCHANGE_RATES_TO_ZAR: Record<string, number> = {
  ZAR: 1,
  USD: 18.5,
  EUR: 20.0,
  GBP: 23.5,
  CNY: 2.55,
  JPY: 0.12,
  AUD: 12.0,
  INR: 0.22,
  AED: 5.04,
};

// ---------------------------------------------------------------------------
// getOrgIdFromRequest
// ---------------------------------------------------------------------------

/**
 * Resolve organisation ID from a request.
 *
 * Priority:
 * 1. X-Org-Id header (set by middleware)
 * 2. orgId query parameter
 * 3. First organisation in the database
 */
export async function getOrgIdFromRequest(request: NextRequest): Promise<string> {
  // 1. Header
  const headerOrgId = request.headers.get("x-org-id");
  if (headerOrgId) return headerOrgId;

  // 2. Query param
  const queryOrgId = request.nextUrl.searchParams.get("orgId");
  if (queryOrgId) return queryOrgId;

  // 3. First org in DB
  const firstOrg = await db.organisation.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (firstOrg) return firstOrg.id;

  // Fallback
  return "dev-org";
}

// ---------------------------------------------------------------------------
// getUserIdFromRequest
// ---------------------------------------------------------------------------

/**
 * Resolve user ID from a request.
 *
 * Priority:
 * 1. X-User-Id header (set by middleware)
 * 2. userId query parameter
 * 3. First user in the database for the resolved org
 */
export async function getUserIdFromRequest(
  request: NextRequest,
  orgId?: string
): Promise<string> {
  // 1. Header
  const headerUserId = request.headers.get("x-user-id");
  if (headerUserId) return headerUserId;

  // 2. Query param
  const queryUserId = request.nextUrl.searchParams.get("userId");
  if (queryUserId) return queryUserId;

  // 3. First user in DB for this org
  const resolvedOrgId = orgId ?? (await getOrgIdFromRequest(request));

  const firstUser = await db.user.findFirst({
    where: { orgId: resolvedOrgId },
    orderBy: { createdAt: "asc" },
  });

  if (firstUser) return firstUser.id;

  // Fallback
  return "dev-user";
}

// ---------------------------------------------------------------------------
// portToCountryCode
// ---------------------------------------------------------------------------

/**
 * Map a UN/LOCODE port code to a 2-letter ISO country code.
 *
 * Uses built-in SA port mapping first, then falls back to extracting the
 * first 2 characters of the port code (UN/LOCODE convention).
 */
export function portToCountryCode(port: string | null | undefined): string {
  if (!port) return "UNKNOWN";

  const upper = port.toUpperCase().trim();

  // Known SA ports
  if (PORT_COUNTRY_MAP[upper]) return PORT_COUNTRY_MAP[upper];

  // UN/LOCODE convention: first 2 chars = country code
  if (upper.length >= 2) return upper.slice(0, 2);

  return "UNKNOWN";
}

// ---------------------------------------------------------------------------
// estimateZarValue
// ---------------------------------------------------------------------------

/**
 * Estimate the ZAR equivalent of a value in a given currency.
 *
 * Uses approximate exchange rates — NOT for financial reporting.
 */
export function estimateZarValue(
  value: number | null | undefined,
  currency: string | null | undefined
): number | null {
  if (value == null || value === 0) return value;

  const upper = (currency ?? "USD").toUpperCase().trim();
  const rate = EXCHANGE_RATES_TO_ZAR[upper];

  if (!rate) {
    // Fallback: assume USD
    return Math.round(value * EXCHANGE_RATES_TO_ZAR.USD * 100) / 100;
  }

  return Math.round(value * rate * 100) / 100;
}

// ---------------------------------------------------------------------------
// safeJsonParse
// ---------------------------------------------------------------------------

/**
 * Safely parse a JSON string, returning a fallback value on failure.
 */
export function safeJsonParse<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;

  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}
