import { redirect } from "next/navigation";
import { getStaff } from "@/lib/staff";
import { AuthShell } from "@/components/auth-shell";
import { SignInForm } from "@/components/forms";

export default async function Home() {
  if (await getStaff()) redirect("/dashboard");
  return (
    <AuthShell eyebrow="TS Academy Submit" title="Welcome back" intro="Sign in to manage cohorts, read submissions and mark work.">
      <SignInForm />
    </AuthShell>
  );
}
