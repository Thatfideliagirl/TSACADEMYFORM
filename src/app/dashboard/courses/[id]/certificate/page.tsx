import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/staff";
import { BackLink } from "@/components/back-link";
import { TemplateEditor } from "@/components/template-editor";
import type { Boxes } from "@/lib/certificate-render";

// Admins only. One template per course. Every cohort of the course uses it.
export default async function CertificateTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const [{ data: course }, { data: tpl }] = await Promise.all([
    supabase.from("courses").select("id, name").eq("id", id).maybeSingle(),
    supabase.from("certificate_templates").select("width, height, boxes, updated_at").eq("course_id", id).maybeSingle(),
  ]);
  if (!course) notFound();
  const initial = tpl ? { url: `/api/certificate-template/${id}?v=${encodeURIComponent(tpl.updated_at)}`, width: tpl.width as number, height: tpl.height as number, boxes: tpl.boxes as Boxes } : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href="/dashboard/courses">courses</BackLink>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Certificate template</h1>
        <p className="mt-1 text-muted">{course.name}. Upload it once. Every cohort of this course uses it, and the system only writes the name of the student and the date of issue.</p>
      </div>
      <TemplateEditor courseId={course.id} initial={initial} />
    </div>
  );
}
