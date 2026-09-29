"use client";

import { useRef, useState, useTransition } from "react";
import { checkLink, sendRequest, submitWork, verifyStudent, type TaskInfo } from "@/app/actions/submit";
import { allTypes, checkLinkType, findType, type LinkDef } from "@/lib/link-types";

type Phase = "idle" | "wrong" | "checking" | "open" | "locked" | "unknown";
type Check = { phase: Phase; message: string; dup?: boolean };
type Done = { title: string; received: { label: string; url: string; verified: boolean }[] };

const norm = (s: string) => s.trim().toLowerCase().replace(/\/+$/, "");
const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "long", year: "numeric" });
const input = "w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-3 text-base focus:border-brand focus:outline-none";
const card = "min-w-0 rounded-2xl border border-line bg-white p-5 sm:p-6";

function Tick({ state, children }: { state: "idle" | "wait" | "ok" | "bad" | "maybe"; children: React.ReactNode }) {
  const styles = {
    idle: "bg-sky text-muted",
    wait: "bg-sky text-muted",
    ok: "bg-[#e1f2e9] text-pass",
    bad: "bg-[#fbe9e6] text-fail",
    maybe: "bg-sky-deep text-navy",
  }[state];
  const dot = {
    idle: "border-[1.5px] border-dashed border-line",
    wait: "spin border-2 border-brand border-r-transparent",
    ok: "stamp bg-pass text-white",
    bad: "bg-fail text-white",
    maybe: "bg-muted text-white",
  }[state];
  return (
    <li className={`inline-flex items-center gap-2 rounded-full py-1 pl-1.5 pr-3 text-sm font-medium ${styles}`}>
      <span aria-hidden className={`grid h-5 w-5 flex-none place-items-center rounded-full text-[11px] font-bold ${dot}`}>
        {state === "ok" ? "✓" : state === "bad" ? "✕" : state === "maybe" ? "?" : ""}
      </span>
      {children}
    </li>
  );
}

function Back({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-2 self-start rounded-lg border-[1.5px] border-line bg-white px-3 py-1.5 text-sm font-semibold text-brand hover:bg-sky">
      <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 8H3M7.5 3.5 3 8l4.5 4.5" /></svg>
      {children}
    </button>
  );
}


