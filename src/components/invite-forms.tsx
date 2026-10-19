"use client";

import { useActionState, useState } from "react";
import { cancelInvite, inviteStaff, newCode, removeStaff, type CodeState } from "@/app/actions/people";
import { SubmitButton } from "./submit-button";
import { CopyButton } from "./copy-button";
import { inputClass } from "./auth-shell";
import { useKeepValues } from "./use-keep-values";

export function CodeBox({ state }: { state: CodeState }) {
  if (state?.notice) return <p role="status" className="rounded-xl border-[1.5px] border-brand bg-sky px-4 py-3 text-sm font-medium">{state.notice}</p>;
  if (!state?.code) return null;
  return (
    <div role="status" className="rounded-xl border-[1.5px] border-brand bg-sky p-4">
      <p className="text-sm">Give this code to <span className="font-semibold">{state.email}</span>. It is shown only once.</p>
      <div className="mt-2 flex items-center gap-3">
        <code className="font-display text-2xl font-semibold tracking-widest">{state.code}</code>
        <CopyButton text={state.code} />
      </div>
      <p className="mt-2 text-sm text-muted">They open the site, click Sign up, and enter their email and this code.</p>
    </div>
  );
}

type Group = { cohort: string; items: { id: string; label: string }[] };

export function InviteForm({ groups }: { groups: Group[] }) {
  const { state, pending, onSubmit } = useKeepValues(inviteStaff);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
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
      <SubmitButton pending={pending} className="self-start">Create invite code</SubmitButton>
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

// Two steps, so nobody is removed by one stray tap.
export function RemoveStaffButton({ id, name }: { id: string; name: string }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return <button type="button" onClick={() => setAsking(true)} className="rounded-lg border-[1.5px] border-line px-3 py-1.5 text-sm font-semibold text-fail hover:bg-[#fbe9e6]">Remove from team</button>;
  }
  return (
    <form action={removeStaff} className="flex max-w-xs flex-col items-end gap-2 rounded-xl border-[1.5px] border-fail bg-[#fbe9e6] p-3 text-sm">
      <input type="hidden" name="id" value={id} />
      <p>Remove <span className="font-semibold">{name}</span>? They lose their courses and cannot sign in again until you invite them again.</p>
      <div className="flex gap-2">
        <button type="button" onClick={() => setAsking(false)} className="rounded-lg border-[1.5px] border-line bg-white px-3 py-1.5 font-semibold">Keep</button>
        <button className="rounded-lg bg-fail px-3 py-1.5 font-semibold text-white">Yes, remove</button>
      </div>
    </form>
  );
}

export function CancelInviteButton({ id }: { id: string }) {
  return (
    <form action={cancelInvite}>
      <input type="hidden" name="id" value={id} />
      <button className="rounded-lg border-[1.5px] border-line px-3 py-1.5 text-sm font-semibold text-fail hover:bg-[#fbe9e6]">Cancel invite</button>
    </form>
  );
}
