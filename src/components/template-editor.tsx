"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveTemplate } from "@/app/actions/certificates";
import { CERT_FONT_CLASS, CERT_FONTS } from "@/lib/certificate-fonts";
import { DEFAULT_BOXES, DEFAULT_NUMBER_BOX, drawCertificate, formatIssueDate, loadCertificateFonts, type Box, type Boxes, type DateFormat } from "@/lib/certificate-render";

type Initial = { url: string; width: number; height: number; boxes: Boxes } | null;
type Which = "name" | "date" | "number";
const SAMPLE_NUMBER = "TSRJ7C7W89W7B5";

const field = "rounded-xl border-[1.5px] border-line bg-white px-3 py-2 focus:border-brand focus:outline-none";
const SAMPLE = { short: "Adaeze Okafor", long: "Oluwaseun Adebayo-Johnson Chukwuemeka" };

// Shrinks a big picture so it can be sent. A certificate does not need more than about 2400 pixels across.
async function shrink(file: File): Promise<{ data: string; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("unreadable")); i.src = url; });
    const scale = Math.min(1, 2400 / img.naturalWidth);
    const width = Math.round(img.naturalWidth * scale), height = Math.round(img.naturalHeight * scale);
    const c = document.createElement("canvas"); c.width = width; c.height = height;
    const ctx = c.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, width, height); ctx.drawImage(img, 0, 0, width, height);
    for (const q of [0.92, 0.85, 0.78, 0.7, 0.6, 0.5]) { const data = c.toDataURL("image/jpeg", q); if (data.length < 3_300_000) return { data, width, height }; }
    throw new Error("too large");
  } finally { URL.revokeObjectURL(url); }
}

