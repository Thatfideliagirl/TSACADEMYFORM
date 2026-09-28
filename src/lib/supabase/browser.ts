import { createBrowserClient } from "@supabase/ssr";

// For code that runs in the browser. It only uses the public key, which is safe to expose.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
