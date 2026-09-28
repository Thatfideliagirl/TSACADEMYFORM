"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className={`rounded-xl bg-brand px-5 py-3 font-display text-base font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60 ${className}`}>
      {pending ? "Please wait..." : children}
    </button>
  );
}
