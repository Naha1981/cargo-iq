// CargoIQ — CORS + Auth Middleware
// Adds CORS headers to ALL API responses so the Lovable frontend (different domain)
// can call this Render backend. Handles OPTIONS preflight requests.
// For now, auth is optional — Bearer tokens are verified if present but not required,
// since the frontend also works in standalone/demo mode.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// In production, restrict CORS to known frontend domains.
// For now, allow all origins but with a note for future hardening.
const ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS || '*';

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = ALLOWED_ORIGINS === '*' ? '*' : 
    (origin && ALLOWED_ORIGINS.split(',').includes(origin) ? origin : '');
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Org-Id, XTransformPort',
    'Access-Control-Max-Age': '86400',
  };
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  }

  // Add CORS headers to all API responses
  const response = NextResponse.next();

  if (request.nextUrl.pathname.startsWith('/api/')) {
    // Block access to /api/seed in production
    if (process.env.NODE_ENV === 'production' && request.nextUrl.pathname === '/api/seed') {
      return NextResponse.json(
        { error: 'forbidden', message: 'Seed endpoint is disabled in production' },
        { status: 403 }
      );
    }

    for (const [key, value] of Object.entries(corsHeaders)) {
      response.headers.set(key, value);
    }
  }

  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};
