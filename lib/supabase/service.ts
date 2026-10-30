import { createClient } from "@supabase/supabase-js";

// Server-only, for scheduled jobs that act for every user without a browser session. It bypasses row-level
// security, so every query made with it must filter by owner_id itself.
export function createServiceClient() {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
