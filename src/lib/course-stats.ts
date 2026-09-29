import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type TaskProgress = { id: string; slug: string; title: string; kind: string; submitted: number; graded: number };

// Numbers for the overview: how many students, how many have submitted, how many are marked.
export async function courseStats(supabase: SupabaseClient, cohortCourseId: string, kind: "all" | "assignment" | "capstone") {
  const { count: students } = await supabase.from("students").select("id", { count: "exact", head: true }).eq("cohort_course_id", cohortCourseId);
  const { data: all } = await supabase.from("tasks").select("id, slug, title, kind").eq("cohort_course_id", cohortCourseId).order("created_at");
  const tasks = (all ?? []).filter((t) => kind === "all" || t.kind === kind);

  const progress: TaskProgress[] = await Promise.all(tasks.map(async (t) => {
    const [{ count: submitted }, { count: graded }] = await Promise.all([
      supabase.from("submissions").select("id", { count: "exact", head: true }).eq("task_id", t.id),
      supabase.from("submissions").select("id", { count: "exact", head: true }).eq("task_id", t.id).not("score", "is", null),
    ]);
    return { ...t, submitted: submitted ?? 0, graded: graded ?? 0 };
  }));

  // Requests are counted across every task in the course, not just the filtered ones.
  const ids = (all ?? []).map((t) => t.id);
  let pendingRequests = 0;
  if (ids.length) {
    const { count } = await supabase.from("requests").select("id", { count: "exact", head: true }).in("task_id", ids).eq("status", "pending");
    pendingRequests = count ?? 0;
  }

  const submitted = progress.reduce((n, t) => n + t.submitted, 0);
  const graded = progress.reduce((n, t) => n + t.graded, 0);
  const expected = (students ?? 0) * tasks.length;
  return { students: students ?? 0, taskCount: tasks.length, submitted, notSubmitted: Math.max(expected - submitted, 0), graded, ungraded: submitted - graded, pendingRequests, progress };
}
