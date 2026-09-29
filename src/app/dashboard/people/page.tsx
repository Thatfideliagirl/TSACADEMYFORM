import { requireAdmin } from "@/lib/staff";
import { BackLink } from "@/components/back-link";
import { InviteForm, NewCodeButton } from "@/components/invite-forms";

type One<T> = T | T[] | null;
const first = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export default async function PeoplePage() {
  const { supabase } = await requireAdmin();

  const [{ data: staff }, { data: invites }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, role, cohort_course_moderators(cohort_course_id)").order("full_name"),
    supabase.from("invites").select("id, email, role, created_at").is("used_at", null).order("created_at", { ascending: false }),
    supabase.from("cohort_courses").select("id, cohorts(name, created_at), courses(name)").order("created_at", { ascending: false }),
  ]);

  const byCohort = new Map<string, { id: string; label: string }[]>();
  for (const r of rows ?? []) {
    const cohort = first(r.cohorts)?.name ?? "Cohort";
    byCohort.set(cohort, [...(byCohort.get(cohort) ?? []), { id: r.id, label: first(r.courses)?.name ?? "Course" }]);
  }
  const groups = [...byCohort.entries()].map(([cohort, items]) => ({ cohort, items }));

  return (
    <div className="flex flex-col gap-10">
      <div>
        <BackLink href="/dashboard">overview</BackLink>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">People</h1>
        <p className="mt-2 max-w-2xl text-muted">Add the email of the person you want to invite. You get a one time code to give them. They use it to create their own password.</p>
      </div>

      <section className="rounded-2xl border border-line bg-white p-6 sm:p-8">
        <h2 className="mb-5 font-display text-2xl font-semibold">Invite someone</h2>
        <InviteForm groups={groups} />
      </section>

      {!!invites?.length && (
        <section>
          <h2 className="mb-3 font-display text-xl font-semibold">Waiting to sign up</h2>
          <ul className="flex flex-col gap-2">
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3">
                <div><p className="font-semibold">{i.email}</p><p className="text-sm text-muted">{i.role}, invited {new Date(i.created_at).toLocaleDateString()}</p></div>
                <NewCodeButton email={i.email} role={i.role} label="Make a new code" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Active staff</h2>
        <ul className="flex flex-col gap-2">
          {(staff ?? []).map((s) => (
            <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3">
              <div>
                <p className="font-semibold">{s.full_name}</p>
                <p className="text-sm text-muted">{s.email}, {s.role}{s.role === "moderator" && `, ${(s.cohort_course_moderators ?? []).length} course${(s.cohort_course_moderators ?? []).length === 1 ? "" : "s"}`}</p>
              </div>
              <NewCodeButton email={s.email} role={s.role} label="Locked out? New code" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
