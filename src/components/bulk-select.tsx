"use client";

import { useEffect, useRef, useState } from "react";

// A "select all" box, a count, and a delete button that asks first. The tick boxes sit in the list and point
// at the form by its id, so they can live inside each row.
export function BulkSelect({ formId, total }: { formId: string; total: number }) {
  const [count, setCount] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const master = useRef<HTMLInputElement>(null);
  const boxes = () => Array.from(document.querySelectorAll<HTMLInputElement>(`input[type=checkbox][name=ids][form="${formId}"]`));

  useEffect(() => {
    const update = () => {
      const all = boxes();
      const n = all.filter((b) => b.checked).length;
      setCount(n);
      if (n === 0) setConfirming(false);
      if (master.current) { master.current.checked = n > 0 && n === all.length; master.current.indeterminate = n > 0 && n < all.length; }
    };
    document.addEventListener("change", update);
    update();
    return () => document.removeEventListener("change", update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId, total]);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-sky px-4 py-2.5" role="group" aria-label="Select students">
      <label className="flex cursor-pointer items-center gap-2 font-semibold">
        <input ref={master} type="checkbox" className="h-5 w-5 accent-brand"
          onChange={(e) => { boxes().forEach((b) => (b.checked = e.target.checked)); document.dispatchEvent(new Event("change")); }} />
        Select all
      </label>
      <span className="text-sm text-muted" aria-live="polite">{count === 0 ? "Tick students to remove them together" : `${count} selected`}</span>
      {count > 0 && !confirming && (
        <button type="button" onClick={() => setConfirming(true)} className="ml-auto rounded-lg border-[1.5px] border-[#e8b9b2] bg-white px-3 py-1.5 text-sm font-semibold text-fail hover:bg-[#fbe9e6]">
          Delete selected
        </button>
      )}
      {count > 0 && confirming && (
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-fail">Remove {count} student{count === 1 ? "" : "s"} and what they submitted?</span>
          <button type="submit" form={formId} className="rounded-lg bg-fail px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Yes, remove</button>
          <button type="button" onClick={() => setConfirming(false)} className="rounded-lg border-[1.5px] border-line bg-white px-3 py-1.5 text-sm font-semibold hover:bg-sky-deep">Cancel</button>
        </span>
      )}
    </div>
  );
}
