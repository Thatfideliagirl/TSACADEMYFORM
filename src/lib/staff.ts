import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Staff = { id: string; full_name: string; email: string; role: "admin" | "moderator" };

// The signed in admin or moderator, or null. Cached for the length of one page request.
export const getStaff = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("id, full_name, email, role").eq("id", user.id).single();
  if (!data) return null;
  return { supabase, profile: data as Staff };
});

export async function requireStaff() {
  const staff = await getStaff();
  if (!staff) redirect("/");
  return staff;
}

export async function requireAdmin() {
  const staff = await requireStaff();
  if (staff.profile.role !== "admin") redirect("/dashboard");
  return staff;
}
