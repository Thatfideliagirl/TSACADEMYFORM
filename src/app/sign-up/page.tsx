import { redirect } from "next/navigation";
import { getStaff } from "@/lib/staff";
import { AuthShell, AuthTabs } from "@/components/auth-shell";
import { ActivateForm } from "@/components/forms";

export const metadata = { title: "Sign up | TS Academy Submit" };

export default async function SignUpPage() {
  if (await getStaff()) redirect("/dashboard");
  return (
    <AuthShell eyebrow="First time here" title="Create your account" intro="Enter the email and invite code from your admin, then choose a password. After that you will sign in.">
      <AuthTabs active="sign-up" />
      <ActivateForm />
    </AuthShell>
  );
}
