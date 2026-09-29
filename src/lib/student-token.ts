import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// A short lived pass that proves a student typed a name and email that are on the list.
// It is signed, so it cannot be forged or edited. The signing key is derived from the secret Supabase key.
export type StudentPass = { sid: string; cc: string; exp: number };

const TWO_HOURS = 2 * 60 * 60 * 1000;

function key() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  return createHmac("sha256", secret).update("ts-academy-submit/student-pass/v1").digest();
}

const sign = (body: string) => createHmac("sha256", key()).update(body).digest("base64url");

export function issuePass(studentId: string, cohortCourseId: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ sid: studentId, cc: cohortCourseId, exp: now + TWO_HOURS } satisfies StudentPass)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readPass(token: string, now = Date.now()): StudentPass | null {
  if (typeof token !== "string") return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const pass = JSON.parse(Buffer.from(body, "base64url").toString()) as StudentPass;
    return pass.exp > now && pass.sid && pass.cc ? pass : null;
  } catch {
    return null;
  }
}
