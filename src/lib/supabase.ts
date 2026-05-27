// CargoIQ — Supabase Client
// Server-side Supabase client for verifying JWT tokens from the Lovable frontend.
// The Lovable frontend authenticates users via Supabase Auth and sends Bearer tokens
// to this backend. This module verifies those tokens and extracts user info.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[CargoIQ] Supabase environment variables not set. Auth features will be disabled.');
}

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

export interface AuthUser {
  id: string;
  email: string;
  role?: string;
  org_id?: string;
  app_metadata?: Record<string, unknown>;
}

/**
 * Verify a Supabase JWT token and return the user.
 * Returns null if the token is invalid or expired.
 */
export async function verifySupabaseToken(token: string): Promise<AuthUser | null> {
  if (!supabase) return null;
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return null;
    }
    return {
      id: user.id,
      email: user.email || '',
      role: user.app_metadata?.role as string | undefined,
      org_id: user.app_metadata?.org_id as string | undefined,
      app_metadata: user.app_metadata,
    };
  } catch {
    return null;
  }
}

/**
 * Extract Bearer token from Authorization header.
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}
