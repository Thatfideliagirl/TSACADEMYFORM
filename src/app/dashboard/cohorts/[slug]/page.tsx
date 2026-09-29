import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/staff";
import { Banner } from "@/components/banner";
import { DangerZone } from "@/components/danger-zone";
import { addCourseToCohort, deleteCohort, updateCohort } from "@/app/actions/cohorts";

type One<T> = T | T[] | null;
const first = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export default async function CohortPage({ params, searchParams }: {
  params: Promise<{ slug: string }>; searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { slug } = await params;
  const { error, ok } = await searchParams;
  const { supabase, profile } = await requireStaff();
  const isAdmin = profile.role === "admin";

  // The cohort, its courses and their moderators come back in one trip.
  const [{ data: cohort }, { data: allCourses }] = await Promise.all([
    supabase.from("cohorts")
      .select("id, name, slug, is_open, cohort_courses(id, form_name, is_open, created_at, courses(id, name, slug), cohort_course_moderators(user_id, profiles(full_name)))")
      .eq("slug", slug).maybeSingle(),
    isAdmin ? supabase.from("courses").select("id, name").order("name") : Promise.resolve({ data: [] }),
  ]);
  if (!cohort) notFound();
  const rows = [...(cohort.cohort_courses ?? [])].sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)));

  const used = new Set((rows ?? []).map((r) => first(r.courses)?.id));
  const freeCourses = (allCourses ?? []).filter((c) => !used.has(c.id));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <BackLink href="/dashboard/cohorts">cohorts</BackLink>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{cohort.name}</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cohort.is_open ? "bg-[#e1f2e9] text-pass" : "bg-sky-deep text-muted"}`}>{cohort.is_open ? "Open" : "Closed"}</span>
        </div>
        <p className="mt-2 max-w-2xl text-muted">Open a course to see its form link, moderators and settings.</p>
      </div>

      <Banner error={error} ok={ok} />

      {!rows?.length ? (
        <p className="rounded-2xl border border-dashed border-line bg-white px-6 py-10 text-center text-muted">
          {isAdmin ? "No courses in this cohort yet. Add one below." : "You have no courses in this cohort."}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {rows.map((r) => {
            const course = first(r.courses);
            const modTotal = (r.cohort_course_moderators ?? []).length;
            const modNames = (r.cohort_course_moderators ?? []).map((m) => first(m.profiles)?.full_name).filter(Boolean) as string[];
            const modText = !modTotal ? "No moderator yet" : `Moderator${modTotal === 1 ? "" : "s"}: ${[...modNames, ...(modTotal > modNames.length ? [`${modTotal - modNames.length} more`] : [])].join(", ")}`;
            return (
              <li key={r.id}>
                <Link href={`/dashboard/cohorts/${cohort.slug}/${course?.slug}`} className="block h-full rounded-2xl border border-line bg-white p-5 transition hover:border-brand hover:shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-display text-xl font-semibold">{course?.name}</h2>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.is_open ? "bg-[#e1f2e9] text-pass" : "bg-sky-deep text-muted"}`}>{r.is_open ? "Open" : "Closed"}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted">Form: {r.form_name}</p>
                  <p className="text-sm text-muted">{modText}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {isAdmin && (
        <>
          {freeCourses.length > 0 && (
            <form action={addCourseToCohort} className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-5">
              <input type="hidden" name="cohort_id" value={cohort.id} />
              <input type="hidden" name="cohort_slug" value={cohort.slug} />
              <div className="flex min-w-56 flex-1 flex-col gap-1.5">
                <label htmlFor="add-course" className="font-display text-lg font-semibold">Add a course to this cohort</label>
                <select id="add-course" name="course_id" required defaultValue=""
                  className="rounded-xl border-[1.5px] border-line bg-white px-3 py-2.5 focus:border-brand focus:outline-none">
                  <option value="" disabled>Choose a course</option>
                  {freeCourses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <button className="rounded-xl bg-brand px-5 py-2.5 font-display font-semibold text-white hover:bg-brand-dark">Add course</button>
            </form>
          )}
          <p className="text-sm text-muted">
            Need a course that is not in the list? <Link href="/dashboard/courses" className="font-semibold text-brand underline">Add it under Courses</Link>.
          </p>

          <form action={updateCohort} className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5">
            <h2 className="font-display text-lg font-semibold">Edit this cohort</h2>
            <input type="hidden" name="cohort_id" value={cohort.id} />
            <input type="hidden" name="cohort_slug" value={cohort.slug} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cohort-name" className="text-sm font-semibold">Name</label>
              <input id="cohort-name" name="name" defaultValue={cohort.name} required
                className="rounded-xl border-[1.5px] border-line px-3 py-2.5 focus:border-brand focus:outline-none" />
            </div>
            <label className="flex items-center gap-3 font-medium">
              <input type="checkbox" name="is_open" defaultChecked={cohort.is_open} className="h-5 w-5 accent-brand" />
              Cohort is open
            </label>
            <button className="self-start rounded-xl bg-brand px-5 py-2.5 font-display font-semibold text-white hover:bg-brand-dark">Save changes</button>
          </form>

          <DangerZone title="Delete this cohort" confirmWord={cohort.name} action={deleteCohort} buttonLabel="Delete cohort for good"
            warning="This removes the cohort, all its courses, student lists, tasks and submissions. It cannot be undone.">
            <input type="hidden" name="cohort_id" value={cohort.id} />
            <input type="hidden" name="cohort_slug" value={cohort.slug} />
          </DangerZone>
        </>
      )}
    </div>
  );
}
