"use client";

import { useActionState } from "react";
import { inviteStaff, newCode, type CodeState } from "@/app/actions/people";
import { SubmitButton } from "./submit-button";
import { CopyButton } from "./copy-button";
import { inputClass } from "./auth-shell";

export function CodeBox({ state }: { state: CodeState }) {
  if (!state?.code) return null;
  return (
    <div role="status" className="rounded-xl border-[1.5px] border-brand bg-sky p-4">
      <p className="text-sm">Give this code to <span className="font-semibold">{state.email}</span>. It is shown only once.</p>
      <div className="mt-2 flex items-center gap-3">
        <code className="font-display text-2xl font-semibold tracking-widest">{state.code}</code>
        <CopyButton text={state.code} />
      </div>
      <p className="mt-2 text-sm text-muted">They open the site, choose Activate your account, and enter their email and this code.</p>
    </div>
  );
}

type Group = { cohort: string; items: { id: string; label: string }[] };

export function InviteForm({ groups }: { groups: Group[] }) {
  const [state, action] = useActionState(inviteStaff, undefined);
  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="inv-email" className="font-semibold">Email</label>
          <input id="inv-email" name="email" type="email" required placeholder="name@example.com" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="inv-role" className="font-semibold">Role</label>
          <select id="inv-role" name="role" defaultValue="moderator" className={inputClass}>
            <option value="moderator">Moderator</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      {groups.length > 0 && (
        <fieldset className="flex flex-col gap-3">
          <legend className="font-semibold">Courses for a moderator</legend>
          <p className="text-sm text-muted">Ignored for admins, who see everything. You can change this later from the cohort page.</p>
          {groups.map((g) => (
            <div key={g.cohort} className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-muted">{g.cohort}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {g.items.map((i) => (
                  <label key={i.id} className="flex cursor-pointer items-center gap-3 rounded-xl border-[1.5px] border-line bg-white px-4 py-2.5 font-medium has-[:checked]:border-brand has-[:checked]:bg-sky">
                    <input type="checkbox" name="cc" value={i.id} className="h-5 w-5 accent-brand" />
                    {i.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </fieldset>
      )}
      {state?.error && <p role="alert" className="rounded-xl bg-[#fbe9e6] px-4 py-3 text-sm font-medium text-fail">{state.error}</p>}
      <SubmitButton className="self-start">Create invite code</SubmitButton>
      <CodeBox state={state} />
    </form>
  );
}

export function NewCodeButton({ email, role, label }: { email: string; role: string; label: string }) {
  const [state, action] = useActionState(newCode, undefined);
  return (
    <div className="flex flex-col items-end gap-2">
      <form action={action}>
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="role" value={role} />
        <button className="rounded-lg border-[1.5px] border-line px-3 py-1.5 text-sm font-semibold text-brand hover:bg-sky">{label}</button>
      </form>
      {state?.error && <p className="text-sm text-fail">{state.error}</p>}
      <CodeBox state={state} />
    </div>
  );
}
