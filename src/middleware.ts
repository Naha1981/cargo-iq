/**
 * CargoIQ — Hardened Production Middleware
 *
 * Comprehensive middleware implementing:
 * 1. CORS — Restricted to specific origins from CORS_ALLOWED_ORIGINS env var
 *    - Defaults to localhost:3000 only if not set (NOT '*')
 *    - Proper preflight handling
 *    - Block /api/seed in production
 * 2. Rate Limiting — Sliding window on all /api/ routes
 *    - Returns 429 with Retry-After header if exceeded
 * 3. Security Headers — Applied to ALL responses
 *    - X-Frame-Options: DENY
 *    - X-Content-Type-Options: nosniff
 *    - X-XSS-Protection: 1; mode=block
 *    - Referrer-Policy: strict-origin-when-cross-origin
 * 4. JWT Auth Enforcement — On non-public /api/ routes
 *    - Public routes: /api/health, /api/public/*, OPTIONS
 *    - If JWT_SECRET_KEY not set: skip auth with warning (dev/sandbox mode)
 *    - Invalid/missing token on protected routes: return 401
 *    - Adds X-Org-Id and X-User-Id headers for downstream API routes
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ── CORS Configuration ──────────────────────────────────────────────────────

const DEFAULT_ALLOWED_ORIGINS = 'http://localhost:3000';

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOriginsEnv = process.env.CORS_ALLOWED_ORIGINS;
  const allowedOrigins = allowedOriginsEnv
    ? allowedOriginsEnv.split(',').map((o) => o.trim())
    : [DEFAULT_ALLOWED_ORIGINS];

  const allowedOrigin =
    origin && allowedOrigins.includes(origin)
      ? origin
      : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Org-Id, X-User-Id, XTransformPort',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// ── Security Headers ────────────────────────────────────────────────────────

const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

// ── Public Routes (no auth required) ────────────────────────────────────────

const PUBLIC_API_ROUTES = ['/api/health', '/api/public'];

function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );
}

// ── In-Memory Rate Limiter (inlined for Edge Runtime compatibility) ─────────

const rateLimitStore = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;

// Cleanup interval — remove expired entries every 60 seconds
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitStore.entries()) {
    const filtered = timestamps.filter((ts) => ts > now - RATE_LIMIT_WINDOW_MS);
    if (filtered.length === 0) {
      rateLimitStore.delete(ip);
    } else {
      rateLimitStore.set(ip, filtered);
    }
  }
}, 60_000);
if (cleanupTimer.unref) cleanupTimer.unref();

function checkRateLimit(ip: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  let timestamps = rateLimitStore.get(ip) ?? [];
  timestamps = timestamps.filter((ts) => ts > windowStart);

  const currentCount = timestamps.length;
  const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - currentCount);

  if (currentCount >= RATE_LIMIT_MAX_REQUESTS) {
    const oldestInWindow = timestamps[0] ?? now;
    const resetAt = oldestInWindow + RATE_LIMIT_WINDOW_MS;
    rateLimitStore.set(ip, timestamps);
    return { allowed: false, remaining: 0, resetAt };
  }

  timestamps.push(now);
  rateLimitStore.set(ip, timestamps);

  const oldestInWindow = timestamps[0] ?? now;
  const resetAt = oldestInWindow + RATE_LIMIT_WINDOW_MS;

  return { allowed: true, remaining: remaining - 1, resetAt };
}

// ── JWT Auth (inlined using jose for Edge Runtime compatibility) ─────────────

let jwtSecretWarningLogged = false;

// Lazy import jose to handle potential Edge Runtime issues
let joseModule: typeof import('jose') | null = null;

async function getJose() {
  if (!joseModule) {
    joseModule = await import('jose');
  }
  return joseModule;
}

async function verifyJwtToken(
  token: string
): Promise<{ orgId: string; userId: string; email: string } | null> {
  const jwtSecret = process.env.JWT_SECRET_KEY;
  if (!jwtSecret) return null;

  try {
    const jose = await getJose();
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jose.jwtVerify(token, secret);

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
    return null;
  } catch {
    return null;
  }
}

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    return parts[1];
  }
  return null;
}

async function enforceJwtAuth(
  request: NextRequest
): Promise<NextResponse | null> {
  const jwtSecret = process.env.JWT_SECRET_KEY;

  // If no JWT secret configured, allow in development/sandbox mode
  if (!jwtSecret) {
    if (!jwtSecretWarningLogged) {
      console.warn(
        '[middleware] JWT_SECRET_KEY not set — JWT authentication is disabled (development/sandbox mode). ' +
          'Set JWT_SECRET_KEY to enable authentication.'
      );
      jwtSecretWarningLogged = true;
    }
    return null;
  }

  const authHeader = request.headers.get('authorization');
  const token = extractBearerToken(authHeader);

  if (!token) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Missing Authorization header' },
      { status: 401 }
    );
  }

  const payload = await verifyJwtToken(token);

  if (!payload) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Invalid or expired token' },
      { status: 401 }
    );
  }

  // Auth succeeded — add user context headers for downstream API routes
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('X-Org-Id', payload.orgId);
  requestHeaders.set('X-User-Id', payload.userId);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

// ── Main Middleware ─────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith('/api/');
  const origin = request.headers.get('origin');

  // ── Step 1: Handle CORS Preflight (OPTIONS) ────────────────────────────
  if (request.method === 'OPTIONS' && isApiRoute) {
    const corsHeaders = getCorsHeaders(origin);
    return new NextResponse(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        ...SECURITY_HEADERS,
      },
    });
  }

  // ── Step 2: Create base response ───────────────────────────────────────
  const response = NextResponse.next();

  // ── Step 3: Add security headers to ALL responses ──────────────────────
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  // ── Step 4: API-specific checks ────────────────────────────────────────
  if (isApiRoute) {
    // 4a. CORS headers on all API responses
    const corsHeaders = getCorsHeaders(origin);
    for (const [key, value] of Object.entries(corsHeaders)) {
      response.headers.set(key, value);
    }

    // 4b. Block /api/seed in production
    if (process.env.NODE_ENV === 'production' && pathname === '/api/seed') {
      return NextResponse.json(
        {
          error: 'forbidden',
          message: 'Seed endpoint is disabled in production',
        },
        {
          status: 403,
          headers: {
            ...SECURITY_HEADERS,
            ...corsHeaders,
          },
        }
      );
    }

    // 4c. Rate limiting on all /api/ routes
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ip = forwarded?.split(',')[0]?.trim() || realIp || 'unknown';

    const rateLimitResult = checkRateLimit(ip);

    // Add rate limit headers to response
    response.headers.set(
      'X-RateLimit-Remaining',
      String(rateLimitResult.remaining)
    );
    response.headers.set(
      'X-RateLimit-Reset',
      String(Math.ceil(rateLimitResult.resetAt / 1000))
    );

    if (!rateLimitResult.allowed) {
      const retryAfterSeconds = Math.ceil(
        (rateLimitResult.resetAt - Date.now()) / 1000
      );
      return NextResponse.json(
        {
          error: 'rate_limit_exceeded',
          message: 'Too many requests. Please try again later.',
          retryAfter: retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.max(1, retryAfterSeconds)),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(
              Math.ceil(rateLimitResult.resetAt / 1000)
            ),
            ...SECURITY_HEADERS,
            ...getCorsHeaders(origin),
          },
        }
      );
    }

    // 4d. JWT auth enforcement on non-public /api/ routes
    if (!isPublicApiRoute(pathname)) {
      const authResult = await enforceJwtAuth(request);

      if (authResult) {
        // Auth response (either 401 error or success with X-Org-Id/X-User-Id headers)
        // Merge security and CORS headers into the auth response
        for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
          authResult.headers.set(key, value);
        }
        const corsHeaders = getCorsHeaders(origin);
        for (const [key, value] of Object.entries(corsHeaders)) {
          authResult.headers.set(key, value);
        }
        return authResult;
      }
      // authResult is null — no JWT secret, dev mode, request allowed through
    }
  }

  return response;
}

// ── Matcher Configuration ───────────────────────────────────────────────────
// Match all routes except static files, images, and Next.js internals
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg).*)'],
};
