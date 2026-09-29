import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { CourseNav } from "@/components/course-nav";
import { getCourseContext } from "@/lib/course-context";
import { allTypes } from "@/lib/link-types";
import { showLagos } from "@/lib/lagos";

type One<T> = T | T[] | null;
const first = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);

// Students a moderator held back: first those who still have to send new links, then those who have sent them and wait to be marked.
export default async function ResubmissionsPage({ params }: { params: Promise<{ slug: string; course: string }> }) {
  const { slug, course: courseSlug } = await params;
  const { supabase, cohort, course, cc } = await getCourseContext(slug, courseSlug);
  const base = `/dashboard/cohorts/${cohort.slug}/${course.slug}`;

  const [{ data: rows }, { data: customRows }] = await Promise.all([
    supabase.from("submissions")
      .select("id, score, graded_at, resubmit_asked, resubmit_links, resubmit_feedback, resubmit_asked_at, resubmit_count, resubmitted_at, students!inner(full_name, email), tasks!inner(slug, title, cohort_course_id)")
      .eq("tasks.cohort_course_id", cc.id)
      .or("resubmit_asked.eq.true,resubmitted_at.not.is.null")
      .order("resubmit_asked_at", { ascending: false, nullsFirst: false }).limit(200),
    supabase.from("link_types").select("key, label, domains, hint"),
  ]);
  const types = allTypes(customRows ?? []);
  const labelOf = (k: string) => types.find((t) => t.key === k)?.label ?? k;

  // Who ticked "I have emailed the student". Separate so the page works before SQL file 0007 is run.
  const { data: mailed } = await supabase.from("submissions")
    .select("id, resubmit_emailed_at, emailer:profiles!submissions_resubmit_emailed_by_fkey(full_name)").in("id", (rows ?? []).map((r) => r.id)).not("resubmit_emailed_at", "is", null);
  const mailedBy = new Map((mailed ?? []).map((m) => [m.id, { at: m.resubmit_emailed_at as string, who: first(m.emailer as One<{ full_name: string }>)?.full_name ?? "a moderator" }]));

  const all = rows ?? [];
  const waiting = all.filter((r) => r.resubmit_asked);
  const back = all.filter((r) => !r.resubmit_asked && r.resubmitted_at && (!r.graded_at || r.graded_at < r.resubmitted_at));

  const card = (r: (typeof all)[number], kind: "waiting" | "back") => {
    const st = first(r.students as One<{ full_name: string; email: string }>);
    const tk = first(r.tasks as One<{ slug: string; title: string }>);
    const filter = `${base}/submissions?graded=${kind === "waiting" ? "asked" : "resubmitted"}&task=${tk?.slug}&q=${encodeURIComponent(st?.email ?? "")}`;
    return (
      <li key={r.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold">{st?.full_name}</p>
            <p className="truncate text-sm text-muted">{st?.email}</p>
            <p className="text-sm text-muted">{tk?.title}{r.resubmit_asked_at ? `, asked ${showLagos(r.resubmit_asked_at)}` : ""}</p>
          </div>
          {kind === "waiting"
            ? <span className="rounded-full bg-brand px-3 py-1 text-sm font-semibold text-white">Waiting for resubmission</span>
            : <span className="rounded-full bg-[#e1f2e9] px-3 py-1 text-sm font-semibold text-pass">Resubmitted, ready to mark</span>}
        </div>
        {kind === "waiting" && (
          <p className={`text-sm font-semibold ${mailedBy.has(r.id) ? "text-brand" : "text-muted"}`}>
            {mailedBy.has(r.id) ? `Feedback sent: emailed by ${mailedBy.get(r.id)!.who} on ${showLagos(mailedBy.get(r.id)!.at)}` : "Feedback not sent yet"}
          </p>
        )}
        {kind === "waiting" && <p className="text-sm">To fix: <span className="font-semibold">{((r.resubmit_links ?? []) as string[]).map(labelOf).join(", ")}</span></p>}
        {r.resubmit_feedback && <p className="whitespace-pre-line rounded-xl bg-sky px-4 py-3 text-sm">{r.resubmit_feedback}</p>}
        <Link href={filter} className="self-start rounded-lg border-[1.5px] border-brand px-4 py-1.5 text-sm font-semibold text-brand hover:bg-sky">
          {kind === "waiting" ? "Open in Submissions" : "Open and mark"}
        </Link>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href={base}>{course.name}</BackLink>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Resubmissions</h1>
        <p className="mt-1 text-muted">{course.name}, {cohort.name}</p>
      </div>
      <CourseNav base={base} active="resubmissions" resubmit={waiting.length} />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-4">
        <span className="text-sm font-semibold">Download this list</span>
        <a href={`${base}/export?resubmissions=1&format=xlsx`} className="rounded-lg border-[1.5px] border-brand px-3 py-2 text-sm font-semibold text-brand hover:bg-sky">Excel</a>
        <a href={`${base}/export?resubmissions=1&format=csv`} className="rounded-lg border-[1.5px] border-line px-3 py-2 text-sm font-semibold text-brand hover:bg-sky">CSV</a>
        <span className="text-sm text-muted">Names, emails, tasks, your feedback and whether it was emailed.</span>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold">Waiting for the student ({waiting.length})</h2>
        {waiting.length ? <ul className="flex flex-col gap-3">{waiting.map((r) => card(r, "waiting"))}</ul>
          : <p className="rounded-2xl border border-dashed border-line bg-white px-6 py-8 text-center text-muted">Nobody is waiting to resubmit. To ask a student, open their row in Submissions and switch on Resubmit for the link that was wrong.</p>}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold">Sent again, ready to mark ({back.length})</h2>
        {back.length ? <ul className="flex flex-col gap-3">{back.map((r) => card(r, "back"))}</ul>
          : <p className="rounded-2xl border border-dashed border-line bg-white px-6 py-8 text-center text-muted">Nothing has come back yet.</p>}
      </section>
    </div>
  );
}
