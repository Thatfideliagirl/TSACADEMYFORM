import { BackLink } from "@/components/back-link";
import { CourseNav } from "@/components/course-nav";
import { getCourseContext } from "@/lib/course-context";

const field = "rounded-xl border-[1.5px] border-line bg-white px-3 py-2 focus:border-brand focus:outline-none";

// Students on the list who have not sent the chosen task yet. Good for following up.
export default async function NotSubmittedPage({ params, searchParams }: { params: Promise<{ slug: string; course: string }>; searchParams: Promise<{ task?: string }> }) {
  const { slug, course: courseSlug } = await params;
  const sp = await searchParams;
  const { supabase, cohort, course, cc } = await getCourseContext(slug, courseSlug);
  const base = `/dashboard/cohorts/${cohort.slug}/${course.slug}`;

  const { data: tasks } = await supabase.from("tasks").select("id, slug, title").eq("cohort_course_id", cc.id).order("created_at");
  const task = (tasks ?? []).find((t) => t.slug === sp.task) ?? (tasks ?? [])[0];

  let missing: { full_name: string; email: string }[] = [];
  let total = 0;
  if (task) {
    const students: { id: string; full_name: string; email: string }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase.from("students").select("id, full_name, email").eq("cohort_course_id", cc.id).order("full_name").range(from, from + 999);
      students.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    const done = new Set<string>();
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase.from("submissions").select("student_id").eq("task_id", task.id).range(from, from + 999);
      (data ?? []).forEach((r) => done.add(r.student_id));
      if (!data || data.length < 1000) break;
    }
    total = students.length;
    missing = students.filter((s) => !done.has(s.id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href={base}>{course.name}</BackLink>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Not submitted</h1>
        <p className="mt-1 text-muted">{course.name}, {cohort.name}</p>
      </div>
      <CourseNav base={base} active="not-submitted" />

      {!task ? (
        <p className="rounded-2xl border border-dashed border-line bg-white px-6 py-10 text-center text-muted">There are no tasks yet, so nobody is missing anything.</p>
      ) : (
        <>
          <form className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-4">
            <div className="flex min-w-56 flex-1 flex-col gap-1">
              <label htmlFor="task" className="text-xs font-semibold text-muted">Which task?</label>
              <select id="task" name="task" defaultValue={task.slug} className={field}>{(tasks ?? []).map((t) => <option key={t.id} value={t.slug}>{t.title}</option>)}</select>
            </div>
            <button className="rounded-xl bg-brand px-4 py-2 font-display font-semibold text-white hover:bg-brand-dark">Show</button>
          </form>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p><span className="font-display text-2xl font-semibold">{missing.length}</span> of {total} students have not sent <span className="font-semibold">{task.title}</span>.</p>
            {missing.length > 0 && (
              <div className="flex gap-2">
                <a href={`${base}/export?missing=1&task=${task.slug}&format=xlsx`} className="rounded-lg border-[1.5px] border-brand px-3 py-2 text-sm font-semibold text-brand hover:bg-sky">Download Excel</a>
                <a href={`${base}/export?missing=1&task=${task.slug}&format=csv`} className="rounded-lg border-[1.5px] border-line px-3 py-2 text-sm font-semibold text-brand hover:bg-sky">Download CSV</a>
              </div>
            )}
          </div>

          {missing.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line bg-white px-6 py-10 text-center text-pass font-semibold">Everyone has submitted this task.</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
              {missing.map((s) => (
                <li key={s.email} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
                  <span className="font-semibold">{s.full_name}</span><span className="text-sm text-muted">{s.email}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
