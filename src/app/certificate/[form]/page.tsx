import { getForm } from "@/lib/submit-data";
import { CertificateCollect } from "@/components/certificate-collect";
import { FormProblem } from "@/components/form-problem";

export default async function CollectPage({ params }: { params: Promise<{ form: string }> }) {
  const { form: slug } = await params;
  const form = await getForm(slug).catch(() => "error" as const);
  if (form === "error") return <FormProblem kind="setup" />;
  if (!form) return <FormProblem kind="missing" />;
  return <CertificateCollect formSlug={form.formSlug} courseName={form.courseName} cohortName={form.cohortName} />;
}
