import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type TaskProgress = { id: string; slug: string; title: string; kind: string; submitted: number; graded: number };

// Numbers for a course overview.
// A student is expected to send every task, so the number of submissions expected is students times tasks.
export async function courseStats(supabase: SupabaseClient, cohortCourseId: string, kind: "all" | "assignment" | "capstone") {
  const [{ count: students }, { data: all }] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }).eq("cohort_course_id", cohortCourseId),
    supabase.from("tasks").select("id, slug, title, kind").eq("cohort_course_id", cohortCourseId).order("created_at"),
  ]);
  const tasks = (all ?? []).filter((t) => kind === "all" || t.kind === kind);
  const ids = tasks.map((t) => t.id);
  const allIds = (all ?? []).map((t) => t.id);

  const [progress, sentBy, pending] = await Promise.all([
    Promise.all(tasks.map(async (t): Promise<TaskProgress> => {
      const [{ count: submitted }, { count: graded }] = await Promise.all([
        supabase.from("submissions").select("id", { count: "exact", head: true }).eq("task_id", t.id),
        supabase.from("submissions").select("id", { count: "exact", head: true }).eq("task_id", t.id).not("score", "is", null),
      ]);
      return { ...t, submitted: submitted ?? 0, graded: graded ?? 0 };
    })),
    (async () => {
      // Which students have sent at least one of these tasks.
      const seen = new Set<string>();
      if (!ids.length) return seen;
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase.from("submissions").select("student_id").in("task_id", ids).range(from, from + 999);
        (data ?? []).forEach((r) => seen.add(r.student_id));
        if (!data || data.length < 1000) break;
      }
      return seen;
    })(),
    allIds.length
      ? supabase.from("requests").select("id", { count: "exact", head: true }).in("task_id", allIds).eq("status", "pending")
      : Promise.resolve({ count: 0 }),
  ]);

  const submissions = progress.reduce((n, t) => n + t.submitted, 0);
  const graded = progress.reduce((n, t) => n + t.graded, 0);
  const total = students ?? 0;
  return {
    students: total,
    taskCount: tasks.length,
    expected: total * tasks.length,
    submissions,
    missing: Math.max(total * tasks.length - submissions, 0),
    studentsSent: sentBy.size,
    studentsNothing: Math.max(total - sentBy.size, 0),
    graded,
    waiting: submissions - graded,
    pendingRequests: pending.count ?? 0,
    progress,
  };
}
