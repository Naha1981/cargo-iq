// CargoIQ — Supabase Client (Null-Safe)
// Creates a Supabase client only if environment variables are configured
// Falls back to null if not configured — no hardcoded credentials

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SupabaseClient = unknown;

// ---------------------------------------------------------------------------
// Supabase client singleton
// ---------------------------------------------------------------------------

let _supabase: SupabaseClient | null = null;
let _initialized = false;

/**
 * Get the Supabase client instance.
 *
 * Returns null if NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY
 * are not configured in the environment.
 *
 * This is safe to call from client or server code — the env vars are
 * prefixed with NEXT_PUBLIC_ so they're available in both contexts.
 */
export function getSupabase(): SupabaseClient | null {
  if (_initialized) return _supabase;

  _initialized = true;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.info(
      "[supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set — Supabase client disabled"
    );
    _supabase = null;
    return null;
  }

  try {
    // Dynamically import Supabase to avoid build errors if not installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require("@supabase/supabase-js");
    _supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.info("[supabase] Client initialized for:", supabaseUrl);
    return _supabase;
  } catch {
    console.warn(
      "[supabase] @supabase/supabase-js not installed — Supabase client disabled"
    );
    _supabase = null;
    return null;
  }
}

// ---------------------------------------------------------------------------
// Exported singleton (evaluated lazily via getSupabase)
// ---------------------------------------------------------------------------

/**
 * Supabase client or null.
 *
 * Access this directly for convenience, or use getSupabase() for explicit
 * lazy initialization with logging.
 */
export const supabase: SupabaseClient | null = null;

// Re-export the getter as the primary access method
export default getSupabase;
