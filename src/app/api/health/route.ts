import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// A self check for the site owner. It only says yes or no, and never shows keys or student data.
export const dynamic = "force-dynamic";

function category(error: { message?: string; code?: string }) {
  const m = (error.message ?? "").toLowerCase();
  if (m.includes("invalid api key") || m.includes("jwt")) return "the secret key is wrong";
  if (error.code === "42P01" || m.includes("does not exist") || m.includes("schema cache")) return "a table is missing, run the SQL files";
  if (error.code === "42501") return "permission denied";
  return "the database gave an error";
}

export async function GET(request: NextRequest) {
  const out: Record<string, unknown> = {
    publicSettingsSet: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    secretKeySet: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    firstAdminSettingsSet: Boolean(process.env.FIRST_ADMIN_EMAIL && process.env.ADMIN_SETUP_CODE),
  };
  if (!out.secretKeySet) return NextResponse.json(out);
  try {
    const db = createAdminClient();
    const started = Date.now();
    const { count, error } = await db.from("cohort_courses").select("id", { count: "exact", head: true });
    out.databaseTripMs = Date.now() - started;
    out.serverRegion = process.env.VERCEL_REGION ?? "local";
    out.secretKeyWorks = !error;
    if (error) out.problem = category(error);
    else out.courseFormsInDatabase = count;

    const slug = request.nextUrl.searchParams.get("slug");
    if (slug && !error) {
      const found = await db.from("cohort_courses").select("id, cohorts(name), courses(name)").eq("form_slug", slug).maybeSingle();
      out.slugFound = Boolean(found.data);
      if (found.error) out.slugProblem = category(found.error);
    }
  } catch {
    out.secretKeyWorks = false;
    out.problem = "the database could not be reached";
  }
  return NextResponse.json(out);
}
