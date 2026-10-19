"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { findCertificate, type CollectResult } from "@/app/actions/certificate-collect";
import { CERT_FONT_CLASS } from "@/lib/certificate-fonts";
import { drawCertificate, formatIssueDate, loadCertificateFonts } from "@/lib/certificate-render";
import { useHydrated } from "./use-hydrated";

const card = "rounded-2xl border border-line bg-white p-5 shadow-sm";
const input = "rounded-xl border-[1.5px] border-line bg-white px-4 py-3 text-base focus:border-brand focus:outline-none";
type Issued = Extract<CollectResult, { ok: true; state: "issued" }>;

export function CertificateCollect({ formSlug, courseName, cohortName }: { formSlug: string; courseName: string; cohortName: string }) {
  const hydrated = useHydrated();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<CollectResult | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    start(async () => {
      const r = await findCertificate({ formSlug, name, email });
      if (!r.ok) return setError(r.error);
      setResult(r);
    });
  }

  const header = (
    <div className="mb-6 flex flex-col gap-3">
      <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight">Collect your certificate</h1>
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-sky-deep px-3 py-1 text-sm font-semibold">{courseName}</span>
        <span className="rounded-full bg-sky-deep px-3 py-1 text-sm font-semibold">{cohortName}</span>
      </div>
    </div>
  );

  if (result?.ok && result.state === "issued") return <div className={CERT_FONT_CLASS}>{header}<Ready data={result} onBack={() => setResult(null)} /></div>;

  if (result?.ok) {
    return (
      <>
        {header}
        <div className={`${card} flex flex-col gap-3`}>
          <h2 className="font-display text-xl font-semibold">Hello, {result.name}</h2>
          <p>{result.state === "approved"
            ? "Your certificate is not ready yet. TS Academy will email you when it is issued. You can use this same link then."
            : "You are not on the list for a certificate yet. If you think this is a mistake, contact your cohort lead."}</p>
          <button type="button" onClick={() => setResult(null)} className="self-start rounded-lg border-[1.5px] border-line px-4 py-2 font-semibold text-brand hover:bg-sky">Not you? Change your details</button>
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      <form onSubmit={onSubmit} className={`${card} flex flex-col gap-5`}>
        <p className="text-muted">Use exactly the name and email you registered with. Your certificate opens when it has been issued.</p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="font-semibold">Full name</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required className={input} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="font-semibold">Email you registered with</label>
          <input id="email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required className={input} />
        </div>
        {error && <p role="alert" className="rounded-xl bg-[#fbe9e6] px-4 py-3 text-sm font-medium text-fail">{error}</p>}
        <button disabled={pending || !hydrated} className="rounded-xl bg-brand px-5 py-3.5 font-display text-base font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
          {pending ? "Checking..." : "Continue"}
        </button>
      </form>
    </>
  );
}

// Draws the certificate in the browser, with the name and the issue date, and offers it as a PDF or a picture.
function Ready({ data, onBack }: { data: Issued; onBack: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [shown, setShown] = useState(false);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let stale = false;
    const el = new Image();
    el.onload = async () => {
      await loadCertificateFonts(data.boxes);
      const c = canvas.current;
      if (stale || !c) return;
      c.width = data.width; c.height = data.height;
      drawCertificate(c.getContext("2d")!, el, data.width, data.height, data.boxes, data.name, formatIssueDate(data.issueDate, data.boxes.dateFormat), data.certificateNo);
      setShown(true);
    };
    el.onerror = () => { if (!stale) setProblem("The certificate picture could not be loaded. Refresh the page and try again."); };
    el.src = `/api/certificate-template/${data.courseId}?v=${encodeURIComponent(data.version)}`;
    return () => { stale = true; };
  }, [data]);

  const blob = (type: string, q?: number) => new Promise<Blob>((ok, no) => canvas.current?.toBlob((b) => (b ? ok(b) : no(new Error("empty"))), type, q));
  const save = (b: Blob, file: string) => { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = file; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };

  async function pdf() {
    setBusy(true); setProblem("");
    try {
      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.create();
      const jpg = await doc.embedJpg(await (await blob("image/jpeg", 0.95)).arrayBuffer());
      const w = 842, h = Math.round((842 * data.height) / data.width);
      doc.addPage([w, h]).drawImage(jpg, { x: 0, y: 0, width: w, height: h });
      doc.setTitle(`${data.fileName}`);
      save(new Blob([new Uint8Array(await doc.save())], { type: "application/pdf" }), `${data.fileName}.pdf`);
    } catch { setProblem("The PDF could not be made. Try Download picture instead."); }
    setBusy(false);
  }
  async function picture() {
    setBusy(true); setProblem("");
    try { save(await blob("image/png"), `${data.fileName}.png`); } catch { setProblem("The picture could not be made. Refresh the page and try again."); }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg">Congratulations, <span className="font-semibold">{data.name}</span>.</p>
      <canvas ref={canvas} aria-label={`Certificate for ${data.name}`} className="w-full rounded-xl border border-line bg-white shadow-md" style={{ aspectRatio: `${data.width} / ${data.height}` }} />
      {problem && <p role="alert" className="rounded-xl bg-[#fbe9e6] px-4 py-3 text-sm font-medium text-fail">{problem}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={pdf} disabled={!shown || busy} className="rounded-xl bg-brand px-6 py-3 font-display text-base font-semibold text-white hover:bg-brand-dark disabled:opacity-50">{busy ? "Please wait..." : "Download PDF"}</button>
        <button type="button" onClick={picture} disabled={!shown || busy} className="rounded-xl border-[1.5px] border-brand px-5 py-3 font-semibold text-brand hover:bg-sky disabled:opacity-50">Download picture</button>
      </div>
      <button type="button" onClick={onBack} className="self-start text-sm font-semibold text-brand underline">Not you? Change your details</button>
    </div>
  );
}
