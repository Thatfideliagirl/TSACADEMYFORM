import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/staff";
import { CopyButton } from "@/components/copy-button";
import { addCourseToCohort, assignModerator, removeModerator, renameForm } from "@/app/actions/cohorts";

type One<T> = T | T[] | null;
const first = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export default async function CohortPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, profile } = await requireStaff();
  const isAdmin = profile.role === "admin";

  const { data: cohort } = await supabase.from("cohorts").select("id, name, slug, is_open").eq("slug", slug).maybeSingle();
  if (!cohort) notFound();

  const { data: rows } = await supabase
    .from("cohort_courses")
    .select("id, form_name, form_slug, is_open, courses(id, name), cohort_course_moderators(user_id, profiles(full_name, email))")
    .eq("cohort_id", cohort.id)
    .order("created_at");
  const { data: allCourses } = isAdmin ? await supabase.from("courses").select("id, name").order("name") : { data: [] };
  const { data: moderators } = isAdmin ? await supabase.from("profiles").select("id, full_name, email").eq("role", "moderator").order("full_name") : { data: [] };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const origin = `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;

  const usedCourseIds = new Set((rows ?? []).map((r) => first(r.courses)?.id));
  const freeCourses = (allCourses ?? []).filter((c) => !usedCourseIds.has(c.id));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/dashboard" className="text-sm font-semibold text-brand">← All cohorts</Link>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">{cohort.name}</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Each course below has its own form link, student list and tasks. Student lists and tasks arrive in the next stages.
        </p>
      </div>

      {!rows?.length && (
        <p className="rounded-2xl border border-dashed border-line bg-white px-6 py-10 text-center text-muted">
          {isAdmin ? "No courses in this cohort yet. Add one below." : "You have no courses in this cohort."}
        </p>
      )}

      <ul className="flex flex-col gap-5">
        {(rows ?? []).map((r) => {
          const course = first(r.courses);
          const link = `${origin}/submit/${r.form_slug}`;
          const mods = (r.cohort_course_moderators ?? []) as { user_id: string; profiles: One<{ full_name: string; email: string }> }[];
          const assignedIds = new Set(mods.map((m) => m.user_id));
          const canAdd = (moderators ?? []).filter((m) => !assignedIds.has(m.id));
          return (
            <li key={r.id} className="rounded-2xl border border-line bg-white p-6">
              <h2 className="font-display text-2xl font-semibold">{course?.name}</h2>

              <div className="mt-5 grid gap-6 md:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <form action={renameForm} className="flex flex-col gap-1.5">
                    <input type="hidden" name="cohort_course_id" value={r.id} />
                    <input type="hidden" name="cohort_slug" value={cohort.slug} />
                    <label htmlFor={`fn-${r.id}`} className="text-sm font-semibold">Form name students will see</label>
                    <div className="flex gap-2">
                      <input id={`fn-${r.id}`} name="form_name" defaultValue={r.form_name}
                        className="min-w-0 flex-1 rounded-xl border-[1.5px] border-line px-3 py-2 focus:border-brand focus:outline-none" />
                      <button className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark">Save</button>
                    </div>
                  </form>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold">Form link for this course</span>
                    <div className="flex items-center gap-2 rounded-xl bg-sky px-3 py-2">
                      <code className="min-w-0 flex-1 truncate text-sm">{link}</code>
                      <CopyButton text={link} />
                    </div>
                    <span className="text-xs text-muted">The form itself is built in a later stage. The link is reserved for it now.</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <span className="text-sm font-semibold">Moderators</span>
                  {mods.length === 0 ? (
                    <p className="text-sm text-muted">No moderator assigned yet.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {mods.map((m) => {
                        const p = first(m.profiles);
                        return (
                          <li key={m.user_id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 text-sm">
                            <span className="min-w-0"><span className="font-semibold">{p?.full_name ?? "Moderator"}</span>{p?.email && <span className="block truncate text-muted">{p.email}</span>}</span>
                            {isAdmin && (
                              <form action={removeModerator}>
                                <input type="hidden" name="cohort_course_id" value={r.id} />
                                <input type="hidden" name="user_id" value={m.user_id} />
                                <input type="hidden" name="cohort_slug" value={cohort.slug} />
                                <button className="font-semibold text-fail">Remove</button>
                              </form>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {isAdmin && (canAdd.length ? (
                    <form action={assignModerator} className="flex gap-2">
                      <input type="hidden" name="cohort_course_id" value={r.id} />
                      <input type="hidden" name="cohort_slug" value={cohort.slug} />
                      <label htmlFor={`am-${r.id}`} className="sr-only">Add a moderator</label>
                      <select id={`am-${r.id}`} name="user_id" required defaultValue=""
                        className="min-w-0 flex-1 rounded-xl border-[1.5px] border-line bg-white px-3 py-2 focus:border-brand focus:outline-none">
                        <option value="" disabled>Choose a moderator</option>
                        {canAdd.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                      </select>
                      <button className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark">Add</button>
                    </form>
                  ) : (
                    <p className="text-sm text-muted">
                      {(moderators ?? []).length ? "Every moderator is already on this course." : <>No moderators yet. <Link href="/dashboard/people" className="font-semibold text-brand underline">Invite one</Link>.</>}
                    </p>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {isAdmin && freeCourses.length > 0 && (
        <form action={addCourseToCohort} className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-5">
          <input type="hidden" name="cohort_id" value={cohort.id} />
          <input type="hidden" name="cohort_slug" value={cohort.slug} />
          <div className="flex min-w-56 flex-1 flex-col gap-1.5">
            <label htmlFor="add-course" className="text-sm font-semibold">Add another course to this cohort</label>
            <select id="add-course" name="course_id" required defaultValue=""
              className="rounded-xl border-[1.5px] border-line bg-white px-3 py-2.5 focus:border-brand focus:outline-none">
              <option value="" disabled>Choose a course</option>
              {freeCourses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <button className="rounded-xl bg-brand px-5 py-2.5 font-display font-semibold text-white hover:bg-brand-dark">Add course</button>
        </form>
      )}
    </div>
  );
}
