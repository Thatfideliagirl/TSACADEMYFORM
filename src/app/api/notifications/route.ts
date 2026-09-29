import { NextResponse } from "next/server";
import { getStaff } from "@/lib/staff";
import { createAdminClient } from "@/lib/supabase/admin";

// Feeds the notification bell. Reads use the signed in person's own access, so a moderator only hears about their own courses.
export const dynamic = "force-dynamic";

type One<T> = T | T[] | null;
const first = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export async function GET() {
  const staff = await getStaff();
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { supabase, profile } = staff;

  const { data: me, error } = await supabase.from("profiles").select("notifications_seen_at").eq("id", profile.id).maybeSingle();
  // The column comes from SQL file 0005. Until it is run, the bell simply stays hidden.
  if (error || !me) return NextResponse.json({ enabled: false });
  const seen = me.notifications_seen_at as string;
  const now = new Date().toISOString();

  const [{ count }, { data: latest }] = await Promise.all([
    supabase.from("submissions").select("id", { count: "exact", head: true }).gt("submitted_at", seen).lte("submitted_at", now),
    supabase.from("submissions")
      .select("id, submitted_at, students(full_name), tasks(title, cohort_courses(cohorts(slug, name), courses(slug, name)))")
      .order("submitted_at", { ascending: false }).limit(8),
  ]);

  const items = (latest ?? []).map((s) => {
    const task = first(s.tasks as One<{ title: string; cohort_courses: One<{ cohorts: One<{ slug: string; name: string }>; courses: One<{ slug: string; name: string }> }> }>);
    const cc = first(task?.cohort_courses ?? null);
    const cohort = first(cc?.cohorts ?? null);
    const course = first(cc?.courses ?? null);
    return {
      id: s.id,
      student: first(s.students as One<{ full_name: string }>)?.full_name ?? "A student",
      task: task?.title ?? "a task",
      where: [course?.name, cohort?.name].filter(Boolean).join(", "),
      href: cohort && course ? `/dashboard/cohorts/${cohort.slug}/${course.slug}/submissions` : "/dashboard",
      at: s.submitted_at,
      isNew: s.submitted_at > seen,
    };
  });
  return NextResponse.json({ enabled: true, count: count ?? 0, items, now });
}

// "Mark all as seen". Only moves the person's own marker forward, up to the time the bell last looked.
export async function POST(request: Request) {
  const staff = await getStaff();
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const upTo = new Date(String(body?.now ?? ""));
  const at = Number.isNaN(upTo.getTime()) || upTo.getTime() > Date.now() ? new Date() : upTo;
  const { error } = await createAdminClient().from("profiles").update({ notifications_seen_at: at.toISOString() }).eq("id", staff.profile.id);
  if (error) return NextResponse.json({ error: "Could not save" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
