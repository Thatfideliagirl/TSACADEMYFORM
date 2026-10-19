"use client";

import { useEffect, useRef, useState } from "react";
import { addToCertificates } from "@/app/actions/certificates";

// "Select all", a count, and a button. The tick boxes sit in the list and point at the form by its id.
export function CertificateSelectBar({ formId, returnTo }: { formId: string; returnTo: string }) {
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);
  const master = useRef<HTMLInputElement>(null);
  const boxes = () => Array.from(document.querySelectorAll<HTMLInputElement>(`input[type=checkbox][name=ids][form="${formId}"]`));

  useEffect(() => {
    const update = () => {
      const all = boxes();
      const n = all.filter((b) => b.checked).length;
      setCount(n); setTotal(all.length);
      if (master.current) { master.current.checked = n > 0 && n === all.length; master.current.indeterminate = n > 0 && n < all.length; }
    };
    document.addEventListener("change", update);
    update();
    return () => document.removeEventListener("change", update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId]);

  return (
    <form id={formId} action={addToCertificates} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-sky px-4 py-2.5" aria-label="Add marked capstones to certificates">
      <input type="hidden" name="return_to" value={returnTo} />
      <label className="flex cursor-pointer items-center gap-2 font-semibold">
        <input ref={master} type="checkbox" className="h-5 w-5 accent-brand"
          onChange={(e) => { boxes().forEach((b) => (b.checked = e.target.checked)); document.dispatchEvent(new Event("change")); }} />
        Select all marked capstones on this page ({total})
      </label>
      <span className="text-sm text-muted" aria-live="polite">{count === 0 ? "Tick students to add them to Certificates" : `${count} selected`}</span>
      {count > 0 && <button className="ml-auto rounded-lg bg-brand px-4 py-2 font-display text-sm font-semibold text-white hover:bg-brand-dark">Add to certificates</button>}
    </form>
  );
}
