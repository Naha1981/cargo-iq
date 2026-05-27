// CargoIQ — Supabase Client
// Server-side Supabase client for verifying JWT tokens from the Lovable frontend.
// The Lovable frontend authenticates users via Supabase Auth and sends Bearer tokens
// to this backend. This module verifies those tokens and extracts user info.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://daayivphhckietqlycau.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhYXlpdnBoaGNraWV0cWx5Y2F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NDQ1NDIsImV4cCI6MjA5NTMyMDU0Mn0.8iSP2y9JjjsN5qXkxB2cvHGrJNdgUEFynTmw1ZWDixM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
