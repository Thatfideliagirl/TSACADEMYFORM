import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { CreateCohortForm } from "@/components/create-cohort-form";

export const metadata = { title: "Cohorts | TS Academy Submit" };

export default async function CohortsPage() {
  const { supabase, profile } = await requireStaff();
  const isAdmin = profile.role === "admin";

  // The security rules mean a moderator only gets back the cohorts and courses given to them.
  const [{ data: cohorts }, { data: courses }] = await Promise.all([
    supabase.from("cohorts").select("id, name, slug, is_open, created_at, cohort_courses(id, courses(name))").order("created_at", { ascending: false }),
    isAdmin ? supabase.from("courses").select("id, name").order("name") : Promise.resolve({ data: [] }),
  ]);

  return (
    <div className="flex flex-col gap-12">
      <section>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{isAdmin ? "Cohorts" : "Your cohorts"}</h1>
        <p className="mt-2 text-muted">
          {isAdmin ? "Open a cohort to see its courses, form links and moderators." : "These are the cohorts and courses your admin gave you."}
        </p>

        {!cohorts?.length ? (
          <p className="mt-6 rounded-2xl border border-dashed border-line bg-white px-6 py-10 text-center text-muted">
            {isAdmin ? "No cohorts yet. Create the first one below." : "You have not been given any courses yet. Ask an admin to add you to a cohort."}
          </p>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {cohorts.map((c) => {
              const names = (c.cohort_courses ?? []).map((cc: { courses: { name: string } | { name: string }[] | null }) =>
                Array.isArray(cc.courses) ? cc.courses[0]?.name : cc.courses?.name).filter(Boolean);
              return (
                <li key={c.id}>
                  <Link href={`/dashboard/cohorts/${c.slug}`} className="block h-full rounded-2xl border border-line bg-white p-5 transition hover:border-brand hover:shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-display text-xl font-semibold">{c.name}</h2>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.is_open ? "bg-[#e1f2e9] text-pass" : "bg-sky-deep text-muted"}`}>{c.is_open ? "Open" : "Closed"}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted">{names.length ? names.join(", ") : "No courses yet"}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {isAdmin && (
        <section className="rounded-2xl border border-line bg-white p-6 sm:p-8">
          <h2 className="font-display text-2xl font-semibold">Create a cohort</h2>
          <p className="mb-6 mt-1 text-muted">Each course gets its own form link, student list and tasks.</p>
          <CreateCohortForm courses={courses ?? []} />
        </section>
      )}
    </div>
  );
}
