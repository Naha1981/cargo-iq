import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CORS_ALLOWED_ORIGINS =
  process.env.CORS_ALLOWED_ORIGINS || "http://localhost:3000";

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute sliding window
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute per IP

const PUBLIC_API_ROUTES = ["/api/health", "/api/public", "/api/seed"];

// ---------------------------------------------------------------------------
// In-memory rate limiter (per-edge-instance, reset on cold start)
// ---------------------------------------------------------------------------

interface RateBucket {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateBucket>();

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = rateLimitStore.get(ip);

  if (!bucket) {
    rateLimitStore.set(ip, { timestamps: [now] });
    return false;
  }

  // Sliding window: keep only timestamps within the window
  bucket.timestamps = bucket.timestamps.filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS
  );

  if (bucket.timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  bucket.timestamps.push(now);
  return false;
}

// ---------------------------------------------------------------------------
// Security headers — returned as a headers init for merging
// ---------------------------------------------------------------------------

function getSecurityHeaders(): Headers {
  const headers = new Headers();
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-XSS-Protection", "1; mode=block");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return headers;
}

// ---------------------------------------------------------------------------
// CORS headers
// ---------------------------------------------------------------------------

function getCorsHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  const origin = request.headers.get("origin");
  const allowedOrigins = CORS_ALLOWED_ORIGINS.split(",").map((o) => o.trim());

  if (origin && allowedOrigins.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    );
    headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Org-Id, X-User-Id"
    );
    headers.set("Access-Control-Max-Age", "86400");
    headers.set("Access-Control-Allow-Credentials", "true");
  }

  return headers;
}

// ---------------------------------------------------------------------------
// Merge security + CORS headers into a response
// ---------------------------------------------------------------------------

function withSecurityHeaders(
  response: NextResponse,
  request: NextRequest
): NextResponse {
  const securityHeaders = getSecurityHeaders();
  const corsHeaders = getCorsHeaders(request);

  for (const [key, value] of securityHeaders.entries()) {
    response.headers.set(key, value);
  }
  for (const [key, value] of corsHeaders.entries()) {
    response.headers.set(key, value);
  }

  return response;
}

// ---------------------------------------------------------------------------
// JWT verification (lazy-loaded jose for Edge Runtime)
// ---------------------------------------------------------------------------

async function verifyJwt(
  token: string,
  secret: string
): Promise<{ orgId: string; userId: string; email: string } | null> {
  try {
    const { jwtVerify } = await import("jose");
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey);

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
// Middleware
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- Preflight CORS ---
  if (request.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 204 });
    return withSecurityHeaders(response, request);
  }

  // --- API-specific checks ---
  if (pathname.startsWith("/api/")) {
    // Rate limiting
    const ip = getClientIp(request);
    if (isRateLimited(ip)) {
      const response = NextResponse.json(
        { error: "rate_limited", message: "Too many requests. Please try again later." },
        { status: 429 }
      );
      response.headers.set("Retry-After", "60");
      return withSecurityHeaders(response, request);
    }

    // Public routes — skip auth
    const isPublic = PUBLIC_API_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(route + "/")
    );

    if (isPublic) {
      // Block /api/seed in production
      if (pathname.startsWith("/api/seed") && process.env.NODE_ENV === "production") {
        const response = NextResponse.json(
          { error: "forbidden", message: "Seed endpoint is disabled in production." },
          { status: 403 }
        );
        return withSecurityHeaders(response, request);
      }

      // Public route: pass through with security headers on the request
      const requestHeaders = new Headers(request.headers);
      const response = NextResponse.next({
        request: { headers: requestHeaders },
      });
      return withSecurityHeaders(response, request);
    }

    // JWT auth enforcement on non-public /api/ routes
    const jwtSecret = process.env.JWT_SECRET_KEY;

    if (!jwtSecret) {
      // Dev/sandbox mode: skip auth, inject dev defaults
      console.warn(
        "[middleware] JWT_SECRET_KEY not set — skipping auth (dev/sandbox mode)"
      );
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("X-Org-Id", "dev-org");
      requestHeaders.set("X-User-Id", "dev-user");
      const response = NextResponse.next({
        request: { headers: requestHeaders },
      });
      return withSecurityHeaders(response, request);
    }

    // Extract Bearer token
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      const response = NextResponse.json(
        { error: "unauthorized", message: "Missing or invalid Authorization header." },
        { status: 401 }
      );
      return withSecurityHeaders(response, request);
    }

    // Verify JWT and inject tenant headers
    const payload = await verifyJwt(token, jwtSecret);

    if (!payload) {
      const response = NextResponse.json(
        { error: "unauthorized", message: "Invalid or expired token." },
        { status: 401 }
      );
      return withSecurityHeaders(response, request);
    }

    // Inject org/user headers for downstream handlers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("X-Org-Id", payload.orgId);
    requestHeaders.set("X-User-Id", payload.userId);

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    return withSecurityHeaders(response, request);
  }

  // --- Non-API routes: pass through with security headers ---
  const requestHeaders = new Headers(request.headers);
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  return withSecurityHeaders(response, request);
}

// ---------------------------------------------------------------------------
// Matcher: skip static assets and favicons
// ---------------------------------------------------------------------------

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg).*)"],
};