function RequestPanel({ token, task, onSent }: { token: string; task: TaskInfo; onSent: (r: NonNullable<TaskInfo["request"]>) => void }) {
  const canReplace = task.sent.length > 0;
  const [mode, setMode] = useState<"" | "replace_link" | "note">("");
  const [linkKey, setLinkKey] = useState(task.sent[0]?.key ?? "");
  const [url, setUrl] = useState("");
  const [check, setCheck] = useState<Check>({ phase: "idle", message: "" });
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const seqNo = useRef(0);
  const sent = task.sent.find((l) => l.key === linkKey);
  const def = findType(linkKey, task.custom);

  function onUrl(v: string) {
    setUrl(v);
    clearTimeout(timer.current);
    const mine = ++seqNo.current;
    if (!v.trim() || !def) return setCheck({ phase: "idle", message: "" });
    const type = checkLinkType(def, v, allTypes(task.custom));
    if (!type.ok) return setCheck({ phase: "wrong", message: type.message });
    if (sent && norm(sent.url) === norm(v)) return setCheck({ phase: "wrong", message: "That is the same link you already sent." });
    setCheck({ phase: "checking", message: "" });
    timer.current = setTimeout(async () => {
      let next: Check;
      try {
        const r = await checkLink({ token, taskSlug: task.slug, key: linkKey, url: v });
        next = !r.typeOk ? { phase: "wrong", message: r.message } : r.status === "locked" ? { phase: "locked", message: r.message }
          : r.status === "unknown" ? { phase: "unknown", message: r.message } : { phase: "open", message: "" };
      } catch {
        next = { phase: "unknown", message: "We could not check this link right now. You can still send it. A moderator will check it." };
      }
      if (seqNo.current === mine) setCheck(next);
    }, 600);
  }

  const reasonOk = reason.trim().length >= 40;
  const linkOk = mode !== "replace_link" || ["open", "unknown"].includes(check.phase);
  const ready = !!mode && reasonOk && linkOk;

  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || !mode) return;
    setError("");
    start(async () => {
      const r = await sendRequest({ token, taskSlug: task.slug, kind: mode, linkKey, newUrl: url, reason });
      if (r.ok) onSent({ kind: mode, status: "pending" });
      else setError(r.error);
    });
  }

  const pick = "rounded-2xl border-[1.5px] px-4 py-3 text-left font-semibold";
  return (
    <form onSubmit={send} className={`${card} flex flex-col gap-4`} noValidate>
      <div>
        <h3 className="font-display text-lg font-semibold">Need to change something?</h3>
        <p className="mt-1 text-sm text-muted">You get one request for this task. A moderator will read it.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" disabled={!canReplace} onClick={() => setMode("replace_link")} aria-pressed={mode === "replace_link"}
          className={`${pick} ${mode === "replace_link" ? "border-brand bg-sky" : "border-line bg-white hover:bg-sky"} disabled:opacity-50`}>
          Replace a link<span className="block text-sm font-normal text-muted">{canReplace ? "Send a new link in place of one" : "Not available"}</span>
        </button>
        <button type="button" onClick={() => setMode("note")} aria-pressed={mode === "note"}
          className={`${pick} ${mode === "note" ? "border-brand bg-sky" : "border-line bg-white hover:bg-sky"}`}>
          Leave a note<span className="block text-sm font-normal text-muted">For example, I updated my board</span>
        </button>
      </div>

      {mode === "replace_link" && (
        <div className="flex flex-col gap-2">
          <label htmlFor="rq-which" className="font-semibold">Which link do you want to replace?</label>
          <select id="rq-which" value={linkKey} onChange={(e) => { setLinkKey(e.target.value); setUrl(""); setCheck({ phase: "idle", message: "" }); }} className={input}>
            {task.sent.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
          </select>
          <label htmlFor="rq-url" className="mt-1 font-semibold">New {def?.label} link</label>
          <p className="text-sm text-muted">It must be the same kind of link. {def?.hint}</p>
          <input id="rq-url" type="url" inputMode="url" autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="https://" value={url} onChange={(e) => onUrl(e.target.value)} className={input} />
          <ul className="flex flex-wrap gap-2" aria-label="Link checks">
            <Tick state={check.phase === "idle" ? "idle" : check.phase === "wrong" ? "bad" : "ok"}>Right kind of link</Tick>
            <Tick state={check.phase === "checking" ? "wait" : check.phase === "open" ? "ok" : check.phase === "locked" ? "bad" : check.phase === "unknown" ? "maybe" : "idle"}>{check.phase === "unknown" ? "Could not verify" : "Opens for anyone"}</Tick>
          </ul>
          {check.message && <p role={check.phase === "unknown" ? "status" : "alert"} className={`text-sm ${check.phase === "unknown" ? "text-navy" : "text-fail"}`}>{check.message}</p>}
        </div>
      )}

      {mode && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rq-reason" className="font-semibold">{mode === "note" ? "Your note" : "Why do you need to replace it?"}</label>
          <textarea id="rq-reason" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} className={input}
            placeholder={mode === "note" ? "For example: I updated my Trello board. It is the same link." : "Say what was wrong and what you are sending instead."} />
          <p className={`text-sm ${reasonOk ? "text-pass" : "text-muted"}`} aria-live="polite">{reasonOk ? "Ready to send." : `At least 40 characters (${reason.trim().length} so far).`}</p>
        </div>
      )}

      {error && <p role="alert" className="rounded-xl bg-[#fbe9e6] px-4 py-3 text-sm font-medium text-fail">{error}</p>}
      {mode && <button disabled={!ready || pending} className="rounded-xl bg-brand px-5 py-3 font-display text-base font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40">{pending ? "Sending..." : "Send request"}</button>}
    </form>
  );
}

