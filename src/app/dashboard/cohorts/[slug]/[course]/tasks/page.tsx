import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { getCourseContext } from "@/lib/course-context";
import { siteOrigin } from "@/lib/origin";
import { showLagos } from "@/lib/lagos";
import { allTypes } from "@/lib/link-types";
import { createLinkType, deleteLinkType } from "@/app/actions/link-types";
import { Banner } from "@/components/banner";
import { CourseNav } from "@/components/course-nav";
import { CopyButton } from "@/components/copy-button";

export default async function TasksPage({ params, searchParams }: {
  params: Promise<{ slug: string; course: string }>; searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { slug, course: courseSlug } = await params;
  const { error, ok } = await searchParams;
  const { supabase, cohort, course, cc } = await getCourseContext(slug, courseSlug);
  const origin = await siteOrigin();
  const { data: customRows } = await supabase.from("link_types").select("key, label, domains, hint").order("label");
  const types = allTypes(customRows ?? []);
  const labelOf = (k: string) => types.find((t) => t.key === k)?.label ?? k;

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
        <BackLink href={base}>{course.name}, {cohort.name}</BackLink>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Tasks</h1>
          <Link href={`${base}/tasks/new`} className="rounded-xl bg-brand px-5 py-2.5 font-display font-semibold text-white hover:bg-brand-dark">New task</Link>
        </div>
        <p className="mt-2 max-w-2xl text-muted">Assignments and the capstone for this course. Each one has its own link you can share, and students can also pick it on the course form.</p>
      </div>

      <CourseNav base={`/dashboard/cohorts/${cohort.slug}/${course.slug}`} active="tasks" />

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
                  {(t.required_links as string[]).map((k) => <span key={k} className="rounded-full bg-sky px-2.5 py-0.5 text-xs font-semibold text-brand">{labelOf(k)}</span>)}
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

      <section className="rounded-2xl border border-line bg-white p-6">
        <h2 className="font-display text-xl font-semibold">Other kinds of link</h2>
        <p className="mt-1 text-sm text-muted">
          Google Docs, Sheets, Slides, Drive, Notion, Canva, Trello, Gamma, Figma, Loom, GitHub, YouTube and Miro are ready to tick.
          Need something else? Add it here, then tick it when you create a task.
        </p>
        {!!customRows?.length && (
          <ul className="mt-4 flex flex-col gap-2">
            {customRows.map((c) => (
              <li key={c.key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-2.5">
                <span><span className="font-semibold">{c.label}</span><span className="block text-sm text-muted">Links from {(c.domains as string[]).join(", ")}</span>{c.hint && <span className="block text-sm text-muted">Students see: {c.hint}</span>}</span>
                <form action={deleteLinkType}>
                  <input type="hidden" name="key" value={c.key} />
                  <input type="hidden" name="cohort_slug" value={cohort.slug} />
                  <input type="hidden" name="course_slug" value={course.slug} />
                  <button className="text-sm font-semibold text-fail">Delete</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={createLinkType} className="mt-5 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="cohort_slug" value={cohort.slug} />
          <input type="hidden" name="course_slug" value={course.slug} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="lt-label" className="text-sm font-semibold">Name of the kind of link</label>
            <input id="lt-label" name="label" required placeholder="Behance portfolio" className="rounded-xl border-[1.5px] border-line px-3 py-2.5 focus:border-brand focus:outline-none" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="lt-site" className="text-sm font-semibold">Website the links must come from</label>
            <input id="lt-site" name="website" required placeholder="behance.net" className="rounded-xl border-[1.5px] border-line px-3 py-2.5 focus:border-brand focus:outline-none" />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="lt-hint" className="text-sm font-semibold">Steps students follow to share it <span className="font-normal text-muted">(optional)</span></label>
            <input id="lt-hint" name="hint" placeholder="Publish the project, then copy the link from your browser." className="rounded-xl border-[1.5px] border-line px-3 py-2.5 focus:border-brand focus:outline-none" />
          </div>
          <div className="rounded-xl bg-sky px-4 py-3 text-sm sm:col-span-2">
            <p className="font-semibold">How this works</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
              <li>The website: a student who pastes a link from any other website is told it is the wrong kind, for example a Figma link in a Behance box.</li>
              <li>Whether it opens for anyone: the system tries the link like a stranger and checks by itself. You do not set this up. If a website blocks the check, the student can still submit and you see &quot;Could not verify&quot; on their submission.</li>
              <li>The steps: every website has its own way to share, so the system cannot know them. Type the steps here and students see them under the box. Leave it empty and they see a general message.</li>
            </ul>
          </div>
          <button className="self-start rounded-xl bg-brand px-5 py-2.5 font-display font-semibold text-white hover:bg-brand-dark sm:col-span-2">Add kind of link</button>
        </form>
      </section>
    </div>
  );
}
