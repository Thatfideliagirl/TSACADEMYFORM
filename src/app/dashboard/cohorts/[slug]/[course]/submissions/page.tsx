import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { Banner } from "@/components/banner";
import { CourseNav } from "@/components/course-nav";
import { getCourseContext } from "@/lib/course-context";
import { allTypes } from "@/lib/link-types";
import { showLagos } from "@/lib/lagos";
import { MarkingForm } from "@/components/marking-form";
import { siteOrigin } from "@/lib/origin";

type One<T> = T | T[] | null;
const first = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);
const PAGE = 25;
const field = "rounded-xl border-[1.5px] border-line bg-white px-3 py-2 focus:border-brand focus:outline-none";

type Sp = { error?: string; ok?: string; task?: string; kind?: string; graded?: string; q?: string; page?: string };

export default async function SubmissionsPage({ params, searchParams }: { params: Promise<{ slug: string; course: string }>; searchParams: Promise<Sp> }) {
  const { slug, course: courseSlug } = await params;
  const sp = await searchParams;
  const { supabase, cohort, course, cc } = await getCourseContext(slug, courseSlug);
  const base = `/dashboard/cohorts/${cohort.slug}/${course.slug}`;

  const [{ data: tasks }, { data: customRows }] = await Promise.all([
    supabase.from("tasks").select("id, slug, title, kind").eq("cohort_course_id", cc.id).order("created_at"),
    supabase.from("link_types").select("key, label, domains, hint"),
  ]);
  const types = allTypes(customRows ?? []);
  const labelOf = (k: string) => types.find((t) => t.key === k)?.label ?? k;

  const page = Math.max(1, Number(sp.page) || 1);
  let q = supabase.from("submissions")
    .select("id, task_id, links, unverified_links, submitted_at, reviewed, score, comment, graded_at, changed_after_grading, resubmit_asked, resubmit_links, resubmit_feedback, resubmitted_at, students!inner(full_name, email), tasks!inner(slug, title, kind, max_score, cohort_course_id), graded:profiles!submissions_graded_by_fkey(full_name)", { count: "exact" })
    .eq("tasks.cohort_course_id", cc.id)
    .order("submitted_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (sp.task) q = q.eq("tasks.slug", sp.task);
  if (sp.kind === "assignment" || sp.kind === "capstone") q = q.eq("tasks.kind", sp.kind);
  if (sp.graded === "graded") q = q.not("score", "is", null);
  if (sp.graded === "ungraded") q = q.is("score", null).eq("resubmit_asked", false);
  if (sp.graded === "asked") q = q.eq("resubmit_asked", true);
  if (sp.graded === "resubmitted") q = q.not("resubmitted_at", "is", null).eq("resubmit_asked", false).is("score", null);
  const term = (sp.q ?? "").trim().replace(/[%,()]/g, " ");
  if (term) q = q.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`, { referencedTable: "students" });
  const { data: rows, count } = await q;

  // Notes and requests from students for the submissions on this page.
  const ids = (rows ?? []).map((r) => r.id);
  const { data: reqs } = ids.length
    ? await supabase.from("requests").select("submission_id, kind, link_type, new_url, reason, status").in("submission_id", ids)
    : { data: [] };
  const reqBy = new Map((reqs ?? []).map((r) => [r.submission_id, r]));

  // For work that came back, the link each student had before, so the moderator sees what changed.
  const backIds = (rows ?? []).filter((r) => r.resubmitted_at).map((r) => r.id);
  const { data: hist } = backIds.length
    ? await supabase.from("submission_link_history").select("submission_id, link_type, old_url, changed_at").in("submission_id", backIds).order("changed_at", { ascending: false })
    : { data: [] };
  const beforeBy = new Map<string, string>();
  for (const h of hist ?? []) { const k = `${h.submission_id}:${h.link_type}`; if (!beforeBy.has(k)) beforeBy.set(k, h.old_url); }
  const origin = await siteOrigin();

  // Who ticked "I have emailed the student", and when. Kept separate so this page still works before SQL file 0007 is run.
  const askedIds = (rows ?? []).filter((r) => r.resubmit_asked).map((r) => r.id);
  const { data: mailed } = askedIds.length
    ? await supabase.from("submissions").select("id, resubmit_emailed_at, emailer:profiles!submissions_resubmit_emailed_by_fkey(full_name)").in("id", askedIds).not("resubmit_emailed_at", "is", null)
    : { data: [] };
  const mailedBy = new Map((mailed ?? []).map((m) => [m.id, { at: m.resubmit_emailed_at as string, who: first(m.emailer as One<{ full_name: string }>)?.full_name ?? "a moderator" }]));

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const keep = (extra: Record<string, string>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ task: sp.task, kind: sp.kind, graded: sp.graded, q: sp.q, ...extra })) if (v) u.set(k, v);
    const s = u.toString();
    return s ? `?${s}` : "";
  };
  const returnTo = `${base}/submissions${keep({ page: page > 1 ? String(page) : "" })}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href={base}>{course.name}</BackLink>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Submissions</h1>
        <p className="mt-1 text-muted">{course.name}, {cohort.name}</p>
      </div>
      <CourseNav base={base} active="submissions" />
      <Banner error={sp.error} ok={sp.ok} />

      <form className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-4">
        <div className="flex min-w-[10rem] flex-1 flex-col gap-1"><label htmlFor="f-task" className="text-xs font-semibold text-muted">Task</label>
          <select id="f-task" name="task" defaultValue={sp.task ?? ""} className={field}>
            <option value="">All tasks</option>{(tasks ?? []).map((t) => <option key={t.id} value={t.slug}>{t.title}</option>)}
          </select></div>
        <div className="flex min-w-[10rem] flex-1 flex-col gap-1"><label htmlFor="f-kind" className="text-xs font-semibold text-muted">Type</label>
          <select id="f-kind" name="kind" defaultValue={sp.kind ?? ""} className={field}>
            <option value="">Assignments and capstone</option><option value="assignment">Assignments</option><option value="capstone">Capstone</option>
          </select></div>
        <div className="flex min-w-[10rem] flex-1 flex-col gap-1"><label htmlFor="f-graded" className="text-xs font-semibold text-muted">Marking</label>
          <select id="f-graded" name="graded" defaultValue={sp.graded ?? ""} className={field}>
            <option value="">Marked and unmarked</option><option value="ungraded">Waiting to be marked</option><option value="graded">Marked</option><option value="asked">Asked to resubmit</option><option value="resubmitted">Resubmitted, ready to mark</option>
          </select></div>
        <div className="flex min-w-[10rem] flex-1 flex-col gap-1"><label htmlFor="f-q" className="text-xs font-semibold text-muted">Name or email</label>
          <input id="f-q" name="q" defaultValue={sp.q ?? ""} placeholder="Search" className={field} /></div>
        <div className="flex items-center gap-3">
          <button className="rounded-xl bg-brand px-5 py-2 font-display font-semibold text-white hover:bg-brand-dark">Filter</button>
          <Link href={`${base}/submissions`} className="px-1 py-2 text-sm font-semibold text-brand">Clear</Link>
        </div>
      </form>

      <form action={`${base}/export`} method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-4">
        <div className="flex min-w-[10rem] flex-1 flex-col gap-1"><label htmlFor="x-scope" className="text-xs font-semibold text-muted">Download</label>
          <select id="x-scope" name="scope" defaultValue={sp.task ? `task:${sp.task}` : "all"} className={field}>
            <option value="all">Everything in this course</option>
            <option value="assignments">All assignments</option>
            <option value="capstone">The capstone</option>
            {(tasks ?? []).map((t) => <option key={t.id} value={`task:${t.slug}`}>{t.title}</option>)}
          </select></div>
        <div className="flex min-w-[9rem] flex-col gap-1"><label htmlFor="x-format" className="text-xs font-semibold text-muted">File type</label>
          <select id="x-format" name="format" className={field}><option value="xlsx">Excel (.xlsx)</option><option value="csv">CSV</option></select></div>
        <input type="hidden" name="pick" value="1" />
        <fieldset className="flex w-full flex-col gap-2">
          <legend className="text-xs font-semibold text-muted">What to put in the sheet (name, email, task and date are always there)</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="cols" value="links" defaultChecked /> The links they sent</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="cols" value="score" defaultChecked /> Score and comment</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="cols" value="marking" /> Who marked, reviewed ticks and requests</label>
          </div>
        </fieldset>
        <button className="rounded-xl border-[1.5px] border-brand px-4 py-2 font-semibold text-brand hover:bg-sky">Download spreadsheet</button>
      </form>

      <p className="text-sm text-muted" aria-live="polite">{total} submission{total === 1 ? "" : "s"}{term || sp.task || sp.kind || sp.graded ? " match these filters" : ""}.</p>

      {!rows?.length ? (
        <p className="rounded-2xl border border-dashed border-line bg-white px-6 py-10 text-center text-muted">Nothing to show yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => {
            const st = first(r.students as One<{ full_name: string; email: string }>);
            const tk = first(r.tasks as One<{ slug: string; title: string; kind: string; max_score: number }>);
            const who = first(r.graded as One<{ full_name: string }>);
            const links = r.links as Record<string, string>;
            const reviewed = (r.reviewed ?? {}) as Record<string, boolean>;
            const unverified = (r.unverified_links ?? []) as string[];
            const confirmed = (k: string) => !!reviewed[`opens:${k}`];
            const stillOpen = unverified.filter((k) => !confirmed(k));
            const req = reqBy.get(r.id);
            const marked = r.score !== null;
            return (
              <li key={r.id}>
                <details className="group rounded-2xl border border-line bg-white open:shadow-sm">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0">
                      <span className="block font-display text-lg font-semibold">{st?.full_name}</span>
                      <span className="block truncate text-sm text-muted">{st?.email}</span>
                      <span className="block text-sm text-muted">{tk?.title}, sent {showLagos(r.submitted_at)}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      {r.changed_after_grading && <span className="rounded-full bg-[#fbe9e6] px-2.5 py-0.5 text-xs font-semibold text-fail">Changed after marking</span>}
                      {stillOpen.length > 0
                        ? <span className="rounded-full bg-[#fbe9e6] px-2.5 py-0.5 text-xs font-semibold text-fail">{stillOpen.length} link{stillOpen.length === 1 ? "" : "s"} not verified</span>
                        : <span className="rounded-full bg-[#e1f2e9] px-2.5 py-0.5 text-xs font-semibold text-pass">{unverified.length > 0 ? "Links checked" : "Links verified"}</span>}
                      {req?.status === "pending" && <span className="rounded-full bg-[#fbe9e6] px-2.5 py-0.5 text-xs font-semibold text-fail">Request waiting</span>}
                      {r.resubmit_asked && (mailedBy.has(r.id)
                        ? <span className="rounded-full bg-sky-deep px-2.5 py-0.5 text-xs font-semibold text-brand">Feedback sent</span>
                        : <span className="rounded-full bg-sky-deep px-2.5 py-0.5 text-xs font-semibold text-muted">Feedback not sent yet</span>)}
                      {r.resubmit_asked
                        ? <span className="rounded-full bg-brand px-3 py-1 text-sm font-semibold text-white">Waiting for resubmission</span>
                        : <span className={`rounded-full px-3 py-1 text-sm font-semibold ${marked ? "bg-[#e1f2e9] text-pass" : "bg-sky-deep"}`}>{marked ? `${r.score} / ${tk?.max_score}` : r.resubmitted_at ? "Resubmitted, ready to mark" : "To mark"}</span>}
                    </span>
                  </summary>

                  <MarkingForm
                    submissionId={r.id} returnTo={returnTo} maxScore={tk?.max_score ?? 0} score={r.score}
                    comment={r.comment ?? ""} feedback={r.resubmit_feedback ?? ""} asked={!!r.resubmit_asked}
                    resubmitted={!!r.resubmitted_at && !r.resubmit_asked && (!r.graded_at || r.graded_at < r.resubmitted_at)}
                    emailedInfo={mailedBy.has(r.id) ? `Emailed by ${mailedBy.get(r.id)!.who} on ${showLagos(mailedBy.get(r.id)!.at)}` : null}
                    markedInfo={marked && r.graded_at ? `Marked by ${who?.full_name ?? "a moderator"} on ${showLagos(r.graded_at)}` : null}
                    mail={{ to: st?.email ?? "", firstName: (st?.full_name ?? "").split(" ")[0], taskTitle: tk?.title ?? "", taskLink: `${origin}/submit/${cc.form_slug}/${tk?.slug}` }}
                    links={Object.entries(links).map(([key, url]) => ({
                      key, label: labelOf(key), url, reviewed: !!reviewed[key], unverified: unverified.includes(key), confirmed: confirmed(key),
                      toggled: !!r.resubmit_asked && ((r.resubmit_links ?? []) as string[]).includes(key),
                      before: r.resubmitted_at ? beforeBy.get(`${r.id}:${key}`) ?? null : null,
                    }))}
                  >
                    {req && (
                      <div className="rounded-xl bg-sky px-4 py-3 text-sm">
                        <p className="font-semibold">{req.kind === "note" ? "Note from the student" : `Student asked to replace ${labelOf(req.link_type ?? "")}`}{req.status !== "pending" && `, ${req.status}`}</p>
                        <p className="mt-1 whitespace-pre-line">{req.reason}</p>
                        {req.status === "pending" && <Link href={`${base}/requests`} className="mt-1 inline-block font-semibold text-brand underline">Go to Requests to decide</Link>}
                      </div>
                    )}
                  </MarkingForm>
                </details>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3" aria-label="Pages of submissions">
          {page > 1 ? <Link href={`${base}/submissions${keep({ page: String(page - 1) })}`} className="rounded-lg border-[1.5px] border-line bg-white px-4 py-2 font-semibold text-brand hover:bg-sky">Previous</Link> : <span />}
          <span className="text-sm text-muted">Page {page} of {pages}</span>
          {page < pages ? <Link href={`${base}/submissions${keep({ page: String(page + 1) })}`} className="rounded-lg border-[1.5px] border-line bg-white px-4 py-2 font-semibold text-brand hover:bg-sky">Next</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
