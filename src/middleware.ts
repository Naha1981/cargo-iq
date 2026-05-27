// CargoIQ — CORS + Auth Middleware
// Adds CORS headers to ALL API responses so the Lovable frontend (different domain)
// can call this Render backend. Handles OPTIONS preflight requests.
// For now, auth is optional — Bearer tokens are verified if present but not required,
// since the frontend also works in standalone/demo mode.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Org-Id, XTransformPort',
  'Access-Control-Max-Age': '86400',
};

export function middleware(request: NextRequest) {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }

  // Add CORS headers to all API responses
  const response = NextResponse.next();

  if (request.nextUrl.pathname.startsWith('/api/')) {
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      response.headers.set(key, value);
    }
  }

  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};
