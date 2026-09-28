import { redirect } from "next/navigation";
import { getStaff } from "@/lib/staff";
import { AuthShell } from "@/components/auth-shell";
import { ActivateForm } from "@/components/forms";

export const metadata = { title: "Activate your account | TS Academy Submit" };

export default async function ActivatePage() {
  if (await getStaff()) redirect("/dashboard");
  return (
    <AuthShell eyebrow="First time here" title="Activate your account" intro="Use the email and invite code from your admin, then choose a password. Next time you sign in with that password.">
      <ActivateForm />
    </AuthShell>
  );
}
