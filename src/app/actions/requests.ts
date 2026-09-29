"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkOpen } from "@/lib/link-open";
import { allTypes } from "@/lib/link-types";
import { customTypesFor } from "@/lib/submit-data";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const back = (to: string, kind: "error" | "ok", message: string): never => {
  const path = to.startsWith("/dashboard/") ? to.split("?")[0] : "/dashboard";
  redirect(`${path}?${kind}=${encodeURIComponent(message)}`);
};

// A moderator allows or declines a student's request.
// Allowing a replacement changes the submission in place and keeps the old link in the history.
export async function decideRequest(formData: FormData) {
  const { supabase, profile } = await requireStaff();
  const to = str(formData, "return_to");
  const approve = str(formData, "decision") === "approve";

  // Read through the security rules, so a moderator can only decide requests in their own courses.
  const { data: req } = await supabase.from("requests")
    .select("id, kind, link_type, new_url, status, submission_id").eq("id", str(formData, "request_id")).maybeSingle();
  if (!req) back(to, "error", "That request could not be found.");
  if (req!.status !== "pending") back(to, "error", "That request was already decided.");

  if (approve && req!.kind === "replace_link") {
    const db = createAdminClient();
    const { data: sub } = await db.from("submissions").select("id, task_id, links, unverified_links, reviewed, score, graded_at").eq("id", req!.submission_id).single();
    if (!sub) back(to, "error", "The submission could not be found.");
    const links = { ...(sub!.links as Record<string, string>) };
    const key = req!.link_type as string;
    const oldUrl = links[key];
    links[key] = req!.new_url as string;

    const { data: task } = await db.from("tasks").select("required_links").eq("id", sub!.task_id).single();
    const custom = await customTypesFor((task?.required_links as string[]) ?? []);
    const def = allTypes(custom).find((d) => d.key === key);
    const status = def ? await checkOpen(def, req!.new_url as string) : "unknown";
    const unverified = new Set<string>(sub!.unverified_links as string[]);
    if (status === "unknown") unverified.add(key); else unverified.delete(key);

    await db.from("submission_link_history").insert({ submission_id: sub!.id, link_type: key, old_url: oldUrl ?? "", new_url: req!.new_url });
    const { error } = await db.from("submissions").update({
      links, unverified_links: [...unverified],
      reviewed: { ...(sub!.reviewed as Record<string, boolean>), [key]: false, [`opens:${key}`]: false },
      changed_after_grading: sub!.score !== null || sub!.graded_at !== null,
    }).eq("id", sub!.id);
    if (error) back(to, "error", "Could not change the submission. Nothing was changed.");
  }

  const { error } = await supabase.from("requests").update({
    status: approve ? "approved" : "declined", decided_by: profile.id, decided_at: new Date().toISOString(),
  }).eq("id", req!.id);
  if (error) back(to, "error", "Could not save your decision.");
  revalidatePath("/dashboard", "layout");
  back(to, "ok", approve ? (req!.kind === "replace_link" ? "Allowed. The link was replaced and the old one was kept in the history." : "Marked as read.") : "Declined.");
}
