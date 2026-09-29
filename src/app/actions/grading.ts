"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/staff";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

// Only send people back to pages inside the dashboard.
const safeReturn = (p: string) => (p.startsWith("/dashboard/") ? p : "/dashboard");
const back = (to: string, kind: "error" | "ok", message: string): never => {
  const u = new URL(safeReturn(to), "http://x");
  u.searchParams.delete("error"); u.searchParams.delete("ok");
  u.searchParams.set(kind, message);
  redirect(`${u.pathname}${u.search}`);
};

// Saves the marking for one submission: which links were reviewed, the score and the comment.
export async function saveGrade(formData: FormData) {
  const { supabase, profile } = await requireStaff();
  const to = str(formData, "return_to");
  const { data: sub } = await supabase.from("submissions")
    .select("id, links, unverified_links, score, tasks(max_score)").eq("id", str(formData, "submission_id")).maybeSingle();
  if (!sub) back(to, "error", "That submission could not be found.");

  const task = Array.isArray(sub!.tasks) ? sub!.tasks[0] : sub!.tasks;
  const max = Number(task?.max_score ?? 0);
  const raw = str(formData, "score");
  let score: number | null = null;
  if (raw !== "") {
    score = Number(raw);
    if (!Number.isFinite(score) || score < 0 || score > max) back(to, "error", `Enter a score from 0 to ${max}.`);
  }

  const reviewed: Record<string, boolean> = {};
  for (const key of Object.keys(sub!.links as Record<string, string>)) reviewed[key] = formData.get(`reviewed_${key}`) === "on";
  // For links the system could not check, the moderator says whether they opened it and it works for anyone.
  // Stored next to the reviewed ticks under the name "opens:<kind>", so no database change is needed.
  for (const key of (sub!.unverified_links ?? []) as string[]) reviewed[`opens:${key}`] = formData.get(`opens_${key}`) === "on";

  const { error } = await supabase.from("submissions").update({
    reviewed, score, comment: str(formData, "comment"),
    graded_by: score === null ? null : profile.id,
    graded_at: score === null ? null : new Date().toISOString(),
    changed_after_grading: false,
    // Saving a mark ends any resubmission that was being asked for.
    resubmit_asked: false, resubmit_links: [],
  }).eq("id", sub!.id);
  if (error) back(to, "error", "Could not save. Please try again.");
  revalidatePath("/dashboard", "layout");
  back(to, "ok", score === null ? "Saved. No score yet." : `Saved. Score ${score} out of ${max}.`);
}

// Holds a submission back and asks the student to send new links for the ones that were wrong.
// The links the moderator did not switch on stay exactly as they are, and the student cannot change them.
export async function askResubmit(formData: FormData) {
  const { supabase, profile } = await requireStaff();
  const to = str(formData, "return_to");
  const { data: sub } = await supabase.from("submissions")
    .select("id, links, resubmit_asked, resubmit_count, reviewed").eq("id", str(formData, "submission_id")).maybeSingle();
  if (!sub) back(to, "error", "That submission could not be found.");

  const links = sub!.links as Record<string, string>;
  const wrong = Object.keys(links).filter((k) => formData.get(`resubmit_${k}`) === "on");
  const feedback = str(formData, "feedback");
  if (!wrong.length) back(to, "error", "Switch on Resubmit for at least one link.");
  if (!feedback) back(to, "error", "Write your feedback, so the student knows what to fix.");

  const reviewed: Record<string, boolean> = { ...((sub!.reviewed ?? {}) as Record<string, boolean>) };
  for (const key of Object.keys(links)) {
    reviewed[key] = wrong.includes(key) ? false : formData.get(`reviewed_${key}`) === "on";
    if (wrong.includes(key)) reviewed[`opens:${key}`] = false;
  }

  const { error } = await supabase.from("submissions").update({
    reviewed, comment: str(formData, "comment"),
    resubmit_asked: true, resubmit_links: wrong, resubmit_feedback: feedback,
    resubmit_asked_at: new Date().toISOString(), resubmit_asked_by: profile.id,
    resubmit_count: sub!.resubmit_asked ? sub!.resubmit_count : (sub!.resubmit_count ?? 0) + 1,
    // No score while the student is fixing the work. Any earlier score is cleared.
    score: null, graded_by: null, graded_at: null, changed_after_grading: false,
  }).eq("id", sub!.id);
  if (error) back(to, "error", "Could not save. Please try again.");
  revalidatePath("/dashboard", "layout");
  back(to, "ok", "Resubmission asked. The student can now send new links for the ones you switched on.");
}

export async function cancelResubmit(formData: FormData) {
  const { supabase } = await requireStaff();
  const to = str(formData, "return_to");
  const { error } = await supabase.from("submissions").update({ resubmit_asked: false, resubmit_links: [] }).eq("id", str(formData, "submission_id"));
  if (error) back(to, "error", "Could not cancel. Please try again.");
  revalidatePath("/dashboard", "layout");
  back(to, "ok", "Resubmission cancelled. The submission is back in To mark.");
}
