import * as XLSX from "xlsx";
import { NextResponse, type NextRequest } from "next/server";
import { getCourseContext } from "@/lib/course-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { allTypes } from "@/lib/link-types";
import { slugify } from "@/lib/slug";
import { showLagos } from "@/lib/lagos";

// Downloads a spreadsheet. Uses the signed in person's own access, so they can only export their own courses.
export const dynamic = "force-dynamic";

type One<T> = T | T[] | null;
const first = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);

async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await page(from, from + 999);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string; course: string }> }) {
  const { slug, course: courseSlug } = await params;
  const sp = request.nextUrl.searchParams;
  const { supabase, cohort, course, cc } = await getCourseContext(slug, courseSlug);
  const format = sp.get("format") === "csv" ? "csv" : "xlsx";
  const today = new Date().toISOString().slice(0, 10);

  let header: string[];
  let rows: (string | number)[][];
  let label: string;

  if (sp.get("missing") === "1") {
    // Students who have not sent one task.
    const { data: task } = await supabase.from("tasks").select("id, title").eq("cohort_course_id", cc.id).eq("slug", sp.get("task") ?? "").maybeSingle();
    if (!task) return new NextResponse("That task could not be found.", { status: 404 });
    const students = await all((f, t) => supabase.from("students").select("id, full_name, email").eq("cohort_course_id", cc.id).order("full_name").range(f, t));
    const done = new Set((await all((f, t) => supabase.from("submissions").select("student_id").eq("task_id", task.id).range(f, t))).map((r) => r.student_id));
    header = ["Full name", "Email", "Cohort", "Course", "Task not submitted"];
    rows = students.filter((s) => !done.has(s.id)).map((s) => [s.full_name, s.email, cohort.name, course.name, task.title]);
    label = `not-submitted-${task.title}`;
  } else {
    const scope = sp.get("scope") ?? "all";
    let tq = supabase.from("tasks").select("id, slug, title, kind, max_score, required_links").eq("cohort_course_id", cc.id).order("created_at");
    if (scope === "assignments") tq = tq.eq("kind", "assignment");
    else if (scope === "capstone") tq = tq.eq("kind", "capstone");
    else if (scope.startsWith("task:")) tq = tq.eq("slug", scope.slice(5));
    const { data: tasks } = await tq;
    const taskIds = (tasks ?? []).map((t) => t.id);
    const { data: custom } = await supabase.from("link_types").select("key, label, domains, hint");
    const types = allTypes(custom ?? []);
    const labelOf = (k: string) => types.find((t) => t.key === k)?.label ?? k;

    const subs = taskIds.length ? await all((f, t) => supabase.from("submissions")
      .select("id, task_id, links, unverified_links, reviewed, submitted_at, score, comment, graded_by, changed_after_grading, students(full_name, email)")
      .in("task_id", taskIds).order("submitted_at").range(f, t)) : [];
    const reqs = taskIds.length ? await all((f, t) => supabase.from("requests").select("submission_id, kind, status").in("task_id", taskIds).range(f, t)) : [];
    const reqBy = new Map(reqs.map((r) => [r.submission_id, r]));

    // Names of the people who marked. Read with full access, but only after the person was checked against this course above.
    const graderIds = [...new Set(subs.map((s) => s.graded_by).filter(Boolean))] as string[];
    const names = new Map<string, string>();
    if (graderIds.length) {
      const { data } = await createAdminClient().from("profiles").select("id, full_name").in("id", graderIds);
      (data ?? []).forEach((p) => names.set(p.id, p.full_name));
    }

    const keys: string[] = [];
    for (const t of tasks ?? []) for (const k of t.required_links as string[]) if (!keys.includes(k)) keys.push(k);
    for (const s of subs) for (const k of Object.keys((s.links ?? {}) as Record<string, string>)) if (!keys.includes(k)) keys.push(k);
    // The person chooses what goes in the sheet. Name, email, task and date are always there.
    const pick = sp.get("pick") === "1";
    const want = new Set(sp.getAll("cols"));
    const has = (k: string) => !pick || want.has(k);
    header = ["Full name", "Email", "Cohort", "Task", "Type", "Submitted at",
      ...(has("links") ? keys.map(labelOf) : []),
      ...(has("score") ? ["Score", "Out of", "Comment"] : []),
      ...(has("marking") ? ["All links reviewed", "Request used", "Graded by", "Changed after grading"] : [])];
    const taskBy = new Map((tasks ?? []).map((t) => [t.id, t]));
    rows = subs.map((s) => {
      const st = first(s.students as One<{ full_name: string; email: string }>);
      const t = taskBy.get(s.task_id)!;
      const links = s.links as Record<string, string>;
      const reviewed = (s.reviewed ?? {}) as Record<string, boolean>;
      const r = reqBy.get(s.id);
      return [
        st?.full_name ?? "", st?.email ?? "", cohort.name, t.title, t.kind === "capstone" ? "Capstone" : "Assignment", showLagos(s.submitted_at),
        ...(has("links") ? keys.map((k) => links[k] ?? "") : []),
        ...(has("score") ? [s.score ?? "", t.max_score, s.comment ?? ""] : []),
        ...(has("marking") ? [
          Object.keys(links).length > 0 && Object.keys(links).every((k) => reviewed[k]) ? "Yes" : "No",
          r ? `${r.kind === "note" ? "Note" : "Replace link"} (${r.status})` : "No",
          s.graded_by ? names.get(s.graded_by) ?? "" : "",
          s.changed_after_grading ? "Yes" : "No",
        ] : []),
      ];
    });
    label = scope === "all" ? "all-tasks" : scope.startsWith("task:") ? (tasks?.[0]?.title ?? "task") : scope;
  }

  const filename = `${slugify(`${cohort.name}-${course.name}-${label}`)}-${today}.${format}`;
  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  sheet["!cols"] = header.map((h, i) => ({ wch: Math.min(48, Math.max(h.length + 2, ...rows.slice(0, 200).map((r) => String(r[i] ?? "").length + 2))) }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Submissions");
  if (format === "csv") {
    // A leading byte order mark makes Excel show names with accents correctly.
    return new NextResponse("﻿" + XLSX.utils.sheet_to_csv(sheet), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${filename}"` },
    });
  }
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="${filename}"` },
  });
}
