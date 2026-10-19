"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateCode, hashCode } from "@/lib/codes";

export type CodeState = { error?: string; code?: string; email?: string; notice?: string } | undefined;

// Creates or refreshes an invite and returns the plain code once. Only its scrambled version is stored.
async function makeInvite(email: string, role: "admin" | "moderator", cohortCourseIds?: string[]): Promise<CodeState> {
  const { supabase, profile } = await requireAdmin();
  const code = generateCode();
  const { error } = await supabase.from("invites").upsert({
    email, role, code_hash: hashCode(code), used_at: null, created_by: profile.id,
    ...(cohortCourseIds ? { cohort_course_ids: cohortCourseIds } : {}),
  }, { onConflict: "email" });
  if (error) return { error: "Could not save the invite. Please try again." };
  revalidatePath("/dashboard/people");
  return { code, email };
}

export async function inviteStaff(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = formData.get("role") === "admin" ? "admin" : "moderator";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: "Enter a valid email address." };
  const courses = role === "moderator" ? formData.getAll("cc").map(String) : [];

  // Someone who is already on the team does not get a second code. They are given the courses instead.
  const { supabase } = await requireAdmin();
  const { data: person } = await supabase.from("profiles").select("id, full_name, role").eq("email", email).maybeSingle();
  if (person) {
    if (person.role === "admin") return { error: `${person.full_name} is already an admin and sees every course. Nothing to add.` };
    if (!courses.length) return { error: `${person.full_name} is already on the team. To give them more courses, tick the courses above. If they are locked out, use New code on their row in Active staff.` };
    const { error } = await supabase.from("cohort_course_moderators").upsert(
      courses.map((id) => ({ cohort_course_id: id, user_id: person.id })),
      { onConflict: "cohort_course_id,user_id", ignoreDuplicates: true },
    );
    if (error) return { error: "Could not add the courses. Please try again." };
    revalidatePath("/dashboard", "layout");
    return { notice: `${person.full_name} is already on the team, so no new code was made. They now have ${courses.length} more course${courses.length === 1 ? "" : "s"}.` };
  }
  return makeInvite(email, role, courses);
}

// Takes a moderator off the team. Their account is deleted, so they cannot sign in again until an admin invites them again.
// Work they already marked stays, it just no longer shows their name.
export async function removeStaff(formData: FormData) {
  const { profile: me, supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const go = (kind: "ok" | "error", message: string): never => redirect(`/dashboard/people?${kind}=${encodeURIComponent(message)}`);
  if (!id) go("error", "Choose someone to remove.");
  if (id === me.id) go("error", "You cannot remove yourself.");
  const { data: person } = await supabase.from("profiles").select("id, full_name, role").eq("id", id).maybeSingle();
  if (!person) go("error", "That person could not be found.");
  if (person!.role === "admin") go("error", "Admins cannot be removed here. Ask another admin or change it in Supabase.");
  const db = createAdminClient();
  await db.from("cohort_course_moderators").delete().eq("user_id", id);
  await db.from("profiles").delete().eq("id", id);
  const { error } = await db.auth.admin.deleteUser(id);
  if (error) go("error", `${person!.full_name} lost their courses, but the login could not be deleted. Try again.`);
  revalidatePath("/dashboard", "layout");
  go("ok", `${person!.full_name} was removed from the team.`);
}

// Cancels an invite that has not been used yet, so its code stops working.
export async function cancelInvite(formData: FormData) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("invites").delete().eq("id", String(formData.get("id") ?? "")).is("used_at", null);
  revalidatePath("/dashboard/people");
  redirect(`/dashboard/people?${error ? "error" : "ok"}=${encodeURIComponent(error ? "Could not cancel the invite." : "Invite cancelled. Its code no longer works.")}`);
}

// A new code for someone who is locked out, or whose first code was lost.
export async function newCode(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = formData.get("role") === "admin" ? "admin" : "moderator";
  return makeInvite(email, role);
}
