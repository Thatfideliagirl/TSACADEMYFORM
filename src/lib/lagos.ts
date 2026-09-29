// TS Academy works in Lagos time (UTC+1, no daylight saving). Dates typed in forms are read as Lagos time.
const OFFSET = "+01:00";

// "2026-10-05T14:30" (from a date box) becomes a real timestamp, or null if empty.
export function fromLagosInput(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const d = new Date(`${v}${OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// A stored timestamp becomes "2026-10-05T14:30" for a date box.
export function toLagosInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 60 * 60 * 1000);
  return d.toISOString().slice(0, 16);
}

export function showLagos(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}
