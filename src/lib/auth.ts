/**
 * CargoIQ — JWT Authentication + Tenant Isolation Module
 *
 * Uses the 'jose' library for JWT verification (Edge-compatible, no node:crypto dependency).
 * Supports Next.js Edge Runtime and API routes.
 *
 * - verifyAuthToken(token): Verifies JWT and returns decoded payload
 * - extractBearerToken(authHeader): Extracts Bearer token from Authorization header
 * - getAuthFromRequest(request): Full auth extraction from NextRequest
 * - requireAuth(request): Throws/returns error if no valid token
 * - addOrgFilter(where, orgId): Tenant isolation helper for Prisma queries
 */

import { jwtVerify, SignJWT } from 'jose';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// JWT payload type
export interface AuthPayload {
  orgId: string;
  userId: string;
  email: string;
}

// Resolve JWT secret key as Uint8Array for jose
function resolveJwtSecret(): Uint8Array | null {
  const envSecret = process.env.JWT_SECRET_KEY;

  if (envSecret) {
    // Use the raw string as UTF-8 bytes (jose expects Uint8Array)
    return new TextEncoder().encode(envSecret);
  }

  // No JWT secret — development/sandbox mode
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      '[auth] JWT_SECRET_KEY not set. JWT authentication is disabled (development/sandbox mode).'
    );
  } else {
    console.error(
      '[auth] CRITICAL: JWT_SECRET_KEY not set in production! Authentication is disabled!'
    );
  }

  return null;
}

/**
 * Verify a JWT token and return the decoded payload.
 * Returns null if the token is invalid, expired, or JWT_SECRET_KEY is not configured.
 */
export async function verifyAuthToken(
  token: string
): Promise<AuthPayload | null> {
  const secret = resolveJwtSecret();
  if (!secret) {
    // No secret configured — skip auth in development
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, secret);

    // Validate required fields
    if (
      typeof payload.orgId === 'string' &&
      typeof payload.userId === 'string' &&
      typeof payload.email === 'string'
    ) {
      return {
        orgId: payload.orgId,
        userId: payload.userId,
        email: payload.email,
      };
    }

    console.warn('[auth] JWT payload missing required fields (orgId, userId, email)');
    return null;
  } catch (error) {
    // JWT expired, invalid signature, malformed, etc.
    if (error instanceof Error) {
      // Don't log expected errors like expiration at warning level
      if (!error.message.includes('exp') && !error.message.includes('expired')) {
        console.warn('[auth] JWT verification failed:', error.message);
      }
    }
    return null;
  }
}

/**
 * Extract the Bearer token from an Authorization header string.
 * Returns null if the header is missing or not a Bearer token.
 */
export function extractBearerToken(
  authHeader: string | null
): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    return parts[1];
  }

  return null;
}

/**
 * Extract and verify JWT from a NextRequest.
 * Returns the decoded AuthPayload, or null if no valid token is found.
 */
export async function getAuthFromRequest(
  request: NextRequest
): Promise<AuthPayload | null> {
  const authHeader = request.headers.get('authorization');
  const token = extractBearerToken(authHeader);

  if (!token) return null;

  return verifyAuthToken(token);
}

/**
 * Require authentication for an API route.
 * Returns the AuthPayload if valid, or a NextResponse error if not authenticated.
 *
 * Usage in API routes:
 * ```typescript
 * const auth = await requireAuth(request);
 * if (auth instanceof NextResponse) return auth; // Return 401 error
 * // auth is now typed as AuthPayload
 * ```
 */
export async function requireAuth(
  request: NextRequest
): Promise<AuthPayload | NextResponse> {
  const secret = resolveJwtSecret();

  // If no JWT secret configured, allow in development/sandbox mode
  if (!secret) {
    if (process.env.NODE_ENV !== 'production') {
      // Development mode — return a default payload
      return {
        orgId: 'dev-org',
        userId: 'dev-user',
        email: 'dev@cargoiq.co.za',
      };
    }
    // In production without a secret, block access
    return NextResponse.json(
      { error: 'unauthorized', message: 'Authentication is not configured' },
      { status: 503 }
    );
  }

  const auth = await getAuthFromRequest(request);

  if (!auth) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Missing Authorization header' },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: 'unauthorized', message: 'Invalid or expired token' },
      { status: 401 }
    );
  }

  return auth;
}

/**
 * Add orgId to a Prisma where clause for tenant isolation.
 * Ensures all database queries are scoped to the authenticated organisation.
 *
 * @param where - Existing Prisma where clause
 * @param orgId - Organisation ID from JWT payload
 * @returns Where clause with orgId filter added
 */
export function addOrgFilter(
  where: Record<string, unknown>,
  orgId: string
): Record<string, unknown> {
  return {
    ...where,
    orgId,
  };
}

/**
 * Generate a JWT token (utility for testing or login endpoints).
 * Not used in middleware — only for creating tokens.
 */
export async function generateAuthToken(
  payload: AuthPayload,
  expiresIn: string = '24h'
): Promise<string> {
  const secret = resolveJwtSecret();
  if (!secret) {
    throw new Error('[auth] Cannot generate token: JWT_SECRET_KEY not set');
  }

  return new SignJWT({
    orgId: payload.orgId,
    userId: payload.userId,
    email: payload.email,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}
