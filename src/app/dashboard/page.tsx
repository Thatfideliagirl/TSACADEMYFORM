import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { showLagos } from "@/lib/lagos";

type One<T> = T | T[] | null;
const first = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);
type Counts = { cohort_course_id: string; students: number; tasks: number; submissions: number; graded: number; pending_requests: number; waiting_resubmit: number };

// The first page after sign in. Admins see everything, moderators see their own courses. Same page, because the
// database only hands back what each person is allowed to see.
export default async function Overview() {
  const { supabase, profile } = await requireStaff();
  const isAdmin = profile.role === "admin";

  const [{ data: runs }, { data: counts, error: countsError }, { data: recent }, adminBits] = await Promise.all([
    supabase.from("cohort_courses").select("id, form_name, is_open, cohorts(name, slug, is_open), courses(name, slug)").order("created_at", { ascending: false }),
    supabase.rpc("course_counts"),
    supabase.from("submissions")
      .select("id, submitted_at, students(full_name), tasks!inner(title, cohort_courses!inner(cohorts(name, slug), courses(name, slug)))")
      .order("submitted_at", { ascending: false }).limit(6),
    isAdmin
      ? Promise.all([
          supabase.from("cohorts").select("id", { count: "exact", head: true }),
          supabase.from("courses").select("id", { count: "exact", head: true }),
          supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "moderator"),
          supabase.from("invites").select("id", { count: "exact", head: true }).is("used_at", null),
        ])
      : Promise.resolve(null),
  ]);

  const by = new Map(((counts ?? []) as Counts[]).map((c) => [c.cohort_course_id, c]));
  const list = (runs ?? []).map((r) => {
    const c = by.get(r.id);
    return {
      id: r.id, formName: r.form_name, open: r.is_open,
      cohort: first(r.cohorts as One<{ name: string; slug: string; is_open: boolean }>),
      course: first(r.courses as One<{ name: string; slug: string }>),
      students: Number(c?.students ?? 0), tasks: Number(c?.tasks ?? 0), submissions: Number(c?.submissions ?? 0),
      graded: Number(c?.graded ?? 0), pending: Number(c?.pending_requests ?? 0), asked: Number(c?.waiting_resubmit ?? 0),
    };
  });
  const sum = (f: (r: (typeof list)[number]) => number) => list.reduce((n, r) => n + f(r), 0);
  const waiting = sum((r) => r.submissions - r.graded - r.asked);
  const asking = sum((r) => r.asked);
  const pending = sum((r) => r.pending);

  const tiles: [string, string | number, string, string][] = isAdmin && adminBits ? [
    ["Cohorts", adminBits[0].count ?? 0, "", `${new Set(list.filter((r) => r.cohort?.is_open).map((r) => r.cohort?.slug)).size} open`],
    ["Courses running", list.length, "", `${adminBits[1].count ?? 0} in the course list`],
    ["Moderators", adminBits[2].count ?? 0, "", adminBits[3].count ? `${adminBits[3].count} invited, not signed up` : "all signed up"],
    ["Students", sum((r) => r.students), "", "across all courses"],
    ["Submissions", sum((r) => r.submissions), "", "received"],
    ["Waiting to be marked", waiting, waiting > 0 ? "text-brand" : "", "submissions"],
    ["Waiting for resubmission", asking, asking > 0 ? "text-brand" : "", "students to resend"],
    ["Pending requests", pending, pending > 0 ? "text-fail" : "", "to decide"],
  ] : [
    ["Your courses", list.length, "", "given to you"],
    ["Students", sum((r) => r.students), "", "in your courses"],
    ["Submissions", sum((r) => r.submissions), "", "received"],
    ["Waiting to be marked", waiting, waiting > 0 ? "text-brand" : "", "submissions"],
    ["Waiting for resubmission", asking, asking > 0 ? "text-brand" : "", "students to resend"],
    ["Pending requests", pending, pending > 0 ? "text-fail" : "", "to decide"],
  ];

  const attention = list.filter((r) => r.submissions - r.graded - r.asked > 0 || r.pending > 0 || r.asked > 0)
    .sort((a, b) => (b.pending * 1000 + (b.submissions - b.graded - b.asked)) - (a.pending * 1000 + (a.submissions - a.graded - a.asked))).slice(0, 6);
  const href = (r: (typeof list)[number], tail = "") => `/dashboard/cohorts/${r.cohort?.slug}/${r.course?.slug}${tail}`;

  return (
    <div className="flex flex-col gap-10">
      <div>
        <p className="text-sm font-semibold text-brand">{isAdmin ? "Admin" : "Moderator"}</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Hello, {profile.full_name.split(" ")[0]}</h1>
        <p className="mt-1 text-muted">{isAdmin ? "Here is everything that is happening across TS Academy." : "Here is what is happening in your courses."}</p>
      </div>

      {countsError && (
        <p role="alert" className="rounded-xl bg-[#fbe9e6] px-4 py-3 text-sm font-medium text-fail">
          The numbers need one more database update (file 0004 in the SQL list). Until it is run, some numbers here show as zero.
        </p>
      )}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
        {tiles.map(([label, n, tone, note]) => (
          <div key={label} className="rounded-2xl border border-line bg-white p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
            <dd className={`mt-1 font-display text-3xl font-semibold ${tone}`}>{n}</dd>
            <dd className="text-xs text-muted">{note}</dd>
          </div>
        ))}
      </dl>

      {isAdmin && (
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/cohorts" className="w-full rounded-xl bg-brand px-5 py-2.5 text-center font-display font-semibold text-white hover:bg-brand-dark sm:w-auto">Create or open a cohort</Link>
          <Link href="/dashboard/people" className="w-full rounded-xl border-[1.5px] border-line bg-white px-5 py-2.5 text-center font-semibold text-brand hover:bg-sky sm:w-auto">Invite a moderator</Link>
          <Link href="/dashboard/courses" className="w-full rounded-xl border-[1.5px] border-line bg-white px-5 py-2.5 text-center font-semibold text-brand hover:bg-sky sm:w-auto">Manage courses</Link>
        </div>
      )}

      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white px-6 py-10 text-center text-muted">
          {isAdmin ? <>Nothing is running yet. <Link href="/dashboard/cohorts" className="font-semibold text-brand underline">Create your first cohort</Link>.</> : "You have not been given any courses yet. Ask an admin to add you."}
        </p>
      ) : (
        <>
          {attention.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="font-display text-xl font-semibold">Needs your attention</h2>
              <ul className="flex flex-col gap-2">
                {attention.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3">
                    <span><span className="font-semibold">{r.course?.name}</span><span className="text-muted">, {r.cohort?.name}</span></span>
                    <span className="flex flex-wrap gap-2 text-sm font-semibold">
                      {r.submissions - r.graded - r.asked > 0 && <Link href={href(r, "/submissions?graded=ungraded")} className="rounded-full bg-sky px-3 py-1 text-brand hover:bg-sky-deep">{r.submissions - r.graded - r.asked} to mark</Link>}
                      {r.asked > 0 && <Link href={href(r, "/resubmissions")} className="rounded-full bg-sky px-3 py-1 text-brand hover:bg-sky-deep">{r.asked} to resubmit</Link>}
                      {r.pending > 0 && <Link href={href(r, "/requests")} className="rounded-full bg-[#fbe9e6] px-3 py-1 text-fail hover:opacity-80">{r.pending} request{r.pending === 1 ? "" : "s"}</Link>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="flex flex-col gap-3">
            <h2 className="font-display text-xl font-semibold">{isAdmin ? "All courses running" : "Your courses"}</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {list.map((r) => (
                <li key={r.id}>
                  <Link href={href(r)} className="block h-full rounded-2xl border border-line bg-white p-4 transition hover:border-brand hover:shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-display text-lg font-semibold">{r.course?.name}</p>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.open ? "bg-[#e1f2e9] text-pass" : "bg-sky-deep text-muted"}`}>{r.open ? "Open" : "Closed"}</span>
                    </div>
                    <p className="text-sm text-muted">{r.cohort?.name}</p>
                    <p className="mt-2 text-sm text-muted">{r.students} students, {r.tasks} task{r.tasks === 1 ? "" : "s"}, {r.submissions} submitted, {r.graded} marked</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {!!recent?.length && (
            <section className="flex flex-col gap-3">
              <h2 className="font-display text-xl font-semibold">Latest submissions</h2>
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
                {recent.map((s) => {
                  const st = first(s.students as One<{ full_name: string }>);
                  const tk = first(s.tasks as One<{ title: string; cohort_courses: One<{ cohorts: One<{ name: string; slug: string }>; courses: One<{ name: string; slug: string }> }> }>);
                  const cc = first(tk?.cohort_courses ?? null);
                  const ch = first(cc?.cohorts ?? null); const co = first(cc?.courses ?? null);
                  return (
                    <li key={s.id}>
                      <Link href={`/dashboard/cohorts/${ch?.slug}/${co?.slug}/submissions`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-sky/60">
                        <span><span className="font-semibold">{st?.full_name}</span> <span className="text-muted">sent {tk?.title}</span></span>
                        <span className="text-sm text-muted">{co?.name}, {ch?.name}, {showLagos(s.submitted_at)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
