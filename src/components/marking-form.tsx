"use client";

import { useState } from "react";
import { askResubmit, cancelResubmit, saveGrade } from "@/app/actions/grading";

export type MarkLink = {
  key: string; label: string; url: string; reviewed: boolean;
  unverified: boolean; confirmed: boolean; toggled: boolean; before: string | null;
};

const field = "rounded-xl border-[1.5px] border-line bg-white px-3 py-2 focus:border-brand focus:outline-none";

// The marking area of one submission. Each link has a tick (it is good) and a switch (it is wrong, ask for a new one).
// The moment any switch is on, the Comment box becomes a Feedback box for the student and the score waits.
export function MarkingForm({
  submissionId, returnTo, links, score, maxScore, comment, feedback, asked, resubmitted, markedInfo, mail, children,
}: {
  submissionId: string; returnTo: string; links: MarkLink[]; score: number | null; maxScore: number;
  comment: string; feedback: string; asked: boolean; resubmitted: boolean; markedInfo: string | null;
  mail: { to: string; firstName: string; taskTitle: string; taskLink: string };
  children?: React.ReactNode;
}) {
  const [wrong, setWrong] = useState<Set<string>>(new Set(links.filter((l) => l.toggled).map((l) => l.key)));
  const [note, setNote] = useState(comment);
  const [fb, setFb] = useState(feedback);
  const [mark, setMark] = useState(score === null ? "" : String(score));
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>(Object.fromEntries(links.map((l) => [l.key, l.confirmed])));
  const asking = wrong.size > 0;

  const flip = (key: string) => setWrong((p) => { const n = new Set(p); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const labels = links.filter((l) => wrong.has(l.key)).map((l) => l.label);
  const text = (lines: string[]) => lines.join("\n");
  const subject = asking ? `Please resubmit: ${mail.taskTitle}` : `Your ${mail.taskTitle}`;
  const body = asking
    ? text([`Hello ${mail.firstName},`, "", `Thank you for sending your ${mail.taskTitle}.`, fb.trim(), "", `Please send a new link for: ${labels.join(", ")}.`, `Use this link: ${mail.taskLink}`, "", "Thank you."])
    : text([`Hello ${mail.firstName},`, "", score !== null && mark !== "" ? `Your ${mail.taskTitle} has been marked: ${mark} out of ${maxScore}.` : `I have looked at your ${mail.taskTitle}.`, note.trim(), "", "Thank you."]);
  const mailto = `mailto:${encodeURIComponent(mail.to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <form className="flex flex-col gap-4 border-t border-line px-4 py-4">
      <input type="hidden" name="submission_id" value={submissionId} />
      <input type="hidden" name="return_to" value={returnTo} />

      <ul className="flex flex-col divide-y divide-dashed divide-line">
        {links.map((l) => {
          const isWrong = wrong.has(l.key);
          const ok = confirmed[l.key];
          return (
            <li key={l.key} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <label className={`flex min-w-0 cursor-pointer items-start gap-3 ${isWrong ? "opacity-60" : ""}`}>
                <input type="checkbox" name={`reviewed_${l.key}`} defaultChecked={l.reviewed && !isWrong} disabled={isWrong} className="mt-1 h-5 w-5 flex-none accent-brand" />
                <span className="min-w-0">
                  <span className="block font-semibold">{l.label} <span className="font-normal text-muted">reviewed</span>
                    {l.before && <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white">New link</span>}
                  </span>
                  <span className="block truncate text-sm text-muted">{l.url}</span>
                  {l.before && <span className="block truncate text-xs text-muted">Before: <s>{l.before}</s></span>}
                  {l.unverified
                    ? (ok
                      ? <span className="text-xs font-semibold text-pass">You checked it. It opens for anyone.</span>
                      : <span className="text-xs font-semibold text-fail">Could not verify that this opens for anyone. Check it.</span>)
                    : <span className="text-xs font-semibold text-pass">Verified. It opens for anyone.</span>}
                </span>
              </label>
              <span className="flex items-center gap-3">
                <label className={`flex cursor-pointer items-center gap-2 text-sm font-semibold ${isWrong ? "text-brand" : "text-muted"}`}>
                  <input type="checkbox" name={`resubmit_${l.key}`} checked={isWrong} onChange={() => flip(l.key)} className="peer sr-only" />
                  <span aria-hidden className="relative h-5 w-9 flex-none rounded-full bg-line transition peer-checked:bg-brand peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-all peer-checked:after:left-[1.1rem]" />
                  Resubmit
                </label>
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="rounded-lg border-[1.5px] border-brand px-4 py-1.5 text-sm font-semibold text-brand hover:bg-sky">Open</a>
              </span>
              {l.unverified && !isWrong && (
                <label className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border-[1.5px] px-3 py-2 text-sm font-semibold ${ok ? "border-pass bg-[#e1f2e9] text-pass" : "border-fail bg-[#fbe9e6] text-fail"}`}>
                  <input type="checkbox" name={`opens_${l.key}`} checked={ok} onChange={(e) => setConfirmed((p) => ({ ...p, [l.key]: e.target.checked }))} className="h-5 w-5 flex-none accent-brand" />
                  I opened it and it works for anyone
                </label>
              )}
            </li>
          );
        })}
      </ul>

      {children}

      {asking ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl bg-sky px-4 py-3 text-sm">
            {asked ? "This student has been asked to resubmit. " : ""}
            The student will be able to send a new link for: <span className="font-semibold">{labels.join(", ")}</span>. The other links stay locked.
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`fb-${submissionId}`} className="text-sm font-semibold text-brand">Feedback for the student</label>
            <textarea id={`fb-${submissionId}`} name="feedback" rows={3} value={fb} onChange={(e) => setFb(e.target.value)} className={`${field} border-brand`}
              placeholder="Tell the student exactly what to fix." />
          </div>
          <input type="hidden" name="comment" value={note} />
          <p className="text-sm text-muted">No score while the student is fixing the work.{score !== null && " The score already saved will be cleared."}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
          <div className="flex flex-col gap-1">
            <label htmlFor={`sc-${submissionId}`} className="text-sm font-semibold">Score out of {maxScore}</label>
            <input id={`sc-${submissionId}`} name="score" type="number" step="any" min={0} max={maxScore} value={mark} onChange={(e) => setMark(e.target.value)} className={field} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`cm-${submissionId}`} className="text-sm font-semibold">Comment</label>
            <textarea id={`cm-${submissionId}`} name="comment" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={field} />
          </div>
          <input type="hidden" name="feedback" value={fb} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {asking ? (
          <button formAction={askResubmit} className="rounded-xl bg-brand px-5 py-2.5 font-display font-semibold text-white hover:bg-brand-dark">{asked ? "Save feedback" : "Ask to resubmit"}</button>
        ) : (
          <button formAction={saveGrade} className="rounded-xl bg-brand px-5 py-2.5 font-display font-semibold text-white hover:bg-brand-dark">Save score</button>
        )}
        <a href={mailto} className="rounded-xl border-[1.5px] border-brand px-4 py-2 font-semibold text-brand hover:bg-sky">Email this student</a>
        {asked && <button formAction={cancelResubmit} formNoValidate className="rounded-xl border-[1.5px] border-line px-4 py-2 font-semibold text-muted hover:bg-sky">Cancel resubmission</button>}
        {resubmitted && !asking && <span className="rounded-full bg-[#e1f2e9] px-3 py-1 text-sm font-semibold text-pass">Resubmitted, ready to mark</span>}
      </div>
      {markedInfo && !asking && <p className="text-sm text-muted">{markedInfo}</p>}
    </form>
  );
}
