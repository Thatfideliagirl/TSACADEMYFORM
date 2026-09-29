import Link from "next/link";
import { getCourseContext } from "@/lib/course-context";
import { siteOrigin } from "@/lib/origin";
import { showLagos } from "@/lib/lagos";
import { LINK_TYPES, isLinkTypeKey } from "@/lib/link-types";
import { Banner } from "@/components/banner";
import { CopyButton } from "@/components/copy-button";

export default async function TasksPage({ params, searchParams }: {
  params: Promise<{ slug: string; course: string }>; searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { slug, course: courseSlug } = await params;
  const { error, ok } = await searchParams;
  const { supabase, cohort, course, cc } = await getCourseContext(slug, courseSlug);
  const origin = await siteOrigin();

  const { data: tasks } = await supabase
    .from("tasks").select("id, kind, title, slug, max_score, required_links, is_open, opens_at, closes_at")
    .eq("cohort_course_id", cc.id).order("created_at");
  const ids = (tasks ?? []).map((t) => t.id);
  const counts = new Map<string, number>();
  if (ids.length) {
    const { data } = await supabase.from("submissions").select("task_id").in("task_id", ids);
    for (const r of data ?? []) counts.set(r.task_id, (counts.get(r.task_id) ?? 0) + 1);
  }
  const base = `/dashboard/cohorts/${cohort.slug}/${course.slug}`;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href={base} className="text-sm font-semibold text-brand">← {course.name}, {cohort.name}</Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Tasks</h1>
          <Link href={`${base}/tasks/new`} className="rounded-xl bg-brand px-5 py-2.5 font-display font-semibold text-white hover:bg-brand-dark">New task</Link>
        </div>
        <p className="mt-2 max-w-2xl text-muted">Assignments and the capstone for this course. Each one has its own link you can share, and students can also pick it on the course form.</p>
      </div>

      <Banner error={error} ok={ok} />

      {!tasks?.length ? (
        <p className="rounded-2xl border border-dashed border-line bg-white px-6 py-10 text-center text-muted">No tasks yet. Create the first one.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {tasks.map((t) => {
            const link = `${origin}/submit/${cc.form_slug}/${t.slug}`;
            return (
              <li key={t.id} className="rounded-2xl border border-line bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-xl font-semibold">{t.title}</h2>
                      <span className="rounded-full bg-sky-deep px-2.5 py-0.5 text-xs font-semibold capitalize">{t.kind}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${t.is_open ? "bg-[#e1f2e9] text-pass" : "bg-sky-deep text-muted"}`}>{t.is_open ? "Open" : "Closed"}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      Out of {t.max_score}, {counts.get(t.id) ?? 0} submitted
                      {t.opens_at && `, opens ${showLagos(t.opens_at)}`}{t.closes_at && `, closes ${showLagos(t.closes_at)}`}
                    </p>
                  </div>
                  <Link href={`${base}/tasks/${t.slug}`} className="rounded-lg border-[1.5px] border-line px-4 py-2 text-sm font-semibold text-brand hover:bg-sky">Edit</Link>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(t.required_links as string[]).filter(isLinkTypeKey).map((k) => <span key={k} className="rounded-full bg-sky px-2.5 py-0.5 text-xs font-semibold text-brand">{LINK_TYPES[k].label}</span>)}
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-sky px-3 py-2">
                  <code className="min-w-0 flex-1 truncate text-sm">{link}</code>
                  <CopyButton text={link} label="Copy link" />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
