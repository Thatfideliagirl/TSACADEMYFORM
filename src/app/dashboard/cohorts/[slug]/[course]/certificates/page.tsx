import Link from "next/link";
import { redirect } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { Banner } from "@/components/banner";
import { CopyButton } from "@/components/copy-button";
import { CourseNav } from "@/components/course-nav";
import { CertificateList } from "@/components/certificate-list";
import { getCourseContext } from "@/lib/course-context";
import { siteOrigin } from "@/lib/origin";
import { formatIssueDate } from "@/lib/certificate-render";
import { addAllMarkedCapstones } from "@/app/actions/certificates";

type One<T> = T | T[] | null;
const first = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);

// Students approved for a certificate, who has been issued, and the link they use to collect it.
export default async function CertificatesPage({ params, searchParams }: { params: Promise<{ slug: string; course: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { slug, course: courseSlug } = await params;
  const { error, ok } = await searchParams;
  const { supabase, profile, cohort, course, cc } = await getCourseContext(slug, courseSlug);
  const base = `/dashboard/cohorts/${cohort.slug}/${course.slug}`;
  // Only admins issue certificates. Moderators add students from Submissions.
  if (profile.role !== "admin") redirect(base);

  const [{ data: rows }, { data: tpl }, origin] = await Promise.all([
    supabase.from("certificates").select("id, status, issue_date, students(full_name, email)").eq("cohort_course_id", cc.id).order("added_at"),
    supabase.from("certificate_templates").select("course_id").eq("course_id", course.id).maybeSingle(),
    siteOrigin(),
  ]);
  const link = `${origin}/certificate/${cc.form_slug}`;
  const list = (rows ?? []).map((r) => {
    const st = first(r.students as One<{ full_name: string; email: string }>);
    return { id: r.id, name: st?.full_name ?? "", email: st?.email ?? "", status: r.status as "approved" | "issued", issueDate: r.issue_date as string | null, shownDate: r.issue_date ? formatIssueDate(r.issue_date, "long") : "" };
  }).sort((a, b) => a.name.localeCompare(b.name));
  const issued = list.filter((r) => r.status === "issued").length;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  const here = `${base}/certificates`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href={base}>{course.name}</BackLink>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Certificates</h1>
        <p className="mt-1 text-muted">{course.name}, {cohort.name}</p>
      </div>
      <CourseNav base={base} active="certificates" />
      <Banner error={error} ok={ok} />

      {!tpl && (
        <div className="rounded-2xl border-[1.5px] border-brand bg-sky px-5 py-4">
          <p className="font-semibold">This course has no certificate template yet.</p>
          <p className="mt-1 text-sm">Add it once on the Courses page. Every cohort of this course will use it. <Link href={`/dashboard/courses/${course.id}/certificate`} className="font-semibold text-brand underline">Add the template</Link></p>
        </div>
      )}

      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-xl font-semibold">Collection link</h2>
        <div className="flex items-center gap-2 rounded-xl bg-sky px-3 py-2.5">
          <code className="min-w-0 flex-1 break-all text-sm">{link}</code>
          <CopyButton text={link} />
        </div>
        <p className="text-sm text-muted">Send this link to the students after you issue their certificates, from your own email. Each student types their full name and email, and downloads their own certificate. Students who are not issued yet see that it is not ready.</p>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted"><span className="font-semibold text-ink">{list.length}</span> on the list, <span className="font-semibold text-ink">{issued}</span> issued</p>
        <form action={addAllMarkedCapstones} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="cohort_course_id" value={cc.id} />
          <input type="hidden" name="return_to" value={here} />
          <button className="rounded-xl border-[1.5px] border-brand px-4 py-2 font-semibold text-brand hover:bg-sky">Add all marked capstones</button>
        </form>
      </section>

      <CertificateList rows={list} returnTo={here} defaultDate={today} />

      <form action={`${base}/export`} method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-4">
        <input type="hidden" name="certificates" value="1" />
        <div className="flex min-w-[10rem] flex-1 flex-col gap-1">
          <label htmlFor="c-status" className="text-xs font-semibold text-muted">Download names and emails of</label>
          <select id="c-status" name="status" className="rounded-xl border-[1.5px] border-line bg-white px-3 py-2 focus:border-brand focus:outline-none">
            <option value="issued">Issued students</option>
            <option value="approved">Approved students</option>
            <option value="all">Everyone on the list</option>
          </select>
        </div>
        <div className="flex min-w-[9rem] flex-col gap-1">
          <label htmlFor="c-format" className="text-xs font-semibold text-muted">File type</label>
          <select id="c-format" name="format" className="rounded-xl border-[1.5px] border-line bg-white px-3 py-2 focus:border-brand focus:outline-none"><option value="xlsx">Excel (.xlsx)</option><option value="csv">CSV</option></select>
        </div>
        <button className="rounded-xl border-[1.5px] border-brand px-4 py-2 font-semibold text-brand hover:bg-sky">Download list</button>
      </form>
    </div>
  );
}
