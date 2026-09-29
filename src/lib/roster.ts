// Reading a student list from a spreadsheet. Used in the browser (preview) and again on the server (import).

// A proper email shape: letters, numbers and the usual symbols before the @, then a real looking website name that ends in letters.
export const EMAIL_RE = /^(?!\.)(?!.*\.\.)[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+(?<!\.)@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

// Common ways people misspell the big email websites. A match is flagged so it can be fixed before it is saved.
const TYPO_DOMAINS: Record<string, string> = {
  "gmial.com": "gmail.com", "gmal.com": "gmail.com", "gmai.com": "gmail.com", "gamil.com": "gmail.com", "gmaill.com": "gmail.com",
  "gmail.con": "gmail.com", "gmail.cm": "gmail.com", "gmail.om": "gmail.com", "gmail.comm": "gmail.com", "gmail.co.com": "gmail.com", "gmail.cim": "gmail.com",
  "gnail.com": "gmail.com", "gmeil.com": "gmail.com", "gmail.vom": "gmail.com", "gmail.xom": "gmail.com",
  "yaho.com": "yahoo.com", "yahooo.com": "yahoo.com", "yahoo.con": "yahoo.com", "yahoo.cm": "yahoo.com", "yhoo.com": "yahoo.com", "yahou.com": "yahoo.com",
  "hotmial.com": "hotmail.com", "hotmai.com": "hotmail.com", "hotmail.con": "hotmail.com", "hotmal.com": "hotmail.com", "hotnail.com": "hotmail.com",
  "outlok.com": "outlook.com", "outlook.con": "outlook.com", "outllok.com": "outlook.com", "iclod.com": "icloud.com", "icloud.con": "icloud.com",
};
export const domainOf = (email: string) => email.slice(email.lastIndexOf("@") + 1);
export const normaliseEmail = (e: string) => e.trim().toLowerCase();
export const cleanName = (n: string) => n.replace(/\s+/g, " ").trim();

// Find which column holds names and which holds emails, from the header row.
export function detectColumns(headers: string[]): { name: number; email: number } {
  const h = headers.map((x) => String(x ?? "").toLowerCase().replace(/[^a-z]/g, ""));
  const email = h.findIndex((x) => x.includes("email") || x === "mail");
  let name = h.findIndex((x) => x === "fullname" || x === "studentname" || x === "name");
  if (name < 0) name = h.findIndex((x, i) => i !== email && x.includes("name") && !x.includes("user"));
  if (name < 0) name = h.findIndex((x, i) => i !== email && (x.includes("first") || x.includes("student")));
  return { name, email };
}

export type RowProblem = "ok" | "missing_name" | "missing_email" | "bad_email" | "typo_domain" | "bad_domain" | "duplicate_in_file" | "already_in_course";

export const PROBLEM_TEXT: Record<Exclude<RowProblem, "ok">, string> = {
  missing_name: "Missing name",
  missing_email: "Missing email",
  bad_email: "Email is not typed correctly",
  typo_domain: "The website part of this email looks misspelled",
  bad_domain: "This email website does not exist or cannot receive mail",
  duplicate_in_file: "Same email appears earlier in this file",
  already_in_course: "Already on this course's list",
};

export type CheckedRow = { name: string; email: string; problem: RowProblem; hint?: string };

export function checkRows(rows: { name: string; email: string }[], existingEmails: Iterable<string>, badDomains: ReadonlySet<string> = new Set()): CheckedRow[] {
  const existing = new Set([...existingEmails].map(normaliseEmail));
  const seen = new Set<string>();
  return rows.map((r) => {
    const name = cleanName(r.name ?? "");
    const email = normaliseEmail(r.email ?? "");
    let problem: RowProblem = "ok";
    let hint: string | undefined;
    const domain = EMAIL_RE.test(email) ? domainOf(email) : "";
    if (!email) problem = "missing_email";
    else if (!EMAIL_RE.test(email)) problem = "bad_email";
    else if (TYPO_DOMAINS[domain]) { problem = "typo_domain"; hint = `Did you mean ${email.slice(0, email.lastIndexOf("@") + 1)}${TYPO_DOMAINS[domain]}?`; }
    else if (badDomains.has(domain)) problem = "bad_domain";
    else if (!name) problem = "missing_name";
    else if (seen.has(email)) problem = "duplicate_in_file";
    else if (existing.has(email)) problem = "already_in_course";
    if (email && EMAIL_RE.test(email)) seen.add(email);
    return { name, email, problem, hint };
  });
}
