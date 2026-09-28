"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/staff";
import { generateCode, hashCode } from "@/lib/codes";

export type CodeState = { error?: string; code?: string; email?: string } | undefined;

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
  return makeInvite(email, role, role === "moderator" ? formData.getAll("cc").map(String) : []);
}

// A new code for someone who is locked out, or whose first code was lost.
export async function newCode(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = formData.get("role") === "admin" ? "admin" : "moderator";
  return makeInvite(email, role);
}
