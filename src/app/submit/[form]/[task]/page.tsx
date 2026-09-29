import { notFound } from "next/navigation";
import { getForm } from "@/lib/submit-data";
import { StudentForm } from "@/components/student-form";

// A link to one task. It skips the "what are you submitting" step.
export default async function TaskSubmitPage({ params }: { params: Promise<{ form: string; task: string }> }) {
  const { form: slug, task } = await params;
  const form = await getForm(slug);
  if (!form) notFound();
  return <StudentForm formSlug={form.formSlug} formName={form.formName} courseName={form.courseName} cohortName={form.cohortName} open={form.open} fixedTask={task} />;
}
