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
    .select("id, links, score, tasks(max_score)").eq("id", str(formData, "submission_id")).maybeSingle();
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

  const { error } = await supabase.from("submissions").update({
    reviewed, score, comment: str(formData, "comment"),
    graded_by: score === null ? null : profile.id,
    graded_at: score === null ? null : new Date().toISOString(),
    changed_after_grading: false,
  }).eq("id", sub!.id);
  if (error) back(to, "error", "Could not save. Please try again.");
  revalidatePath("/dashboard", "layout");
  back(to, "ok", score === null ? "Saved. No score yet." : `Saved. Score ${score} out of ${max}.`);
}
