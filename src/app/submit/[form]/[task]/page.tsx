import { getForm } from "@/lib/submit-data";
import { StudentForm } from "@/components/student-form";
import { FormProblem } from "@/components/form-problem";

// A link to one task. It skips the "what are you submitting" step.
export default async function TaskSubmitPage({ params }: { params: Promise<{ form: string; task: string }> }) {
  const { form: slug, task } = await params;
  const form = await getForm(slug).catch(() => "error" as const);
  if (form === "error") return <FormProblem kind="setup" />;
  if (!form) return <FormProblem kind="missing" />;
  return <StudentForm formSlug={form.formSlug} formName={form.formName} courseName={form.courseName} cohortName={form.cohortName} open={form.open} fixedTask={task} />;
}
