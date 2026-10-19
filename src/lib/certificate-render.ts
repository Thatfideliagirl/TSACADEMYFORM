import { CERT_FONTS, type FontKey } from "./certificate-fonts";

// Where and how the name and the date are written on the template. Positions are fractions of the picture, so they work at any size.
export type Box = {
  x: number;        // centre, 0 to 1 across
  y: number;        // centre, 0 to 1 down
  size: number;     // font size as a fraction of the picture width
  maxWidth: number; // the text is shrunk to fit this fraction of the width
  font: FontKey;
  bold: boolean;
  color: string;
};
export type DateFormat = "long" | "short" | "numeric";
export type Boxes = { name: Box; date: Box; dateFormat: DateFormat };

export const DEFAULT_BOXES: Boxes = {
  name: { x: 0.5, y: 0.47, size: 0.055, maxWidth: 0.7, font: "cormorant", bold: true, color: "#0F2544" },
  date: { x: 0.25, y: 0.84, size: 0.022, maxWidth: 0.25, font: "montserrat", bold: false, color: "#0F2544" },
  dateFormat: "long",
};

// "2026-10-20" becomes "20 October 2026". The date is read as a plain day, so no time zone can move it.
export function formatIssueDate(iso: string, format: DateFormat): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (format === "numeric") return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
  return date.toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: format === "long" ? "long" : "short", year: "numeric" });
}

const familyOf = (key: FontKey) => CERT_FONTS.find((f) => f.key === key)?.family ?? "serif";

// Makes sure the fonts are ready before drawing, otherwise the browser quietly uses a plain font.
export async function loadCertificateFonts(boxes: Boxes) {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all([boxes.name, boxes.date].map((b) => document.fonts.load(`${b.bold ? 700 : 400} 40px ${familyOf(b.font)}`, "Aa").catch(() => [])));
}

function writeText(ctx: CanvasRenderingContext2D, width: number, height: number, box: Box, text: string) {
  if (!text) return null;
  const weight = box.bold && CERT_FONTS.find((f) => f.key === box.font)?.bold ? 700 : 400;
  let px = Math.max(8, box.size * width);
  const limit = box.maxWidth * width;
  const set = () => { ctx.font = `${weight} ${px}px ${familyOf(box.font)}`; };
  set();
  // A long name is made smaller until it fits, so it never runs off the certificate.
  while (ctx.measureText(text).width > limit && px > 10) { px -= 1; set(); }
  ctx.fillStyle = box.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, box.x * width, box.y * height);
  const w = ctx.measureText(text).width;
  return { x: box.x * width - w / 2, y: box.y * height - px / 2, w, h: px };
}

// Draws the template and writes the name and the date on it. Returns where each text landed (used by the editor).
export function drawCertificate(ctx: CanvasRenderingContext2D, img: CanvasImageSource, width: number, height: number, boxes: Boxes, name: string, dateText: string) {
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return { name: writeText(ctx, width, height, boxes.name, name), date: writeText(ctx, width, height, boxes.date, dateText) };
}
