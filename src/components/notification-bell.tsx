"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Item = { id: string; student: string; task: string; where: string; href: string; at: string; isNew: boolean };
type Data = { count: number; items: Item[]; now: string };

function ago(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// The bell in the top bar. It asks the server for new submissions when the page opens, every minute, and when you come back to the tab.
export function NotificationBell() {
  const [data, setData] = useState<Data | null>(null);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [top, setTop] = useState(64);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      if (json.enabled === false) setHidden(true);
      else setData(json);
    } catch { /* the bell keeps what it had */ }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(() => { if (document.visibilityState === "visible") load(); }, 60000);
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearTimeout(first); clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown); document.addEventListener("touchstart", onDown); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("touchstart", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (hidden) return null;
  const count = data?.count ?? 0;

  async function markSeen() {
    if (!data) return;
    setBusy(true);
    try {
      const res = await fetch("/api/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ now: data.now }) });
      if (res.ok) setData({ ...data, count: 0, items: data.items.map((i) => ({ ...i, isNew: false })) });
    } finally { setBusy(false); }
  }

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => { if (!open && box.current) setTop(Math.round(box.current.getBoundingClientRect().bottom) + 8); setOpen((o) => !o); if (!open) load(); }} aria-expanded={open} aria-haspopup="true"
        aria-label={count ? `Notifications, ${count} new submission${count === 1 ? "" : "s"}` : "Notifications, nothing new"}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border-[1.5px] border-line text-navy hover:bg-sky">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z" /><path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full bg-brand px-1 text-[0.68rem] font-bold leading-none text-white ring-2 ring-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div role="region" aria-label="New submissions" style={{ "--bell-top": `${top}px` } as React.CSSProperties}
          className="fixed inset-x-3 top-[var(--bell-top)] z-50 max-h-[75vh] overflow-y-auto rounded-2xl border border-line bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[24rem]">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <p className="font-display text-lg font-semibold">Notifications</p>
            {count > 0 && <button type="button" onClick={markSeen} disabled={busy} className="text-sm font-semibold text-brand disabled:opacity-60">Mark all as seen</button>}
          </div>
          {!data?.items.length ? (
            <p className="px-4 py-8 text-center text-sm text-muted">No submissions yet. New ones will show here.</p>
          ) : (
            <ul>
              {data.items.map((i) => (
                <li key={i.id} className="border-b border-line last:border-b-0">
                  <Link href={i.href} onClick={() => setOpen(false)} className={`flex gap-3 px-4 py-3 hover:bg-sky ${i.isNew ? "bg-sky/60" : ""}`}>
                    <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 flex-none rounded-full ${i.isNew ? "bg-brand" : "bg-transparent"}`} />
                    <span className="min-w-0">
                      <span className="block text-sm"><span className="font-semibold">{i.student}</span> sent {i.task}</span>
                      <span className="block truncate text-xs text-muted">{i.where}</span>
                      <span className="block text-xs text-muted">{ago(i.at)}{i.isNew ? ", new" : ""}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