export function TemplateEditor({ courseId, initial }: { courseId: string; initial: Initial }) {
  const [img, setImg] = useState<{ el: HTMLImageElement; width: number; height: number } | null>(null);
  const [newImage, setNewImage] = useState<{ data: string; width: number; height: number } | null>(null);
  const [boxes, setBoxes] = useState<Boxes>(initial?.boxes ?? DEFAULT_BOXES);
  const [active, setActive] = useState<Which>("name");
  const [sample, setSample] = useState(SAMPLE.short);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const canvas = useRef<HTMLCanvasElement>(null);
  const dragging = useRef(false);

  // Load the saved template picture once.
  useEffect(() => {
    if (!initial) return;
    const el = new Image();
    el.onload = () => setImg({ el, width: initial.width, height: initial.height });
    el.src = initial.url;
  }, [initial]);

  // Draw the picture with a sample name and date whenever anything changes.
  useEffect(() => {
    const c = canvas.current;
    if (!c || !img) return;
    let stale = false;
    loadCertificateFonts(boxes).then(() => {
      if (stale) return;
      c.width = img.width; c.height = img.height;
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
      const drawn = drawCertificate(c.getContext("2d")!, img.el, img.width, img.height, boxes, sample, formatIssueDate(today, boxes.dateFormat), SAMPLE_NUMBER);
      // A faint outline around the part being moved, so it is easy to find.
      const hit = active === "number" ? drawn.number : drawn[active];
      if (hit) { const ctx = c.getContext("2d")!; ctx.save(); ctx.strokeStyle = "#1A5BB8"; ctx.setLineDash([12, 8]); ctx.lineWidth = Math.max(2, img.width / 500); ctx.strokeRect(hit.x - 12, hit.y - 8, hit.w + 24, hit.h + 16); ctx.restore(); }
    });
    return () => { stale = true; };
  }, [img, boxes, sample, active]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    try {
      const shrunk = await shrink(file);
      const el = new Image();
      await new Promise<void>((ok, no) => { el.onload = () => ok(); el.onerror = () => no(); el.src = shrunk.data; });
      setNewImage(shrunk); setImg({ el, width: shrunk.width, height: shrunk.height });
    } catch {
      setMessage({ kind: "error", text: "That picture could not be used. Choose a JPG or PNG of your certificate." });
    }
  }

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging.current || !canvas.current) return;
    const r = canvas.current.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    setBoxes((b) => ({ ...b, [active]: { ...(b[active] ?? DEFAULT_NUMBER_BOX), x, y } }));
  };

  const set = (patch: Partial<Box>) => setBoxes((b) => ({ ...b, [active]: { ...(b[active] ?? DEFAULT_NUMBER_BOX), ...patch } }));
  const box = boxes[active] ?? DEFAULT_NUMBER_BOX;
  const bold = CERT_FONTS.find((f) => f.key === box.font)?.bold ?? false;

  function save() {
    setMessage(null);
    start(async () => {
      const r = await saveTemplate({ courseId, boxes, ...(newImage ? { image: newImage.data, width: newImage.width, height: newImage.height } : {}) });
      setMessage(r.ok ? { kind: "ok", text: "Saved. Every cohort of this course will use this template." } : { kind: "error", text: r.error });
      if (r.ok) setNewImage(null);
    });
  }

  return (
    <div className={`flex flex-col gap-6 ${CERT_FONT_CLASS}`}>
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-xl bg-brand px-5 py-2.5 font-display font-semibold text-white hover:bg-brand-dark focus-within:outline focus-within:outline-2">
          {img ? "Choose a different picture" : "Choose the certificate picture"}
          <input id="template-file" type="file" accept="image/jpeg,image/png" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <span className="text-sm text-muted">A JPG or PNG of the blank certificate, with the course name and the signature already on it.</span>
      </div>

      {!img ? (
        <p className="rounded-2xl border border-dashed border-line bg-white px-6 py-12 text-center text-muted">No template yet. Choose the picture, then place the name and the date on it.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-2">
            <canvas ref={canvas} aria-label="Certificate preview. Drag to move the selected text." className="w-full touch-none rounded-xl border border-line bg-white shadow-sm"
              style={{ aspectRatio: `${img.width} / ${img.height}`, cursor: "grab" }}
              onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); move(e); }}
              onPointerMove={move} onPointerUp={() => { dragging.current = false; }} onPointerCancel={() => { dragging.current = false; }} />
            <p className="text-sm text-muted">Drag on the picture to move the text you are editing. The sample name and the date of today show how it will look.</p>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-4">
            <div role="radiogroup" aria-label="Which text to edit" className="grid grid-cols-3 gap-2">
              {(["name", "date", "number"] as const).map((w) => (
                <button key={w} type="button" role="radio" aria-checked={active === w}
                  onClick={() => { if (w === "number" && !boxes.number) setBoxes((b) => ({ ...b, number: DEFAULT_NUMBER_BOX })); setActive(w); }}
                  className={`rounded-xl border-[1.5px] px-2 py-2 text-sm font-semibold ${active === w ? "border-brand bg-sky text-brand" : "border-line"}`}>
                  {w === "name" ? "Student name" : w === "date" ? "Date of issue" : "Certificate number"}
                </button>
              ))}
            </div>
            {active === "number" && (
              <label className="flex items-start gap-3 text-sm font-medium">
                <input type="checkbox" checked={!!boxes.number} onChange={(e) => { if (!e.target.checked) { setBoxes((b) => { const { number, ...rest } = b; void number; return rest; }); setActive("name"); } }} className="mt-0.5 h-5 w-5 accent-brand" />
                <span>Print a certificate number. Each certificate gets its own, like {SAMPLE_NUMBER}. Untick to leave it off.</span>
              </label>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="font" className="text-sm font-semibold">Font</label>
              <select id="font" value={box.font} onChange={(e) => set({ font: e.target.value as Box["font"] })} className={field}>
                {CERT_FONTS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
            </div>
            <label className={`flex items-center gap-3 font-medium ${bold ? "" : "opacity-50"}`}>
              <input type="checkbox" checked={bold && box.bold} disabled={!bold} onChange={(e) => set({ bold: e.target.checked })} className="h-5 w-5 accent-brand" /> Bold
            </label>
            <Slider id="size" label="Size" value={box.size * 100} min={1} max={12} step={0.1} onChange={(v) => set({ size: v / 100 })} suffix="%" />
            <Slider id="maxw" label="Longest it may be (longer names shrink to fit)" value={box.maxWidth * 100} min={10} max={100} step={1} onChange={(v) => set({ maxWidth: v / 100 })} suffix="%" />
            <Slider id="px" label="Across" value={box.x * 100} min={0} max={100} step={0.1} onChange={(v) => set({ x: v / 100 })} suffix="%" />
            <Slider id="py" label="Down" value={box.y * 100} min={0} max={100} step={0.1} onChange={(v) => set({ y: v / 100 })} suffix="%" />
            <div className="flex items-center gap-3">
              <label htmlFor="color" className="text-sm font-semibold">Colour</label>
              <input id="color" type="color" value={box.color} onChange={(e) => set({ color: e.target.value })} className="h-9 w-14 cursor-pointer rounded-lg border border-line bg-white" />
            </div>

            {active === "date" && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="datefmt" className="text-sm font-semibold">How the date is written</label>
                <select id="datefmt" value={boxes.dateFormat} onChange={(e) => setBoxes((b) => ({ ...b, dateFormat: e.target.value as DateFormat }))} className={field}>
                  <option value="us">October 20, 2026</option>
                  <option value="long">20 October 2026</option>
                  <option value="short">20 Oct 2026</option>
                  <option value="numeric">20/10/2026</option>
                </select>
              </div>
            )}
            {active === "name" && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="sample" className="text-sm font-semibold">Sample name to test with</label>
                <input id="sample" value={sample} onChange={(e) => setSample(e.target.value)} className={field} />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setSample(SAMPLE.short)} className="rounded-lg border-[1.5px] border-line px-3 py-1.5 text-sm font-semibold text-brand hover:bg-sky">Short name</button>
                  <button type="button" onClick={() => setSample(SAMPLE.long)} className="rounded-lg border-[1.5px] border-line px-3 py-1.5 text-sm font-semibold text-brand hover:bg-sky">Very long name</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {message && <p role={message.kind === "error" ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-sm font-medium ${message.kind === "error" ? "bg-[#fbe9e6] text-fail" : "bg-[#e1f2e9] text-pass"}`}>{message.text}</p>}

      {img && (
        <div>
          <button type="button" onClick={save} disabled={pending} className="rounded-xl bg-brand px-6 py-3 font-display text-base font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
            {pending ? "Saving..." : "Save template"}
          </button>
        </div>
      )}
    </div>
  );
}

function Slider({ id, label, value, min, max, step, onChange, suffix }: { id: string; label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; suffix: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex justify-between text-sm font-semibold"><span>{label}</span><span className="text-muted">{value.toFixed(1)}{suffix}</span></label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-brand" />
    </div>
  );
}
