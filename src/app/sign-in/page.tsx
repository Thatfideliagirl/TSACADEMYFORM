import { redirect } from "next/navigation";
import { getStaff } from "@/lib/staff";
import { AuthShell, AuthTabs } from "@/components/auth-shell";
import { SignInForm } from "@/components/forms";

export const metadata = { title: "Sign in | TS Academy Submit" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ activated?: string }> }) {
  if (await getStaff()) redirect("/dashboard");
  const { activated } = await searchParams;
  return (
    <AuthShell eyebrow="Staff sign in" title="Welcome back" intro="Sign in to manage cohorts, read submissions and mark work.">
      <AuthTabs active="sign-in" />
      {activated && (
        <p role="status" className="mb-5 rounded-xl bg-[#e1f2e9] px-4 py-3 text-sm font-medium text-pass">
          Your account is ready. Sign in with your email and the password you just chose.
        </p>
      )}
      <SignInForm />
    </AuthShell>
  );
}
