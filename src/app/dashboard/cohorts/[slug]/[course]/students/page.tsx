import Link from "next/link";
import { getCourseContext } from "@/lib/course-context";
import { Banner } from "@/components/banner";
import { RosterUploader } from "@/components/roster-uploader";
import { addStudent, deleteStudent, updateStudent } from "@/app/actions/students";

const input = "min-w-0 rounded-xl border-[1.5px] border-line bg-white px-3 py-2 focus:border-brand focus:outline-none";

export default async function StudentsPage({ params, searchParams }: {
  params: Promise<{ slug: string; course: string }>; searchParams: Promise<{ error?: string; ok?: string; q?: string }>;
}) {
  const { slug, course: courseSlug } = await params;
  const { error, ok, q } = await searchParams;
  const { supabase, cohort, course, cc } = await getCourseContext(slug, courseSlug);

  const emails: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from("students").select("email").eq("cohort_course_id", cc.id).range(from, from + 999);
    emails.push(...(data ?? []).map((r) => r.email));
    if (!data || data.length < 1000) break;
  }

  let query = supabase.from("students").select("id, full_name, email").eq("cohort_course_id", cc.id).order("full_name").limit(300);
  const term = (q ?? "").trim().replace(/[%,()]/g, " ");
  if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
  const { data: students } = await query;

  const hidden = { cohort_slug: cohort.slug, course_slug: course.slug, cohort_course_id: cc.id };
  const hiddenFields = Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href={`/dashboard/cohorts/${cohort.slug}/${course.slug}`} className="text-sm font-semibold text-brand">← {course.name}, {cohort.name}</Link>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Students</h1>
        <p className="mt-2 max-w-2xl text-muted">
          This is the list the form checks. A student can only submit if the name and email they type match a row here.
          {" "}<span className="font-semibold text-navy">{emails.length} student{emails.length === 1 ? "" : "s"}</span> on this list.
        </p>
      </div>

      <Banner error={error} ok={ok} />

      <section className="rounded-2xl border border-line bg-white p-6">
        <h2 className="mb-4 font-display text-xl font-semibold">Upload a list</h2>
        <RosterUploader cohortCourseId={cc.id} existingEmails={emails} />
      </section>

      <form action={addStudent} className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-5">
        {hiddenFields}
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <label htmlFor="new-name" className="text-sm font-semibold">Add one student: full name</label>
          <input id="new-name" name="full_name" required className={input} />
        </div>
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <label htmlFor="new-email" className="text-sm font-semibold">Email</label>
          <input id="new-email" name="email" type="email" required className={input} />
        </div>
        <button className="rounded-xl bg-brand px-5 py-2.5 font-display font-semibold text-white hover:bg-brand-dark">Add</button>
      </form>

      <section className="flex flex-col gap-3">
        <form className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-56 flex-1 flex-col gap-1.5">
            <label htmlFor="search" className="text-sm font-semibold">Find a student</label>
            <input id="search" name="q" defaultValue={q ?? ""} placeholder="Name or email" className={input} />
          </div>
          <button className="rounded-xl border-[1.5px] border-line px-4 py-2 font-semibold text-brand hover:bg-sky">Search</button>
          {term && <Link href={`/dashboard/cohorts/${cohort.slug}/${course.slug}/students`} className="px-2 py-2 text-sm font-semibold text-brand">Clear</Link>}
        </form>

        {!students?.length ? (
          <p className="rounded-2xl border border-dashed border-line bg-white px-6 py-10 text-center text-muted">
            {term ? "No student matches that search." : "No students yet. Upload a list above, or add one."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {students.map((s) => (
              <li key={s.id} className="flex flex-wrap items-end gap-2 rounded-xl border border-line bg-white p-3">
                <form action={updateStudent} className="flex min-w-0 flex-1 flex-wrap items-end gap-2">
                  {hiddenFields}<input type="hidden" name="id" value={s.id} />
                  <div className="flex min-w-40 flex-1 flex-col gap-1">
                    <label htmlFor={`n-${s.id}`} className="sr-only">Full name</label>
                    <input id={`n-${s.id}`} name="full_name" defaultValue={s.full_name} required className={input} />
                  </div>
                  <div className="flex min-w-40 flex-1 flex-col gap-1">
                    <label htmlFor={`e-${s.id}`} className="sr-only">Email</label>
                    <input id={`e-${s.id}`} name="email" type="email" defaultValue={s.email} required className={input} />
                  </div>
                  <button className="rounded-lg border-[1.5px] border-line px-3 py-2 text-sm font-semibold text-brand hover:bg-sky">Save</button>
                </form>
                <form action={deleteStudent}>
                  {hiddenFields}<input type="hidden" name="id" value={s.id} />
                  <button className="rounded-lg border-[1.5px] border-[#e8b9b2] px-3 py-2 text-sm font-semibold text-fail hover:bg-[#fbe9e6]">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        {emails.length > 300 && !term && <p className="text-sm text-muted">Showing the first 300 students. Use the search to find others.</p>}
      </section>
    </div>
  );
}
