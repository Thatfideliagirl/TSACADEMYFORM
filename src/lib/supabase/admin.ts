import "server-only";
import { createClient } from "@supabase/supabase-js";

// Full access client. It ignores the security rules, so use it only in server code,
// and only for things a signed in person is not allowed to do themselves (like creating accounts).
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
