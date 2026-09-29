// The one place that says which kinds of link students can be asked for.
// To add a new kind, add a line here. Everything else (task form, student form, checks) follows.

export type LinkTypeKey = "drive" | "gdoc" | "gsheet" | "gslides" | "notion" | "canva" | "trello";

export const LINK_TYPES: Record<LinkTypeKey, { label: string; hint: string; pattern: RegExp }> = {
  drive: {
    label: "Google Drive folder",
    hint: "Open the folder in Google Drive, click Share, set General access to Anyone with the link, then copy the link.",
    pattern: /^https?:\/\/drive\.google\.com\/(drive\/(u\/\d+\/)?folders\/|open\?id=)[\w-]+/i,
  },
  gdoc: {
    label: "Google Doc",
    hint: "In your Doc, click Share, set General access to Anyone with the link, then copy the link.",
    pattern: /^https?:\/\/docs\.google\.com\/document\/d\/[\w-]+/i,
  },
  gsheet: {
    label: "Google Sheet",
    hint: "In your Sheet, click Share, set General access to Anyone with the link, then copy the link.",
    pattern: /^https?:\/\/docs\.google\.com\/spreadsheets\/d\/[\w-]+/i,
  },
  gslides: {
    label: "Google Slides",
    hint: "In your presentation, click Share, set General access to Anyone with the link, then copy the link.",
    pattern: /^https?:\/\/docs\.google\.com\/presentation\/d\/[\w-]+/i,
  },
  notion: {
    label: "Notion page",
    hint: "In Notion, click Share, then Publish, turn on Publish to web, and copy the public link.",
    pattern: /^https?:\/\/([\w-]+\.)?(notion\.so|notion\.site)\/\S+/i,
  },
  canva: {
    label: "Canva design",
    hint: "In Canva, click Share, set access to Anyone with the link, then copy the link.",
    pattern: /^https?:\/\/(www\.)?(canva\.com\/design\/\S+|canva\.link\/\S+)/i,
  },
  trello: {
    label: "Trello board",
    hint: "Open your board, click the three dots menu in the top right corner, click Visibility, choose Public, then confirm. Copy the link from your browser's address bar.",
    pattern: /^https?:\/\/(www\.)?trello\.com\/b\/\S+/i,
  },
};

export const LINK_TYPE_KEYS = Object.keys(LINK_TYPES) as LinkTypeKey[];

export const isLinkTypeKey = (k: string): k is LinkTypeKey => k in LINK_TYPES;

// Links we recognise but that are the wrong kind of thing for a box. Used to say what was pasted.
const OTHER_KINDS: { label: string; pattern: RegExp }[] = [
  { label: "Google Drive file", pattern: /^https?:\/\/drive\.google\.com\/file\//i },
  { label: "Google Form", pattern: /^https?:\/\/(docs\.google\.com\/forms|forms\.gle)\// },
  { label: "Trello card", pattern: /^https?:\/\/(www\.)?trello\.com\/c\//i },
];

export type TypeCheck = { ok: true } | { ok: false; message: string };

// Is this the right kind of link for this box? The message says what it is and what is needed.
export function checkLinkType(key: LinkTypeKey, raw: string): TypeCheck {
  const url = raw.trim();
  const wanted = LINK_TYPES[key];
  if (!/^https?:\/\/\S+\.\S+/i.test(url)) {
    return { ok: false, message: "That does not look like a link. It should start with https://" };
  }
  if (wanted.pattern.test(url)) return { ok: true };

  let found: string | null = null;
  for (const k of LINK_TYPE_KEYS) if (LINK_TYPES[k].pattern.test(url)) { found = LINK_TYPES[k].label; break; }
  if (!found) for (const o of OTHER_KINDS) if (o.pattern.test(url)) { found = o.label; break; }

  if (key === "drive" && found === "Google Drive file") {
    return { ok: false, message: "This is a single file, not a folder. Paste the link to the whole folder." };
  }
  return {
    ok: false,
    message: found
      ? `This is a ${found} link. This box only takes your ${wanted.label} link.`
      : `This is not a ${wanted.label} link. ${wanted.hint}`,
  };
}
