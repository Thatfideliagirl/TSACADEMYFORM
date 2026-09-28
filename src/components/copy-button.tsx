"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="rounded-lg border-[1.5px] border-line px-3 py-1.5 text-sm font-semibold text-brand hover:bg-sky"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          window.prompt("Copy this:", text);
        }
      }}>
      {done ? "Copied" : label}
    </button>
  );
}
