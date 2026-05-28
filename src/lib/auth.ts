import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify, SignJWT } from "jose";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthPayload {
  orgId: string;
  userId: string;
  email: string;
}

// ---------------------------------------------------------------------------
// Dev-mode defaults
// ---------------------------------------------------------------------------

const DEV_PAYLOAD: AuthPayload = {
  orgId: "dev-org",
  userId: "dev-user",
  email: "dev@cargoiq.co.za",
};

function getJwtSecret(): Uint8Array | null {
  const secret = process.env.JWT_SECRET_KEY;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

function isDevMode(): boolean {
  return !process.env.JWT_SECRET_KEY;
}

// ---------------------------------------------------------------------------
// verifyAuthToken
// ---------------------------------------------------------------------------

/**
 * Verify a JWT token and return the AuthPayload, or null if invalid.
 */
export async function verifyAuthToken(token: string): Promise<AuthPayload | null> {
  const secret = getJwtSecret();
  if (!secret) {
    console.warn("[auth] JWT_SECRET_KEY not set — returning dev payload");
    return DEV_PAYLOAD;
  }

  try {
    const { payload } = await jwtVerify(token, secret);

    if (
      typeof payload.orgId === "string" &&
      typeof payload.userId === "string" &&
      typeof payload.email === "string"
    ) {
      return {
        orgId: payload.orgId,
        userId: payload.userId,
        email: payload.email,
      };
    }

    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// extractBearerToken
// ---------------------------------------------------------------------------

/**
 * Extract a Bearer token from an Authorization header string.
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  if (authHeader.startsWith("Bearer ")) return authHeader.slice(7);
  return null;
}

// ---------------------------------------------------------------------------
// getAuthFromRequest
// ---------------------------------------------------------------------------

/**
 * Full auth extraction from a NextRequest.
 *
 * Priority:
 * 1. Authorization Bearer token
 * 2. X-Org-Id / X-User-Id headers (set by middleware)
 * 3. Dev defaults
 */
export async function getAuthFromRequest(
  request: NextRequest
): Promise<AuthPayload> {
  // 1. Bearer token
  const token = extractBearerToken(request.headers.get("authorization"));
  if (token) {
    const payload = await verifyAuthToken(token);
    if (payload) return payload;
  }

  // 2. Middleware-injected headers
  const orgId = request.headers.get("x-org-id");
  const userId = request.headers.get("x-user-id");
  if (orgId && userId) {
    return {
      orgId,
      userId,
      email: request.headers.get("x-user-email") ?? "unknown",
    };
  }

  // 3. Dev defaults
  if (isDevMode()) {
    return DEV_PAYLOAD;
  }

  return DEV_PAYLOAD;
}

// ---------------------------------------------------------------------------
// requireAuth
// ---------------------------------------------------------------------------

/**
 * Returns AuthPayload or a 401 NextResponse.
 *
 * Use in API routes:
 * ```ts
 * const auth = await requireAuth(request);
 * if (auth instanceof NextResponse) return auth; // 401
 * // auth is now AuthPayload
 * ```
 */
export async function requireAuth(
  request: NextRequest
): Promise<AuthPayload | NextResponse> {
  // Dev mode — always allow
  if (isDevMode()) {
    return DEV_PAYLOAD;
  }

  // Try Bearer token
  const token = extractBearerToken(request.headers.get("authorization"));
  if (token) {
    const payload = await verifyAuthToken(token);
    if (payload) return payload;
  }

  // Try middleware headers
  const orgId = request.headers.get("x-org-id");
  const userId = request.headers.get("x-user-id");
  if (orgId && userId) {
    return {
      orgId,
      userId,
      email: request.headers.get("x-user-email") ?? "unknown",
    };
  }

  // Unauthorised
  return NextResponse.json(
    { error: "unauthorized", message: "Authentication required." },
    { status: 401 }
  );
}

// ---------------------------------------------------------------------------
// addOrgFilter — Tenant isolation helper
// ---------------------------------------------------------------------------

/**
 * Add orgId filter to a Prisma `where` clause for tenant isolation.
 *
 * ```ts
 * const shipments = await db.shipment.findMany({
 *   where: addOrgFilter({ status: "pending" }, auth.orgId),
 * });
 * ```
 */
export function addOrgFilter<T extends Record<string, unknown>>(
  where: T,
  orgId: string
): T & { orgId: string } {
  return { ...where, orgId };
}

// ---------------------------------------------------------------------------
// getTenantContext
// ---------------------------------------------------------------------------

/**
 * Read tenant context from:
 * 1. X-Org-Id / X-User-Id headers (set by middleware after JWT verify)
 * 2. Query params (orgId, userId)
 * 3. Dev defaults
 */
export function getTenantContext(request: NextRequest): AuthPayload {
  // 1. Middleware headers
  const orgId =
    request.headers.get("x-org-id") ||
    request.nextUrl.searchParams.get("orgId");
  const userId =
    request.headers.get("x-user-id") ||
    request.nextUrl.searchParams.get("userId");
  const email =
    request.headers.get("x-user-email") ||
    request.nextUrl.searchParams.get("userEmail");

  if (orgId && userId) {
    return { orgId, userId, email: email ?? "unknown" };
  }

  // 2. Dev defaults
  return DEV_PAYLOAD;
}

// ---------------------------------------------------------------------------
// generateAuthToken
// ---------------------------------------------------------------------------

/**
 * Generate a signed JWT for the given AuthPayload.
 *
 * Primarily for testing/utility — in production, tokens are issued by an
 * identity provider.
 */
export async function generateAuthToken(
  payload: AuthPayload,
  expiresIn: string = "8h"
): Promise<string> {
  const secret = getJwtSecret();
  if (!secret) {
    throw new Error("JWT_SECRET_KEY is not configured — cannot sign tokens");
  }

  const token = await new SignJWT({
    orgId: payload.orgId,
    userId: payload.userId,
    email: payload.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("cargoiq")
    .setAudience("cargoiq-api")
    .setExpirationTime(expiresIn)
    .sign(secret);

  return token;
}
