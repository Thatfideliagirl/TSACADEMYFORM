import { requireAdmin } from "@/lib/staff";
import { Banner } from "@/components/banner";
import { addCourse, deleteCourse, renameCourse } from "@/app/actions/courses";

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { error, ok } = await searchParams;
  const { supabase } = await requireAdmin();
  const { data: courses } = await supabase.from("courses").select("id, name, cohort_courses(id)").order("name");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Courses</h1>
        <p className="mt-2 max-w-2xl text-muted">The list of courses TS Academy teaches. Choose the courses of each cohort from this list. Renaming a course does not change any form links.</p>
      </div>

      <Banner error={error} ok={ok} />

      <form action={addCourse} className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-5">
        <div className="flex min-w-56 flex-1 flex-col gap-1.5">
          <label htmlFor="new-course" className="font-display text-lg font-semibold">Add a course</label>
          <input id="new-course" name="name" required placeholder="Digital Marketing"
            className="rounded-xl border-[1.5px] border-line px-3 py-2.5 focus:border-brand focus:outline-none" />
        </div>
        <button className="rounded-xl bg-brand px-5 py-2.5 font-display font-semibold text-white hover:bg-brand-dark">Add course</button>
      </form>

      <ul className="flex flex-col gap-3">
        {(courses ?? []).map((c) => {
          const inUse = (c.cohort_courses ?? []).length;
          return (
            <li key={c.id} className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-4">
              <form action={renameCourse} className="flex min-w-56 flex-1 items-end gap-2">
                <input type="hidden" name="id" value={c.id} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <label htmlFor={`c-${c.id}`} className="text-xs font-semibold text-muted">
                    {inUse ? `In ${inUse} cohort${inUse === 1 ? "" : "s"}` : "Not in any cohort"}
                  </label>
                  <input id={`c-${c.id}`} name="name" defaultValue={c.name} required
                    className="rounded-xl border-[1.5px] border-line px-3 py-2 focus:border-brand focus:outline-none" />
                </div>
                <button className="rounded-lg border-[1.5px] border-line px-3 py-2 text-sm font-semibold text-brand hover:bg-sky">Save</button>
              </form>
              <form action={deleteCourse}>
                <input type="hidden" name="id" value={c.id} />
                <button className="rounded-lg border-[1.5px] border-[#e8b9b2] px-3 py-2 text-sm font-semibold text-fail hover:bg-[#fbe9e6]">Delete</button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
