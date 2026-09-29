// The one place that says which kinds of link students can be asked for.
// Built in kinds live here. Staff can also add their own kinds from the Tasks page (stored in the database).
// Either way, every kind is checked the same way: by the address pattern, or by the website it must come from.

export type LinkDef = { key: string; label: string; hint: string; pattern?: RegExp; domains?: string[]; custom?: boolean };
export type CustomLinkType = { key: string; label: string; domains: string[]; hint: string };

export const BUILT_IN_TYPES: LinkDef[] = [
  {
    key: "drive", label: "Google Drive folder",
    hint: "Open the folder in Google Drive, click Share, set General access to Anyone with the link, then copy the link.",
    pattern: /^https?:\/\/drive\.google\.com\/(drive\/(u\/\d+\/)?folders\/|open\?id=)[\w-]+/i,
  },
  {
    key: "gdoc", label: "Google Doc",
    hint: "In your Doc, click Share, set General access to Anyone with the link, then copy the link.",
    pattern: /^https?:\/\/docs\.google\.com\/document\/d\/[\w-]+/i,
  },
  {
    key: "gsheet", label: "Google Sheet",
    hint: "In your Sheet, click Share, set General access to Anyone with the link, then copy the link.",
    pattern: /^https?:\/\/docs\.google\.com\/spreadsheets\/d\/[\w-]+/i,
  },
  {
    key: "gslides", label: "Google Slides",
    hint: "In your presentation, click Share, set General access to Anyone with the link, then copy the link.",
    pattern: /^https?:\/\/docs\.google\.com\/presentation\/d\/[\w-]+/i,
  },
  {
    key: "notion", label: "Notion page",
    hint: "In Notion, click Share, then Publish, turn on Publish to web, and copy the public link.",
    pattern: /^https?:\/\/([\w-]+\.)?(notion\.so|notion\.site)\/\S+/i,
  },
  {
    key: "canva", label: "Canva design",
    hint: "In Canva, click Share, set access to Anyone with the link, then copy the link.",
    pattern: /^https?:\/\/(www\.)?(canva\.com\/design\/\S+|canva\.link\/\S+)/i,
  },
  {
    key: "trello", label: "Trello board",
    hint: "Open your board, click the three dots menu in the top right corner, click Visibility, choose Public, then confirm. Copy the link from your browser's address bar.",
    pattern: /^https?:\/\/(www\.)?trello\.com\/b\/\S+/i,
  },
  {
    key: "gamma", label: "Gamma presentation", domains: ["gamma.app"],
    hint: "In Gamma, click Share, set access to Anyone with the link can view, then copy the link.",
  },
  {
    key: "figma", label: "Figma design", domains: ["figma.com"],
    hint: "In Figma, click Share, set link access to Anyone with the link can view, then copy the link.",
  },
  {
    key: "loom", label: "Loom video", domains: ["loom.com"],
    hint: "In Loom, open the video, click Share, set access to Anyone with the link, then copy the link.",
  },
  {
    key: "github", label: "GitHub repository", domains: ["github.com"],
    hint: "Open the repository, make sure it is set to Public, then copy the address from your browser's address bar.",
  },
  {
    key: "youtube", label: "YouTube video", domains: ["youtube.com", "youtu.be"],
    hint: "Upload the video as Public or Unlisted, then copy the link.",
  },
  {
    key: "miro", label: "Miro board", domains: ["miro.com"],
    hint: "In Miro, click Share, set access to Anyone with the link can view, then copy the link.",
  },
];

export const DEFAULT_CUSTOM_HINT = "Make sure the link opens for anyone without signing in, then copy it.";

// Built in kinds plus any the staff added.
export function allTypes(custom: CustomLinkType[] = []): LinkDef[] {
  return [...BUILT_IN_TYPES, ...custom.map((c) => ({ ...c, hint: c.hint || DEFAULT_CUSTOM_HINT, custom: true }))];
}

export const isBuiltInKey = (k: string) => BUILT_IN_TYPES.some((t) => t.key === k);
export const findType = (key: string, custom: CustomLinkType[] = []) => allTypes(custom).find((t) => t.key === key);

export function hostOf(url: string): string | null {
  try {
    return new URL(url.trim()).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

// Turns whatever staff typed ("https://www.gamma.app/x", "gamma.app, gamma.site") into clean website names.
export function parseWebsites(input: string): string[] {
  const out = new Set<string>();
  for (const part of input.split(/[\s,;]+/)) {
    const host = part.trim().toLowerCase().replace(/^https?:\/\//, "").split(/[/?#]/)[0].replace(/^www\./, "");
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) out.add(host);
  }
  return [...out];
}

export function matchesType(def: LinkDef, url: string): boolean {
  const u = url.trim();
  if (def.pattern) return def.pattern.test(u);
  const host = hostOf(u);
  return !!host && !!def.domains?.some((d) => host === d || host.endsWith(`.${d}`));
}

// Links we recognise but that are the wrong kind of thing for a box.
const OTHER_KINDS: { label: string; pattern: RegExp }[] = [
  { label: "Google Drive file", pattern: /^https?:\/\/drive\.google\.com\/file\//i },
  { label: "Google Form", pattern: /^https?:\/\/(docs\.google\.com\/forms|forms\.gle)\// },
  { label: "Trello card", pattern: /^https?:\/\/(www\.)?trello\.com\/c\//i },
];

export type TypeCheck = { ok: true } | { ok: false; message: string };

// Is this the right kind of link for this box? The message says what it is and what is needed.
export function checkLinkType(def: LinkDef, raw: string, all: LinkDef[] = BUILT_IN_TYPES): TypeCheck {
  const url = raw.trim();
  if (!/^https?:\/\/\S+\.\S+/i.test(url)) {
    return { ok: false, message: "That does not look like a link. It should start with https://" };
  }
  if (matchesType(def, url)) return { ok: true };

  const found = all.find((t) => matchesType(t, url))?.label ?? OTHER_KINDS.find((o) => o.pattern.test(url))?.label ?? null;
  if (def.key === "drive" && found === "Google Drive file") {
    return { ok: false, message: "This is a single file, not a folder. Paste the link to the whole folder." };
  }
  if (found) return { ok: false, message: `This is a ${found} link. This box only takes your ${def.label} link.` };
  const from = def.domains ? ` It should come from ${def.domains.join(" or ")}.` : "";
  return { ok: false, message: `This is not a ${def.label} link.${from} ${def.hint}` };
}