export function StudentForm({ formSlug, formName, courseName, cohortName, open, fixedTask }: {
  formSlug: string; formName: string; courseName: string; cohortName: string; open: boolean; fixedTask?: string;
}) {
  const [stage, setStage] = useState<"verify" | "pick" | "fill" | "already" | "done">("verify");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [token, setToken] = useState("");
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [current, setCurrent] = useState<TaskInfo | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [checks, setChecks] = useState<Record<string, Check>>({});
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState<Done | null>(null);
  const [pending, start] = useTransition();
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const seq = useRef<Record<string, number>>({});

  const defs: LinkDef[] = current ? current.required.map((k) => findType(k, current.custom)).filter((d): d is LinkDef => !!d) : [];
  const setCheck = (key: string, c: Check) => setChecks((p) => ({ ...p, [key]: c }));

  function evaluate(key: string, vals: Record<string, string>, task: TaskInfo, tk: string) {
    const list = task.required.map((k) => findType(k, task.custom)).filter((d): d is LinkDef => !!d);
    const def = list.find((d) => d.key === key);
    if (!def) return;
    clearTimeout(timers.current[key]);
    const mine = (seq.current[key] = (seq.current[key] ?? 0) + 1);
    const url = (vals[key] ?? "").trim();
    if (!url) return setCheck(key, { phase: "idle", message: "" });

    const type = checkLinkType(def, url, allTypes(task.custom));
    if (!type.ok) return setCheck(key, { phase: "wrong", message: type.message });
    if (list.some((d) => d.key !== key && norm(vals[d.key] ?? "") === norm(url))) {
      return setCheck(key, { phase: "wrong", message: "You pasted this same link in another box.", dup: true });
    }
    setCheck(key, { phase: "checking", message: "" });
    timers.current[key] = setTimeout(async () => {
      let next: Check;
      try {
        const r = await checkLink({ token: tk, taskSlug: task.slug, key, url });
        next = !r.typeOk ? { phase: "wrong", message: r.message }
          : r.status === "locked" ? { phase: "locked", message: r.message }
          : r.status === "unknown" ? { phase: "unknown", message: r.message }
          : { phase: "open", message: "" };
      } catch {
        next = { phase: "unknown", message: "We could not check this link right now. You can still submit it. A moderator will check it." };
      }
      if (seq.current[key] === mine) setCheck(key, next);
    }, 600);
  }

  function onLink(key: string, value: string) {
    if (!current) return;
    const vals = { ...values, [key]: value };
    setValues(vals);
    evaluate(key, vals, current, token);
    for (const d of defs) if (d.key !== key && checks[d.key]?.dup) evaluate(d.key, vals, current, token);
  }

  function begin(task: TaskInfo) {
    Object.values(timers.current).forEach(clearTimeout);
    setValues({}); setChecks({}); setSubmitError("");
    setCurrent(task);
    setStage(task.submittedAt ? "already" : "fill");
  }

  function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setVerifyError("");
    start(async () => {
      const r = await verifyStudent({ formSlug, name, email });
      if (!r.ok) return setVerifyError(r.error);
      setToken(r.token);
      setTasks(r.tasks);
      if (fixedTask) {
        const t = r.tasks.find((x) => x.slug === fixedTask);
        if (!t) return setVerifyError("This task is closed or no longer exists. Ask your moderator for the right link.");
        return begin(t);
      }
      setStage("pick");
    });
  }

  const ready = defs.length > 0 && defs.every((d) => ["open", "unknown"].includes(checks[d.key]?.phase ?? "idle"));
  const checking = defs.some((d) => checks[d.key]?.phase === "checking");
  const missing = defs.filter((d) => !["open", "unknown"].includes(checks[d.key]?.phase ?? "idle")).map((d) => d.label);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!current || !ready) return;
    setSubmitError("");
    start(async () => {
      const links = Object.fromEntries(defs.map((d) => [d.key, values[d.key].trim()]));
      const r = await submitWork({ token, taskSlug: current.slug, links });
      if (r.ok) {
        setTasks((p) => p.map((t) => (t.slug === current.slug ? { ...t, submittedAt: r.submittedAt } : t)));
        setDone({ title: current.title, received: r.received });
        return setStage("done");
      }
      if (r.alreadySubmittedAt) {
        setTasks((p) => p.map((t) => (t.slug === current.slug ? { ...t, submittedAt: r.alreadySubmittedAt! } : t)));
        setCurrent({ ...current, submittedAt: r.alreadySubmittedAt });
        return setStage("already");
      }
      setSubmitError(r.error);
    });
  }

  const header = (
    <div className="mb-6 flex flex-col gap-3">
      <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight">{formName}</h1>
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-sky-deep px-3 py-1 text-sm font-semibold">{courseName}</span>
        <span className="rounded-full bg-sky-deep px-3 py-1 text-sm font-semibold">{cohortName}</span>
      </div>
    </div>
  );

  if (!open) {
    return (
      <>
        {header}
        <div className={card}>
          <h2 className="font-display text-xl font-semibold">This form is closed</h2>
          <p className="mt-2 text-muted">It is not taking submissions right now. Ask your moderator if you think this is a mistake.</p>
        </div>
      </>
    );
  }

  if (stage === "verify") {
    return (
      <>
        {header}
        <form onSubmit={onVerify} className={`${card} flex flex-col gap-5`}>
          <p className="text-muted">Use exactly the name and email you registered with. We check them before the form opens.</p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="font-semibold">Full name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required className={input} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="font-semibold">Email you registered with</label>
            <input id="email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required className={input} />
          </div>
          {verifyError && <p role="alert" className="rounded-xl bg-[#fbe9e6] px-4 py-3 text-sm font-medium text-fail">{verifyError}</p>}
          <button disabled={pending} className="rounded-xl bg-brand px-5 py-3.5 font-display text-base font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
            {pending ? "Checking..." : "Continue"}
          </button>
        </form>
      </>
    );
  }

  if (stage === "pick") {
    const groups = [["Assignments", tasks.filter((t) => t.kind === "assignment")], ["Capstone", tasks.filter((t) => t.kind === "capstone")]] as const;
    return (
      <>
        {header}
        <div className="flex flex-col gap-5">
          <Back onClick={() => { setStage("verify"); setToken(""); }}>Not you? Change your details</Back>
          <p className="text-lg">Hello, <span className="font-semibold">{name.trim()}</span>. What are you submitting?</p>
          {tasks.length === 0 && <p className={`${card} text-muted`}>There is nothing open for submission right now. Check back later or ask your moderator.</p>}
          {groups.map(([title, list]) => list.length > 0 && (
            <section key={title} className="flex flex-col gap-2">
              <h2 className="font-display text-lg font-semibold">{title}</h2>
              <ul className="flex flex-col gap-2">
                {list.map((t) => (
                  <li key={t.slug}>
                    <button type="button" disabled={!!t.submittedAt} onClick={() => begin(t)}
                      className="flex w-full items-center justify-between gap-3 rounded-2xl border-[1.5px] border-line bg-white px-5 py-4 text-left font-semibold enabled:hover:border-brand enabled:hover:bg-sky disabled:opacity-70">
                      <span>{t.title}</span>
                      {t.submittedAt ? <span className="rounded-full bg-[#e1f2e9] px-3 py-1 text-sm font-semibold text-pass">Submitted</span> : <span aria-hidden className="text-brand">→</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </>
    );
  }

  if (stage === "already" && current) {
    const onSent = (r: NonNullable<TaskInfo["request"]>) => {
      setTasks((p) => p.map((t) => (t.slug === current.slug ? { ...t, request: r } : t)));
      setCurrent({ ...current, request: r });
    };
    return (
      <>
        {header}
        <div className="flex flex-col gap-4">
          {!fixedTask && <Back onClick={() => setStage("pick")}>Back to your tasks</Back>}
          <div className={card}>
            <h2 className="font-display text-xl font-semibold">{current.title}</h2>
            <p className="mt-2">You already submitted this on {when(current.submittedAt!)}. Each student gets one submission.</p>
          </div>
          {current.request ? (
            <div className={card}>
              <p className="font-semibold">You have already used your one request for this task.</p>
              <p className="mt-1 text-sm text-muted">{current.request.status === "pending" ? "A moderator will look at it soon." : "Your moderator has looked at it."}</p>
            </div>
          ) : (
            <RequestPanel token={token} task={current} onSent={onSent} />
          )}
        </div>
      </>
    );
  }

  if (stage === "done" && done) {
    return (
      <>
        {header}
        <div className={`${card} flex flex-col items-center gap-4 text-center`}>
          <span aria-hidden className="stamp grid h-16 w-16 place-items-center rounded-full bg-pass text-3xl text-white">✓</span>
          <h2 className="font-display text-2xl font-semibold">Congratulations, you submitted successfully</h2>
          <p className="text-muted">{done.title} was received. You can close this page.</p>
          <ul className="flex w-full min-w-0 flex-col gap-2 text-left">
            {done.received.map((l) => (
              <li key={l.label} className="min-w-0 rounded-xl bg-sky px-4 py-2.5 text-sm">
                <span className="font-semibold">{l.label}</span>
                <span className="block truncate text-muted" title={l.url}>{l.url}</span>
                {!l.verified && <span className="text-navy">A moderator will check that this link opens.</span>}
              </li>
            ))}
          </ul>
          {!fixedTask && tasks.some((t) => !t.submittedAt) && (
            <button type="button" onClick={() => setStage("pick")} className="rounded-xl border-[1.5px] border-line px-5 py-2.5 font-semibold text-brand hover:bg-sky">Submit another task</button>
          )}
        </div>
      </>
    );
  }

  // stage === "fill"
  return (
    <>
      {header}
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        {!fixedTask && <Back onClick={() => setStage("pick")}>Back to your tasks</Back>}
        <div className={card}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl font-semibold">{current?.title}</h2>
            <span className="rounded-full bg-sky-deep px-2.5 py-0.5 text-xs font-semibold capitalize">{current?.kind}</span>
          </div>
          {current?.instructions && <p className="mt-3 whitespace-pre-line rounded-xl bg-sky px-4 py-3 text-[15px]">{current.instructions}</p>}
        </div>

        {defs.map((d) => {
          const c = checks[d.key] ?? { phase: "idle" as Phase, message: "" };
          const t1 = c.phase === "idle" ? "idle" : c.phase === "wrong" ? "bad" : "ok";
          const t2 = c.phase === "checking" ? "wait" : c.phase === "open" ? "ok" : c.phase === "locked" ? "bad" : c.phase === "unknown" ? "maybe" : "idle";
          return (
            <div key={d.key} className={`${card} flex flex-col gap-2 ${c.phase === "open" ? "border-pass" : c.phase === "wrong" || c.phase === "locked" ? "border-fail" : ""}`}>
              <label htmlFor={`l-${d.key}`} className="font-semibold">{d.label} link</label>
              <p className="text-sm text-muted">{d.hint}</p>
              <input id={`l-${d.key}`} type="url" inputMode="url" autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="https://"
                value={values[d.key] ?? ""} onChange={(e) => onLink(d.key, e.target.value)} className={input} />
              <ul className="mt-1 flex flex-wrap gap-2" aria-label="Link checks">
                <Tick state={t1}>Right kind of link</Tick>
                <Tick state={t2}>{c.phase === "unknown" ? "Could not verify" : "Opens for anyone"}</Tick>
              </ul>
              {c.message && <p role={c.phase === "unknown" ? "status" : "alert"} className={`text-sm ${c.phase === "unknown" ? "text-navy" : "text-fail"}`}>{c.message}</p>}
            </div>
          );
        })}

        <div className="flex flex-col gap-2">
          {submitError && <p role="alert" className="rounded-xl bg-[#fbe9e6] px-4 py-3 text-sm font-medium text-fail">{submitError}</p>}
          <button disabled={!ready || pending} className="rounded-xl bg-brand px-5 py-3.5 font-display text-base font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40">
            {pending ? "Submitting..." : "Submit my work"}
          </button>
          <p className="text-center text-sm text-muted" aria-live="polite">
            {pending ? "" : checking ? "Checking your links..." : ready ? "Everything checks out. You can only submit once, so look over your links." : `Still needed: ${missing.join(", ")}`}
          </p>
        </div>
      </form>
    </>
  );
}
