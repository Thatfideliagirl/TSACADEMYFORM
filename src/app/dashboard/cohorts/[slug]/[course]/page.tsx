import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/staff";
import { Banner } from "@/components/banner";
import { CopyButton } from "@/components/copy-button";
import { DangerZone } from "@/components/danger-zone";
import { CourseNav } from "@/components/course-nav";
import { courseStats } from "@/lib/course-stats";
import { assignModerator, removeCourseFromCohort, removeModerator, updateCohortCourse } from "@/app/actions/cohorts";

type One<T> = T | T[] | null;
const first = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export default async function CoursePage({ params, searchParams }: {
  params: Promise<{ slug: string; course: string }>; searchParams: Promise<{ error?: string; ok?: string; kind?: string }>;
}) {
  const { slug, course: courseSlug } = await params;
  const { error, ok, kind: kindParam } = await searchParams;
  const kind = kindParam === "assignment" || kindParam === "capstone" ? kindParam : "all";
  const { supabase, profile } = await requireStaff();
  const isAdmin = profile.role === "admin";

  const { data: cohort } = await supabase.from("cohorts").select("id, name, slug").eq("slug", slug).maybeSingle();
  const { data: course } = await supabase.from("courses").select("id, name, slug").eq("slug", courseSlug).maybeSingle();
  if (!cohort || !course) notFound();

  const { data: cc } = await supabase
    .from("cohort_courses")
    .select("id, form_name, form_slug, is_open, cohort_course_moderators(user_id, profiles(full_name, email))")
    .eq("cohort_id", cohort.id).eq("course_id", course.id).maybeSingle();
  if (!cc) notFound();

  const { data: moderators } = isAdmin ? await supabase.from("profiles").select("id, full_name, email").eq("role", "moderator").order("full_name") : { data: [] };
  const mods = (cc.cohort_course_moderators ?? []) as { user_id: string; profiles: One<{ full_name: string; email: string }> }[];
  const assigned = new Set(mods.map((m) => m.user_id));
  const canAdd = (moderators ?? []).filter((m) => !assigned.has(m.id));

  const stats = await courseStats(supabase, cc.id, kind);
  const base = `/dashboard/cohorts/${cohort.slug}/${course.slug}`;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const link = `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}/submit/${cc.form_slug}`;

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
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {([
            ["Students", stats.students, ""],
            ["Submitted", stats.submitted, ""],
            ["Not yet submitted", stats.notSubmitted, stats.notSubmitted > 0 ? "text-navy" : ""],
            ["Marked", stats.graded, ""],
            ["Waiting to be marked", stats.ungraded, stats.ungraded > 0 ? "text-brand" : ""],
            ["Pending requests", stats.pendingRequests, stats.pendingRequests > 0 ? "text-fail" : ""],
          ] as const).map(([label, n, tone]) => (
            <div key={label} className="rounded-2xl border border-line bg-white p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
              <dd className={`mt-1 font-display text-3xl font-semibold ${tone}`}>{n}</dd>
            </div>
          ))}
        </dl>
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
              <input id="form-name" name="form_name" defaultValue={cc.form_name} required
                className="rounded-xl border-[1.5px] border-line px-3 py-2.5 focus:border-brand focus:outline-none" />
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
              <code className="min-w-0 flex-1 truncate text-sm">{link}</code>
              <CopyButton text={link} />
            </div>
            <p className="text-sm text-muted">Share this link with the students of this course. The form itself is built in a later stage. The address is reserved now and will not change.</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-6">
        <h2 className="font-display text-xl font-semibold">Moderators</h2>
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
            <select id="add-mod" name="user_id" required defaultValue=""
              className="min-w-0 flex-1 rounded-xl border-[1.5px] border-line bg-white px-3 py-2.5 focus:border-brand focus:outline-none">
              <option value="" disabled>Choose a moderator</option>
              {canAdd.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
            <button className="rounded-xl bg-brand px-5 py-2.5 font-display font-semibold text-white hover:bg-brand-dark">Add</button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-muted">
            {(moderators ?? []).length ? "Every moderator already has this course." : <>There are no moderators yet. <Link href="/dashboard/people" className="font-semibold text-brand underline">Invite one</Link>.</>}
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
