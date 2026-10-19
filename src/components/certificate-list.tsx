"use client";

import { useState } from "react";
import { issueCertificates, removeCertificates, withdrawCertificates } from "@/app/actions/certificates";

export type CertRow = { id: string; name: string; email: string; status: "approved" | "issued"; issueDate: string | null; shownDate: string; number: string };

// The Certificates list: tick students, choose the issue date, and issue, withdraw or take them off.
export function CertificateList({ rows, returnTo, defaultDate, canIssue }: { rows: CertRow[]; returnTo: string; defaultDate: string; canIssue: boolean }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const all = rows.length > 0 && picked.size === rows.length;
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const chosen = rows.filter((r) => picked.has(r.id));

  async function copyEmails() {
    const text = chosen.map((r) => r.email).join(", ");
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { window.prompt("Copy these emails:", text); }
  }

  if (!rows.length) {
    return <p className="rounded-2xl border border-dashed border-line bg-white px-6 py-10 text-center text-muted">Nobody is on the list yet. In Submissions, filter to the capstone and Marked, tick the students and press Add to certificates. {canIssue ? " Or use Add all marked capstones above." : ""}</p>;
  }

  return (
    <form className="flex flex-col gap-4">
      <input type="hidden" name="return_to" value={returnTo} />
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex cursor-pointer items-center gap-2 font-semibold">
            <input type="checkbox" checked={all} onChange={(e) => setPicked(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} className="h-5 w-5 accent-brand" />
            Select all ({rows.length})
          </label>
          <span className="text-sm text-muted" aria-live="polite">{picked.size === 0 ? "Tick students first" : `${picked.size} selected`}</span>
        </div>
        {canIssue ? (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="issue-date" className="text-xs font-semibold text-muted">Issue date, printed on the certificate</label>
                <input id="issue-date" name="issue_date" type="date" defaultValue={defaultDate} className="rounded-xl border-[1.5px] border-line bg-white px-3 py-2 focus:border-brand focus:outline-none" />
              </div>
              <button formAction={issueCertificates} disabled={picked.size === 0} className="rounded-xl bg-brand px-5 py-2.5 font-display font-semibold text-white hover:bg-brand-dark disabled:opacity-40">Issue selected</button>
              <button formAction={withdrawCertificates} disabled={picked.size === 0} className="rounded-xl border-[1.5px] border-line px-4 py-2 font-semibold text-brand hover:bg-sky disabled:opacity-40">Withdraw</button>
              <button formAction={removeCertificates} disabled={picked.size === 0} className="rounded-xl border-[1.5px] border-[#e8b9b2] px-4 py-2 font-semibold text-fail hover:bg-[#fbe9e6] disabled:opacity-40">Take off the list</button>
              <button type="button" onClick={copyEmails} disabled={picked.size === 0} className="rounded-xl border-[1.5px] border-line px-4 py-2 font-semibold text-brand hover:bg-sky disabled:opacity-40" aria-live="polite">{copied ? "Copied" : "Copy emails"}</button>
            </div>
            <p className="text-xs text-muted">Issue unlocks the certificate for the student. Withdraw takes it back to Approved. Take off the list only works for students who are still Approved.</p>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <button formAction={removeCertificates} disabled={picked.size === 0} className="rounded-xl border-[1.5px] border-[#e8b9b2] px-4 py-2 font-semibold text-fail hover:bg-[#fbe9e6] disabled:opacity-40">Take off the list</button>
            </div>
            <p className="text-xs text-muted">You can add students from Submissions and take them off here while they are Approved. An admin issues the certificates.</p>
          </>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3">
            <input type="checkbox" name="ids" value={r.id} checked={picked.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.name}`} className="h-5 w-5 flex-none accent-brand" />
            <span className="min-w-0 flex-1">
              <span className="block font-display text-lg font-semibold">{r.name}</span>
              <span className="block truncate text-sm text-muted">{r.email}</span>
            </span>
            {r.status === "issued"
              ? <span className="flex flex-col items-end gap-0.5"><span className="rounded-full bg-[#e1f2e9] px-3 py-1 text-sm font-semibold text-pass">Issued</span><span className="text-xs text-muted">{r.shownDate}</span><span className="font-mono text-xs text-muted">{r.number}</span></span>
              : <span className="rounded-full bg-brand px-3 py-1 text-sm font-semibold text-white">Approved</span>}
          </li>
        ))}
      </ul>
    </form>
  );
}
