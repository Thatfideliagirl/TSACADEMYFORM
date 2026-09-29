import "server-only";
import { headers } from "next/headers";

// The address of this site (for example https://tsacademysubmit.vercel.app), used to build form links.
export async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
}
