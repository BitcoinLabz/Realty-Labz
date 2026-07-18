import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only admin client (service role key bypasses Row Level Security).
// Safe to use broadly here because every caller already enforces per-user
// ownership checks against Postgres before touching storage — see
// src/app/actions/documents.ts.
//
// Lazily constructed so importing this module doesn't crash routes/builds
// that never touch document storage when SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY
// aren't set yet (e.g. before the Supabase project is wired up).
let client: SupabaseClient | undefined;

export function getSupabaseAdmin(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — add them to .env.local.",
      );
    }
    client = createClient(url, key);
  }
  return client;
}
