"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/staff";
import { slugify } from "@/lib/slug";
import { fromLagosInput } from "@/lib/lagos";
import { isBuiltInKey } from "@/lib/link-types";
import type { FormState } from "./auth";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const tasksPath = (f: FormData) => `/dashboard/cohorts/${str(f, "cohort_slug")}/${str(f, "course_slug")}/tasks`;
const go = (path: string, kind: "error" | "ok", message: string): never => redirect(`${path}?${kind}=${encodeURIComponent(message)}`);

// Creates a task, or updates it when task_id is present.
export async function saveTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, profile } = await requireStaff();
  const list = tasksPath(formData);
  const taskId = str(formData, "task_id");

  const title = str(formData, "title");
  const kind = str(formData, "kind") === "capstone" ? "capstone" : "assignment";
  const maxScore = Number(str(formData, "max_score"));
  const { data: customRows } = await supabase.from("link_types").select("key");
  const validKeys = new Set([...(customRows ?? []).map((r) => r.key)]);
  const links = formData.getAll("link").map(String).filter((k) => isBuiltInKey(k) || validKeys.has(k));
  const opensAt = fromLagosInput(str(formData, "opens_at"));
  const closesAt = fromLagosInput(str(formData, "closes_at"));

  if (!title) return { error: "Give the task a title." };
  if (!Number.isInteger(maxScore) || maxScore < 1) return { error: "The highest score must be a whole number, 1 or more." };
  if (!links.length) return { error: "Tick at least one kind of link students must send." };
  if (opensAt && closesAt && new Date(closesAt) <= new Date(opensAt)) return { error: "The closing time must be after the opening time." };

  const fields = {
    kind, title, instructions: str(formData, "instructions"), max_score: maxScore,
    is_open: formData.get("is_open") === "on", opens_at: opensAt, closes_at: closesAt,
  };

  if (taskId) {
    // Once students have submitted, the links asked for stay as they are, so old submissions still make sense.
    const { count } = await supabase.from("submissions").select("id", { count: "exact", head: true }).eq("task_id", taskId);
    const { error } = await supabase.from("tasks").update((count ?? 0) > 0 ? fields : { ...fields, required_links: links }).eq("id", taskId);
    if (error) return { error: "Could not save the task." };
    revalidatePath("/dashboard", "layout");
    go(list, "ok", "Task saved.");
  }

  const { data: cc } = await supabase.from("cohort_courses").select("form_slug").eq("id", str(formData, "cohort_course_id")).single();
  if (!cc) return { error: "Could not find this course." };
  const base = slugify(`${cc!.form_slug}-${title}`);
  for (let i = 1; i <= 20; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    const { error } = await supabase.from("tasks").insert({
      ...fields, required_links: links, slug, cohort_course_id: str(formData, "cohort_course_id"), created_by: profile.id,
    });
    if (!error) {
      revalidatePath("/dashboard", "layout");
      go(list, "ok", `${title} created.`);
    }
    if (error?.code !== "23505") return { error: "Could not create the task." };
  }
  return { error: "Could not find a free address for this task. Try a slightly different title." };
}

export async function deleteTask(formData: FormData) {
  const { supabase } = await requireStaff();
  const list = tasksPath(formData);
  const { data: task } = await supabase.from("tasks").select("id, title").eq("id", str(formData, "task_id")).single();
  if (!task || str(formData, "confirm").toLowerCase() !== task.title.toLowerCase()) {
    go(`${list}/${str(formData, "task_slug")}`, "error", "The title you typed does not match, so nothing was deleted.");
  }
  await supabase.from("tasks").delete().eq("id", task!.id);
  revalidatePath("/dashboard", "layout");
  go(list, "ok", "Task deleted.");
}
