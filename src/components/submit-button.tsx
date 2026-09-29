"use client";

import { useFormStatus } from "react-dom";
import { useHydrated } from "./use-hydrated";

export function SubmitButton({ children, className = "", pending: busy }: { children: React.ReactNode; className?: string; pending?: boolean }) {
  const status = useFormStatus();
  const pending = busy ?? status.pending;
  const ready = useHydrated();
  return (
    <button type="submit" disabled={pending || !ready}
      className={`rounded-xl bg-brand px-5 py-3 font-display text-base font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60 ${className}`}>
      {pending ? "Please wait..." : children}
    </button>
  );
}
