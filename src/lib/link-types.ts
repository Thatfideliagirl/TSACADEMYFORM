// The one place that says which kinds of link students can be asked for.
// Built in kinds live here. Staff can also add their own kinds from the Tasks page (stored in the database).
// Either way, every kind is checked the same way: by the address pattern, or by the website it must come from.

export type LinkDef = { key: string; label: string; hint: string; pattern?: RegExp; domains?: string[]; custom?: boolean; more?: boolean };
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
  // More kinds, shown under "More kinds of link" when setting up a task.
  { key: "gfile", label: "Google Drive file", hint: "In Google Drive, right click the file, click Share, set General access to Anyone with the link, then copy the link.", pattern: /^https?:\/\/drive\.google\.com\/file\/d\/[\w-]+/i, more: true },
  { key: "gform", label: "Google Form", hint: "Open the form, click Send, then the link tab, and copy the link. Make sure the form accepts responses from anyone.", pattern: /^https?:\/\/(docs\.google\.com\/forms\/|forms\.gle\/)\S+/i, more: true },
  { key: "gsites", label: "Google Site", domains: ["sites.google.com"], hint: "In Google Sites, click Publish, choose who can view as Anyone, then copy the published link.", more: true },
  { key: "looker", label: "Looker Studio report", domains: ["lookerstudio.google.com", "datastudio.google.com"], hint: "In Looker Studio, click Share, set link sharing to Anyone with the link can view, then copy the link.", more: true },
  { key: "colab", label: "Google Colab notebook", domains: ["colab.research.google.com"], hint: "In Colab, click Share, set General access to Anyone with the link, then copy the link.", more: true },
  { key: "msfile", label: "Microsoft Word, Excel or PowerPoint file", domains: ["1drv.ms", "onedrive.live.com", "sharepoint.com", "office.com"], hint: "In OneDrive or SharePoint, click Share, choose Anyone with the link can view, then copy the link.", more: true },
  { key: "msform", label: "Microsoft Form", domains: ["forms.office.com", "forms.microsoft.com"], hint: "Open the form, click Share, choose Anyone can respond, then copy the link.", more: true },
  { key: "powerbi", label: "Power BI report", domains: ["app.powerbi.com", "powerbi.com"], hint: "Publish the report to the web, then copy the public link.", more: true },
  { key: "behance", label: "Behance project", domains: ["behance.net"], hint: "Publish the project as Public on Behance, then copy the project address.", more: true },
  { key: "dribbble", label: "Dribbble shot", domains: ["dribbble.com"], hint: "Open your shot on Dribbble and copy the address from your browser.", more: true },
  { key: "adobe", label: "Adobe Express or Portfolio", domains: ["express.adobe.com", "adobe.com", "myportfolio.com"], hint: "Share the design or portfolio with Anyone with the link, then copy the link.", more: true },
  { key: "gitlab", label: "GitLab repository", domains: ["gitlab.com"], hint: "Set the project visibility to Public, then copy the address from your browser.", more: true },
  { key: "bitbucket", label: "Bitbucket repository", domains: ["bitbucket.org"], hint: "Set the repository to Public, then copy the address from your browser.", more: true },
  { key: "codepen", label: "CodePen", domains: ["codepen.io"], hint: "Save your pen, then copy its address from your browser.", more: true },
  { key: "replit", label: "Replit project", domains: ["replit.com"], hint: "Make the project public, then copy its address.", more: true },
  { key: "kaggle", label: "Kaggle notebook", domains: ["kaggle.com"], hint: "Make the notebook public, then copy its address.", more: true },
  { key: "website", label: "Published website", domains: ["vercel.app", "netlify.app", "github.io", "pages.dev", "onrender.com", "wixsite.com", "webflow.io", "framer.website", "carrd.co"], hint: "Publish your site, open it in a private window to check it loads, then copy the address.", more: true },
  { key: "medium", label: "Medium or Substack article", domains: ["medium.com", "substack.com"], hint: "Publish the article, then copy its address.", more: true },
  { key: "vimeo", label: "Vimeo video", domains: ["vimeo.com"], hint: "Set the video privacy so anyone with the link can watch, then copy the link.", more: true },
  { key: "dropbox", label: "Dropbox file or folder", domains: ["dropbox.com"], hint: "Click Share, create a link anyone can view, then copy it.", more: true },
  { key: "linkedin", label: "LinkedIn profile or post", domains: ["linkedin.com"], hint: "Open your profile or post and copy the address from your browser.", more: true },
  { key: "instagram", label: "Instagram profile or post", domains: ["instagram.com"], hint: "Make the account public, then copy the profile or post link.", more: true },
  { key: "xposts", label: "X (Twitter) profile or post", domains: ["x.com", "twitter.com"], hint: "Open the profile or post and copy the address from your browser.", more: true },
  { key: "facebook", label: "Facebook page or post", domains: ["facebook.com", "fb.com"], hint: "Make the page or post public, then copy its link.", more: true },
  { key: "tiktok", label: "TikTok video or profile", domains: ["tiktok.com"], hint: "Make the account public, then copy the link.", more: true },
  { key: "airtable", label: "Airtable base or view", domains: ["airtable.com"], hint: "Click Share, create a shared view link anyone can open, then copy it.", more: true },
  { key: "clickup", label: "ClickUp", domains: ["clickup.com"], hint: "Open the share options, turn on public sharing, then copy the link.", more: true },
  { key: "asana", label: "Asana project", domains: ["asana.com"], hint: "Share the project with a link anyone can view, then copy it.", more: true },
  { key: "monday", label: "monday.com board", domains: ["monday.com"], hint: "Click Share, enable sharing with anyone with the link, then copy it.", more: true },
  { key: "coda", label: "Coda doc", domains: ["coda.io"], hint: "Click Share, turn on Publish to web, then copy the link.", more: true },
  { key: "lucid", label: "Lucid diagram", domains: ["lucid.app", "lucidchart.com"], hint: "Click Share, set the link so anyone can view, then copy it.", more: true },
  { key: "whimsical", label: "Whimsical board", domains: ["whimsical.com"], hint: "Click Share, set the link so anyone can view, then copy it.", more: true },
  { key: "padlet", label: "Padlet", domains: ["padlet.com"], hint: "Open Share, set the privacy to Public, then copy the link.", more: true },
  { key: "prezi", label: "Prezi presentation", domains: ["prezi.com"], hint: "Click Share, make it viewable by anyone with the link, then copy it.", more: true },
  { key: "pitch", label: "Pitch presentation", domains: ["pitch.com"], hint: "Click Share, turn on link sharing for anyone, then copy it.", more: true },
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
