// Reading a student list from a spreadsheet. Used in the browser (preview) and again on the server (import).

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
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

export type RowProblem = "ok" | "missing_name" | "missing_email" | "bad_email" | "duplicate_in_file" | "already_in_course";

export const PROBLEM_TEXT: Record<Exclude<RowProblem, "ok">, string> = {
  missing_name: "Missing name",
  missing_email: "Missing email",
  bad_email: "Email is not typed correctly",
  duplicate_in_file: "Same email appears earlier in this file",
  already_in_course: "Already on this course's list",
};

export type CheckedRow = { name: string; email: string; problem: RowProblem };

export function checkRows(rows: { name: string; email: string }[], existingEmails: Iterable<string>): CheckedRow[] {
  const existing = new Set([...existingEmails].map(normaliseEmail));
  const seen = new Set<string>();
  return rows.map((r) => {
    const name = cleanName(r.name ?? "");
    const email = normaliseEmail(r.email ?? "");
    let problem: RowProblem = "ok";
    if (!email) problem = "missing_email";
    else if (!EMAIL_RE.test(email)) problem = "bad_email";
    else if (!name) problem = "missing_name";
    else if (seen.has(email)) problem = "duplicate_in_file";
    else if (existing.has(email)) problem = "already_in_course";
    if (email && EMAIL_RE.test(email)) seen.add(email);
    return { name, email, problem };
  });
}
