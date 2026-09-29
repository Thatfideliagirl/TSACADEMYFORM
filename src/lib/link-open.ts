import "server-only";
import { hostOf, type LinkDef } from "@/lib/link-types";

// Does this link open for a stranger (no login, no cookies)?
//   open     a stranger can see it
//   locked   a stranger is turned away (login page, not found, or not shared)
//   unknown  we could not tell (site slow, blocks robots, or changed). The student is NOT blocked.
// We only say "locked" when the site gives a clear sign. Many sites (Canva, Gamma, GitHub) turn robots away
// even for public pages, and a real student must never be locked out because of that.
export type OpenStatus = "open" | "locked" | "unknown";

const UA = "Mozilla/5.0 (compatible; TSAcademySubmit/1.0; link check)";
const LOGIN_HINT = /(accounts\.google\.com|\/servicelogin|\/login|\/signin|\/sign-in|\/sign_in|\/sso\b|\/auth\b)/i;

// Only ever fetch real websites, never addresses inside our own network.
export function isPublicWebsite(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const h = u.hostname.toLowerCase();
  if (h.includes(":") || /^[\d.]+$/.test(h) || h === "localhost" || !h.includes(".")) return false;
  return !/\.(local|internal|localhost|lan|home|corp)$/.test(h);
}

const baseDomain = (h: string) => h.split(".").slice(-2).join(".");

// One retry, because the first request to a site can be slow to connect.
async function get(url: string, init: RequestInit = {}): Promise<Response | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(7000), headers: { "user-agent": UA, accept: "text/html,application/json" }, ...init });
    } catch {
      // try once more
    }
  }
  return null;
}

// Fetch, following a few redirects that stay on the same site. Returns the last response and the final address.
async function follow(url: string, hops = 3): Promise<{ res: Response | null; url: string }> {
  let current = url;
  for (let i = 0; i <= hops; i++) {
    const res = await get(current);
    if (!res) return { res: null, url: current };
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return { res, url: current };
      const next = new URL(loc, current).toString();
      if (LOGIN_HINT.test(next)) return { res, url: next };
      if (!isPublicWebsite(next) || baseDomain(hostOf(next) ?? "") !== baseDomain(hostOf(current) ?? "")) return { res, url: next };
      current = next;
      continue;
    }
    return { res, url: current };
  }
  return { res: null, url: current };
}

async function google(url: string): Promise<OpenStatus> {
  const { res, url: final } = await follow(url);
  if (!res) return "unknown";
  if (LOGIN_HINT.test(final)) return "locked";
  if (res.status === 200) {
    const head = (await res.text()).slice(0, 30000);
    return /<title>[^<]*sign.?in[^<]*<\/title>/i.test(head) ? "locked" : "open";
  }
  if (res.status === 401 || res.status === 404) return "locked";
  return "unknown";
}

async function notion(url: string): Promise<OpenStatus> {
  const path = new URL(url).pathname;
  const id = path.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0]
    ?? path.match(/([0-9a-f]{32})(?:[/?#]|$)/i)?.[1]?.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");
  if (!id) return "unknown";
  const res = await get("https://www.notion.so/api/v3/getPublicPageData", {
    method: "POST",
    headers: { "user-agent": UA, "content-type": "application/json" },
    body: JSON.stringify({ type: "block-space", name: "page", blockId: id, saveParent: false, showMoveTo: false, shouldDuplicate: false, projectManagementLaunch: false, configureOpenInDesktopApp: false, mobileData: { isPush: false } }),
  });
  if (!res || res.status !== 200) return "unknown";
  try {
    const role = (await res.json())?.publicAccessRole;
    if (role === "none") return "locked";
    return typeof role === "string" ? "open" : "unknown";
  } catch {
    return "unknown";
  }
}

async function trello(url: string): Promise<OpenStatus> {
  const id = new URL(url).pathname.match(/^\/b\/([\w]+)/)?.[1];
  if (!id) return "unknown";
  const res = await get(`https://trello.com/1/boards/${id}?fields=name,prefs`);
  if (!res) return "unknown";
  if (res.status === 200) return "open";
  return res.status === 401 || res.status === 404 ? "locked" : "unknown";
}

async function generic(url: string): Promise<OpenStatus> {
  const { res, url: final } = await follow(url);
  if (!res) return "unknown";
  if (LOGIN_HINT.test(final) && !LOGIN_HINT.test(url)) return "locked";
  if (res.status === 200) return "open";
  if (res.status === 401 || res.status === 404 || res.status === 410) return "locked";
  return "unknown";
}

export async function checkOpen(def: LinkDef, url: string): Promise<OpenStatus> {
  if (!isPublicWebsite(url)) return "unknown";
  try {
    if (["drive", "gdoc", "gsheet", "gslides"].includes(def.key)) return await google(url);
    if (def.key === "notion") return await notion(url);
    if (def.key === "trello") return await trello(url);
    return await generic(url);
  } catch {
    return "unknown";
  }
}
