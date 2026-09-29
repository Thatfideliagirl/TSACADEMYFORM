import { BackLink } from "@/components/back-link";
import { Banner } from "@/components/banner";
import { CourseNav } from "@/components/course-nav";
import { getCourseContext } from "@/lib/course-context";
import { allTypes } from "@/lib/link-types";
import { showLagos } from "@/lib/lagos";
import { decideRequest } from "@/app/actions/requests";

type One<T> = T | T[] | null;
const first = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export default async function RequestsPage({ params, searchParams }: { params: Promise<{ slug: string; course: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { slug, course: courseSlug } = await params;
  const sp = await searchParams;
  const { supabase, cohort, course, cc } = await getCourseContext(slug, courseSlug);
  const base = `/dashboard/cohorts/${cohort.slug}/${course.slug}`;

  const select = "id, kind, link_type, new_url, reason, status, created_at, decided_at, students!inner(full_name, email), tasks!inner(title, cohort_course_id), submissions(links, score)";
  const [{ data: pending }, { data: decided }, { data: customRows }] = await Promise.all([
    supabase.from("requests").select(select).eq("tasks.cohort_course_id", cc.id).eq("status", "pending").order("created_at"),
    supabase.from("requests").select(select).eq("tasks.cohort_course_id", cc.id).neq("status", "pending").order("decided_at", { ascending: false }).limit(50),
    supabase.from("link_types").select("key, label, domains, hint"),
  ]);
  const types = allTypes(customRows ?? []);
  const labelOf = (k: string | null) => types.find((t) => t.key === k)?.label ?? k ?? "";
  const returnTo = `${base}/requests`;

  const Card = ({ r, open }: { r: NonNullable<typeof pending>[number]; open: boolean }) => {
    const st = first(r.students as One<{ full_name: string; email: string }>);
    const tk = first(r.tasks as One<{ title: string }>);
    const sub = first(r.submissions as One<{ links: Record<string, string>; score: number | null }>);
    const oldUrl = r.link_type ? sub?.links?.[r.link_type] : undefined;
    return (
      <li className="rounded-2xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><p className="font-display text-lg font-semibold">{st?.full_name}</p><p className="text-sm text-muted">{st?.email}, {tk?.title}</p></div>
          <span className="text-sm text-muted">{showLagos(r.created_at)}</span>
        </div>
        <p className="mt-3 text-sm font-semibold">{r.kind === "replace_link" ? `Wants to replace their ${labelOf(r.link_type)} link` : "Left a note"}</p>
        <blockquote className="mt-2 whitespace-pre-line rounded-xl bg-sky px-4 py-3 text-[15px]">{r.reason}</blockquote>
        {r.kind === "replace_link" && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 rounded-xl border border-line p-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted">Old link</p><p className="mt-1 break-all text-sm">{oldUrl}</p>
              {oldUrl && <a href={oldUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-semibold text-brand underline">Open</a>}</div>
            <div className="min-w-0 rounded-xl border-[1.5px] border-brand p-3"><p className="text-xs font-semibold uppercase tracking-wide text-brand">New link</p><p className="mt-1 break-all text-sm">{r.new_url}</p>
              {r.new_url && <a href={r.new_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-semibold text-brand underline">Open</a>}</div>
          </div>
        )}
        {r.kind === "replace_link" && sub?.score !== null && sub?.score !== undefined && open && <p className="mt-3 text-sm text-navy">This was already marked. If you allow it, it will be flagged so you can check it again.</p>}
        {open ? (
          <form action={decideRequest} className="mt-4 flex flex-wrap gap-2">
            <input type="hidden" name="request_id" value={r.id} /><input type="hidden" name="return_to" value={returnTo} />
            <button name="decision" value="approve" className="rounded-xl bg-brand px-5 py-2.5 font-display font-semibold text-white hover:bg-brand-dark">{r.kind === "replace_link" ? "Allow" : "Mark as read"}</button>
            {r.kind === "replace_link" && <button name="decision" value="decline" className="rounded-xl border-[1.5px] border-line px-5 py-2.5 font-semibold text-fail hover:bg-[#fbe9e6]">Decline</button>}
          </form>
        ) : (
          <p className={`mt-3 text-sm font-semibold ${r.status === "approved" ? "text-pass" : "text-fail"}`}>{r.status === "approved" ? (r.kind === "note" ? "Read" : "Allowed") : "Declined"}{r.decided_at && `, ${showLagos(r.decided_at)}`}</p>
        )}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href={base}>{course.name}</BackLink>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Requests</h1>
        <p className="mt-1 text-muted">Each student gets one request per task: replace a link, or leave a note.</p>
      </div>
      <CourseNav base={base} active="requests" pending={pending?.length ?? 0} />
      <Banner error={sp.error} ok={sp.ok} />

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold">Waiting for you</h2>
        {!pending?.length ? <p className="rounded-2xl border border-dashed border-line bg-white px-6 py-8 text-center text-muted">No requests are waiting.</p>
          : <ul className="flex flex-col gap-3">{pending.map((r) => <Card key={r.id} r={r} open />)}</ul>}
      </section>
      {!!decided?.length && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-semibold">Decided</h2>
          <ul className="flex flex-col gap-3">{decided.map((r) => <Card key={r.id} r={r as NonNullable<typeof pending>[number]} open={false} />)}</ul>
        </section>
      )}
    </div>
  );
}
