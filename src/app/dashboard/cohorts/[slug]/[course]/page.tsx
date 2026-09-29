import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { Banner } from "@/components/banner";
import { CopyButton } from "@/components/copy-button";
import { CourseNav } from "@/components/course-nav";
import { DangerZone } from "@/components/danger-zone";
import { getCourseContext } from "@/lib/course-context";
import { courseStats } from "@/lib/course-stats";
import { siteOrigin } from "@/lib/origin";
import { assignModerator, removeCourseFromCohort, removeModerator, updateCohortCourse, updateFormAddress } from "@/app/actions/cohorts";

type One<T> = T | T[] | null;
const first = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);
const box = "rounded-xl border-[1.5px] border-line bg-white px-3 py-2.5 focus:border-brand focus:outline-none";

export default async function CoursePage({ params, searchParams }: {
  params: Promise<{ slug: string; course: string }>; searchParams: Promise<{ error?: string; ok?: string; kind?: string }>;
}) {
  const { slug, course: courseSlug } = await params;
  const { error, ok, kind: kindParam } = await searchParams;
  const kind = kindParam === "assignment" || kindParam === "capstone" ? kindParam : "all";
  const { supabase, profile, cohort, course, cc } = await getCourseContext(slug, courseSlug);
  const isAdmin = profile.role === "admin";
  const base = `/dashboard/cohorts/${cohort.slug}/${course.slug}`;

  const [stats, { data: modRows }, { data: allMods }, origin] = await Promise.all([
    courseStats(supabase, cc.id, kind),
    supabase.from("cohort_course_moderators").select("user_id, profiles(full_name, email)").eq("cohort_course_id", cc.id),
    isAdmin ? supabase.from("profiles").select("id, full_name, email").eq("role", "moderator").order("full_name") : Promise.resolve({ data: [] }),
    siteOrigin(),
  ]);
  const mods = (modRows ?? []) as { user_id: string; profiles: One<{ full_name: string; email: string }> }[];
  const assigned = new Set(mods.map((m) => m.user_id));
  const canAdd = (allMods ?? []).filter((m) => !assigned.has(m.id));
  const link = `${origin}/submit/${cc.form_slug}`;

  const tiles: [string, number, string, string][] = [
    ["Students", stats.students, "", "on the list"],
    ["Tasks", stats.taskCount, "", kind === "all" ? "assignments and capstone" : kind === "assignment" ? "assignments" : "capstone"],
    ["Submitted", stats.submissions, "", "tasks received"],
    ["Not yet submitted", stats.missing, stats.missing > 0 ? "text-navy" : "", "tasks still missing"],
    ["Students who have submitted", stats.studentsSent, "", `of ${stats.students} students`],
    ["Marked", stats.graded, "", "submissions"],
    ["Waiting to be marked", stats.waiting, stats.waiting > 0 ? "text-brand" : "", "submissions"],
    ["Pending requests", stats.pendingRequests, stats.pendingRequests > 0 ? "text-fail" : "", "to decide"],
  ];


  return (
    <div className="flex flex-col gap-8">
      <div>
        <BackLink href={`/dashboard/cohorts/${cohort.slug}`}>{cohort.name}</BackLink>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">{course.name}</h1>
        <p className="mt-1 text-muted">{cohort.name}</p>
      </div>

      <CourseNav base={base} active="" pending={stats.pendingRequests} />
      <Banner error={error} ok={ok} />

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">Overview</h2>
          <div className="flex gap-1 rounded-xl bg-sky p-1 text-sm font-semibold">
            {([["all", "All"], ["assignment", "Assignments"], ["capstone", "Capstone"]] as const).map(([k, label]) => (
              <Link key={k} href={k === "all" ? base : `${base}?kind=${k}`} aria-current={kind === k ? "page" : undefined}
                className={`rounded-lg px-3 py-1.5 ${kind === k ? "bg-white text-navy shadow-sm" : "text-muted hover:text-navy"}`}>{label}</Link>
            ))}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map(([label, n, tone, note]) => (
            <div key={label} className="rounded-2xl border border-line bg-white p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
              <dd className={`mt-1 font-display text-3xl font-semibold ${tone}`}>{n}</dd>
              <dd className="text-xs text-muted">{note}</dd>
            </div>
          ))}
        </dl>
        {stats.taskCount > 0 && (
          <p className="text-sm text-muted">
            Every student is expected to send every task, so {stats.students} student{stats.students === 1 ? "" : "s"} and {stats.taskCount} task{stats.taskCount === 1 ? "" : "s"} means {stats.expected} submissions in total.
            {" "}{stats.submissions} {stats.submissions === 1 ? "has" : "have"} come in, so {stats.missing} {stats.missing === 1 ? "is" : "are"} not yet submitted.
          </p>
        )}
        {stats.progress.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-white px-6 py-8 text-center text-muted">
            No tasks here yet. <Link href={`${base}/tasks/new`} className="font-semibold text-brand underline">Create the first task</Link>.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {stats.progress.map((t) => {
              const pct = stats.students ? Math.min(100, Math.round((t.submitted / stats.students) * 100)) : 0;
              return (
                <li key={t.id} className="rounded-2xl border border-line bg-white p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link href={`${base}/submissions?task=${t.slug}`} className="font-display text-lg font-semibold hover:text-brand">{t.title}</Link>
                    <span className="text-sm text-muted">{t.submitted} of {stats.students} submitted, {t.graded} marked</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-sky-deep" role="img" aria-label={`${pct} percent submitted`}>
                    <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-white p-6">
        <h2 className="font-display text-xl font-semibold">Form for students</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <form action={updateCohortCourse} className="flex flex-col gap-4">
            <input type="hidden" name="cohort_course_id" value={cc.id} />
            <input type="hidden" name="cohort_slug" value={cohort.slug} />
            <input type="hidden" name="course_slug" value={course.slug} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="form-name" className="text-sm font-semibold">Name students see on the form</label>
              <input id="form-name" name="form_name" defaultValue={cc.form_name} required className={box} />
            </div>
            <label className="flex items-center gap-3 font-medium">
              <input type="checkbox" name="is_open" defaultChecked={cc.is_open} className="h-5 w-5 accent-brand" />
              Form is open for submissions
            </label>
            <button className="self-start rounded-xl bg-brand px-5 py-2.5 font-display font-semibold text-white hover:bg-brand-dark">Save changes</button>
          </form>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Form link</span>
            <div className="flex items-center gap-2 rounded-xl bg-sky px-3 py-2.5">
              <code className="min-w-0 flex-1 break-all text-sm">{link}</code>
              <CopyButton text={link} />
            </div>
            <p className="text-sm text-muted">Share this link with the students of this course.</p>
            {isAdmin && (
              <form action={updateFormAddress} className="mt-2 flex flex-col gap-1.5 rounded-xl border border-line p-3">
                <input type="hidden" name="cohort_course_id" value={cc.id} />
                <input type="hidden" name="cohort_slug" value={cohort.slug} />
                <input type="hidden" name="course_slug" value={course.slug} />
                <label htmlFor="address" className="text-sm font-semibold">Change the end of the link</label>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted">/submit/</span>
                  <input id="address" name="address" defaultValue={cc.form_slug} required className={`${box} min-w-[10rem] flex-1`} />
                  <button className="rounded-lg border-[1.5px] border-line px-3 py-2 text-sm font-semibold text-brand hover:bg-sky">Change</button>
                </div>
                <p className="text-xs text-muted">Letters, numbers and dashes only. If you change it, links you already shared stop working, so send the new one.</p>
              </form>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-6">
        <h2 className="font-display text-xl font-semibold">Moderators</h2>
        <p className="mt-1 text-sm text-muted">A course can have as many moderators as you need. Each one sees only the courses given to them.</p>
        {mods.length === 0 ? (
          <p className="mt-3 text-muted">No moderator has been given this course yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {mods.map((m) => {
              const p = first(m.profiles);
              return (
                <li key={m.user_id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-2.5">
                  <span className="min-w-0"><span className="font-semibold">{p?.full_name ?? "Moderator"}</span>{p?.email && <span className="block truncate text-sm text-muted">{p.email}</span>}</span>
                  {isAdmin && (
                    <form action={removeModerator}>
                      <input type="hidden" name="cohort_course_id" value={cc.id} />
                      <input type="hidden" name="user_id" value={m.user_id} />
                      <button className="text-sm font-semibold text-fail">Remove</button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {isAdmin && (canAdd.length ? (
          <form action={assignModerator} className="mt-4 flex gap-2">
            <input type="hidden" name="cohort_course_id" value={cc.id} />
            <label htmlFor="add-mod" className="sr-only">Add a moderator</label>
            <select id="add-mod" name="user_id" required defaultValue="" className={`${box} min-w-0 flex-1`}>
              <option value="" disabled>Choose a moderator</option>
              {canAdd.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
            <button className="rounded-xl bg-brand px-5 py-2.5 font-display font-semibold text-white hover:bg-brand-dark">Add</button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-muted">
            {(allMods ?? []).length ? "Every moderator already has this course." : <>There are no moderators yet. <Link href="/dashboard/people" className="font-semibold text-brand underline">Invite one</Link>.</>}
          </p>
        ))}
      </section>

      {isAdmin && (
        <DangerZone title="Remove this course from the cohort" confirmWord={course.name} action={removeCourseFromCohort} buttonLabel="Remove course for good"
          warning={`This removes ${course.name} from ${cohort.name}, with its student list, tasks and submissions. It cannot be undone. The course itself stays in your course list.`}>
          <input type="hidden" name="cohort_course_id" value={cc.id} />
          <input type="hidden" name="cohort_slug" value={cohort.slug} />
          <input type="hidden" name="course_slug" value={course.slug} />
          <input type="hidden" name="course_name" value={course.name} />
        </DangerZone>
      )}
    </div>
  );
}
