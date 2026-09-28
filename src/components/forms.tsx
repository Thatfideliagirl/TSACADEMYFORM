"use client";

import { useActionState } from "react";
import { signIn, activate } from "@/app/actions/auth";
import { SubmitButton } from "./submit-button";
import { inputClass } from "./auth-shell";

function Field({ id, label, type = "text", autoComplete, hint }: { id: string; label: string; type?: string; autoComplete?: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-semibold">{label}</label>
      <input id={id} name={id} type={type} autoComplete={autoComplete} required className={inputClass} />
      {hint && <span className="text-sm text-muted">{hint}</span>}
    </div>
  );
}

function ErrorLine({ message }: { message?: string }) {
  return message ? <p role="alert" className="rounded-xl bg-[#fbe9e6] px-4 py-3 text-sm font-medium text-fail">{message}</p> : null;
}

export function SignInForm() {
  const [state, action] = useActionState(signIn, undefined);
  return (
    <form action={action} className="flex flex-col gap-5">
      <Field id="email" label="Email" type="email" autoComplete="email" />
      <Field id="password" label="Password" type="password" autoComplete="current-password" />
      <ErrorLine message={state?.error} />
      <SubmitButton>Sign in</SubmitButton>
    </form>
  );
}

export function ActivateForm() {
  const [state, action] = useActionState(activate, undefined);
  return (
    <form action={action} className="flex flex-col gap-5">
      <Field id="full_name" label="Your full name" autoComplete="name" />
      <Field id="email" label="Email your admin added" type="email" autoComplete="email" />
      <Field id="code" label="Invite code" hint="Looks like K7QM-2XPD. Your admin gave it to you." />
      <Field id="password" label="Choose a password" type="password" autoComplete="new-password" hint="At least 8 characters." />
      <Field id="confirm" label="Type the password again" type="password" autoComplete="new-password" />
      <ErrorLine message={state?.error} />
      <SubmitButton>Create my password</SubmitButton>
    </form>
  );
}
