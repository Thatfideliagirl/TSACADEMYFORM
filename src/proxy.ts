import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Runs before every page. Keeps the sign in fresh so staff are not logged out while working,
// and sends anyone who is not signed in away from the dashboard.
export async function proxy(request: NextRequest) {
  // If a setting is missing, say which one instead of showing a blank "Internal error".
  const missing = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"].filter((n) => !process.env[n]?.trim());
  if (missing.length) {
    return new NextResponse(
      `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui,sans-serif;max-width:34rem;margin:15vh auto;padding:0 1.25rem;line-height:1.5;color:#0f2544">` +
      `<h1 style="font-size:1.5rem">Setup is not finished</h1><p>This site is missing: <b>${missing.join(", ")}</b>.</p>` +
      `<p>In Vercel open Settings, then Environment Variables, add ${missing.length > 1 ? "them" : "it"}, then redeploy.</p></body>`,
      { status: 503, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items) => {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp)$).*)"],
};
