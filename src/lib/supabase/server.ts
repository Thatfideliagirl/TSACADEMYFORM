import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// For code that runs on the server and needs to know who is signed in.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (items) => {
          try {
            items.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a page that cannot set cookies. Safe to ignore.
          }
        },
      },
    },
  );
}
