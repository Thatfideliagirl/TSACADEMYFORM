import { notFound } from "next/navigation";
import { getForm } from "@/lib/submit-data";
import { StudentForm } from "@/components/student-form";

export default async function SubmitPage({ params }: { params: Promise<{ form: string }> }) {
  const { form: slug } = await params;
  const form = await getForm(slug);
  if (!form) notFound();
  return <StudentForm formSlug={form.formSlug} formName={form.formName} courseName={form.courseName} cohortName={form.cohortName} open={form.open} />;
}
