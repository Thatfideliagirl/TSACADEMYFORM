import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Letters and numbers that are hard to mix up (no 0, O, 1, I, L).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateCode(): string {
  let s = "";
  for (const b of randomBytes(8)) s += ALPHABET[b % ALPHABET.length];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

export const normaliseCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");

// Only a scrambled version of the code is stored, so nobody can read it back later.
export function hashCode(code: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(normaliseCode(code), salt, 32).toString("hex")}`;
}

export function checkCode(code: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const a = scryptSync(normaliseCode(code), salt, 32);
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
