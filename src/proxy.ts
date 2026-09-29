import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Runs before every page. Keeps the sign in fresh so staff are not logged out while working,
// and sends anyone who is not signed in away from the dashboard.
function notice(title: string, body: string, status: number) {
  return new NextResponse(
    `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui,sans-serif;max-width:34rem;margin:15vh auto;padding:0 1.25rem;line-height:1.5;color:#0f2544">` +
      `<h1 style="font-size:1.5rem">${title}</h1>${body}</body>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export async function proxy(request: NextRequest) {
  // If a setting is missing, say which one instead of showing a blank "Internal error".
  const missing = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"].filter((n) => !process.env[n]?.trim());
  if (missing.length) {
    return notice("Setup is not finished",
      `<p>This site is missing: <b>${missing.join(", ")}</b>.</p><p>In Vercel open Settings, then Environment Variables, add ${missing.length > 1 ? "them" : "it"}, then redeploy.</p>`, 503);
  }
  let response = NextResponse.next({ request });
  let user;
  try {
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
    user = (await supabase.auth.getUser()).data.user;
  } catch (e) {
    console.error("Supabase check failed", e);
    return notice("Cannot reach the database",
      "<p>The site could not talk to Supabase. Check that NEXT_PUBLIC_SUPABASE_URL starts with https:// and has no spaces, and that NEXT_PUBLIC_SUPABASE_ANON_KEY is the full key. Then redeploy.</p>", 503);
  }
  if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp)$).*)"],
};
