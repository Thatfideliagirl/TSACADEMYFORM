import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Staff = { id: string; full_name: string; email: string; role: "admin" | "moderator" };

// The signed in admin or moderator, or null. Cached for the length of one page request.
// Who is signed in is read from the saved sign in (no trip to the login service on every click, which was slow).
// This is safe because every database read below is checked by the database itself against that same sign in token:
// a made up token is refused there, and the person is treated as signed out.
function userIdFrom(accessToken: string | undefined): string | null {
  try {
    const payload = JSON.parse(Buffer.from(String(accessToken).split(".")[1], "base64url").toString());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export const getStaff = cache(async () => {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const id = userIdFrom(session?.access_token);
  if (!id) return null;
  const { data } = await supabase.from("profiles").select("id, full_name, email, role").eq("id", id).maybeSingle();
  if (!data) return null;
  return { supabase, profile: data as Staff };
});

export async function requireStaff() {
  const staff = await getStaff();
  if (!staff) redirect("/sign-in");
  return staff;
}

export async function requireAdmin() {
  const staff = await requireStaff();
  if (staff.profile.role !== "admin") redirect("/dashboard");
  return staff;
}
