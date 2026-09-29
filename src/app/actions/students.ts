"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/staff";
import { resolveMx, resolve4, resolve6 } from "node:dns/promises";
import { checkRows, domainOf, EMAIL_RE, cleanName, normaliseEmail, PROBLEM_TEXT, type RowProblem } from "@/lib/roster";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const listPath = (f: FormData) => `/dashboard/cohorts/${str(f, "cohort_slug")}/${str(f, "course_slug")}/students`;
const back = (path: string, kind: "error" | "ok", message: string): never => redirect(`${path}?${kind}=${encodeURIComponent(message)}`);

// Which of these email websites clearly cannot receive mail? Only a definite "no such website" counts.
// If the lookup is slow or fails for any other reason, the website is given the benefit of the doubt.
async function domainCannotReceiveMail(domain: string): Promise<boolean> {
  const gone = (e: unknown) => ["ENOTFOUND", "ENODATA"].includes((e as { code?: string })?.code ?? "");
  const withLimit = <T,>(p: Promise<T>) => Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no({ code: "ETIMEOUT" }), 4000))]);
  try {
    const mx = await withLimit(resolveMx(domain));
    if (mx.length) return false;
  } catch (e) { if (!gone(e)) return false; }
  for (const look of [resolve4, resolve6]) {
    try { if ((await withLimit(look(domain))).length) return false; } catch (e) { if (!gone(e)) return false; }
  }
  return true;
}

export async function findBadDomains(domains: string[]): Promise<string[]> {
  await requireStaff();
  const unique = [...new Set((Array.isArray(domains) ? domains : []).map((d) => String(d).toLowerCase()).filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)))].slice(0, 400);
  const bad: string[] = [];
  for (let i = 0; i < unique.length; i += 20) {
    const part = unique.slice(i, i + 20);
    const results = await Promise.all(part.map((d) => domainCannotReceiveMail(d)));
    part.forEach((d, j) => { if (results[j]) bad.push(d); });
  }
  return bad;
}

export type ImportResult = { error?: string; added?: number; skipped?: { reason: string; count: number }[] };

// Re-checks every row on the server (the browser preview is a convenience, not trusted), then saves the clean ones.
export async function importStudents(cohortCourseId: string, rows: { name: string; email: string }[]): Promise<ImportResult> {
  const { supabase } = await requireStaff();
  if (!Array.isArray(rows) || rows.length === 0) return { error: "There are no rows to import." };
  if (rows.length > 5000) return { error: "That file has more than 5000 rows. Split it into smaller files." };

  const existing: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("students").select("email").eq("cohort_course_id", cohortCourseId).range(from, from + 999);
    if (error) return { error: "Could not read the current student list. Please try again." };
    existing.push(...(data ?? []).map((r) => r.email));
    if (!data || data.length < 1000) break;
  }

  const cleanRows = rows.map((r) => ({ name: String(r.name ?? ""), email: String(r.email ?? "") }));
  const domains = cleanRows.map((r) => normaliseEmail(r.email)).filter((e) => EMAIL_RE.test(e)).map(domainOf);
  const checked = checkRows(cleanRows, existing, new Set(await findBadDomains(domains)));
  const clean = checked.filter((r) => r.problem === "ok");
  for (let i = 0; i < clean.length; i += 500) {
    const chunk = clean.slice(i, i + 500).map((r) => ({ cohort_course_id: cohortCourseId, full_name: r.name, email: r.email }));
    const { error } = await supabase.from("students").insert(chunk);
    if (error) return { error: "Saving stopped part way. Check the list, then upload the file again. Students already saved are skipped." };
  }

  const tally = new Map<RowProblem, number>();
  for (const r of checked) if (r.problem !== "ok") tally.set(r.problem, (tally.get(r.problem) ?? 0) + 1);
  revalidatePath("/dashboard", "layout");
  return {
    added: clean.length,
    skipped: [...tally.entries()].map(([p, count]) => ({ reason: PROBLEM_TEXT[p as Exclude<RowProblem, "ok">], count })),
  };
}

export async function addStudent(formData: FormData) {
  const { supabase } = await requireStaff();
  const name = cleanName(str(formData, "full_name"));
  const email = normaliseEmail(str(formData, "email"));
  const path = listPath(formData);
  if (!name) back(path, "error", "Type the student's full name.");
  if (!EMAIL_RE.test(email)) back(path, "error", "That email is not typed correctly.");
  const flagged = checkRows([{ name, email }], [], new Set(await findBadDomains([domainOf(email)])))[0];
  if (flagged.problem === "typo_domain") back(path, "error", `The website part of that email looks misspelled. ${flagged.hint ?? ""}`.trim());
  if (flagged.problem === "bad_domain") back(path, "error", "That email website does not exist or cannot receive mail. Check how it is typed.");
  const { error } = await supabase.from("students").insert({ cohort_course_id: str(formData, "cohort_course_id"), full_name: name, email });
  if (error) back(path, "error", error.code === "23505" ? "That email is already on this list." : "Could not add the student.");
  revalidatePath("/dashboard", "layout");
  back(path, "ok", `${name} added.`);
}

export async function updateStudent(formData: FormData) {
  const { supabase } = await requireStaff();
  const name = cleanName(str(formData, "full_name"));
  const email = normaliseEmail(str(formData, "email"));
  const path = listPath(formData);
  if (!name) back(path, "error", "A student needs a name.");
  if (!EMAIL_RE.test(email)) back(path, "error", "That email is not typed correctly.");
  const flagged = checkRows([{ name, email }], [], new Set(await findBadDomains([domainOf(email)])))[0];
  if (flagged.problem === "typo_domain") back(path, "error", `The website part of that email looks misspelled. ${flagged.hint ?? ""}`.trim());
  if (flagged.problem === "bad_domain") back(path, "error", "That email website does not exist or cannot receive mail. Check how it is typed.");
  const { error } = await supabase.from("students").update({ full_name: name, email }).eq("id", str(formData, "id"));
  if (error) back(path, "error", error.code === "23505" ? "Another student on this list already has that email." : "Could not save the change.");
  revalidatePath("/dashboard", "layout");
  back(path, "ok", "Student saved.");
}

export async function deleteStudent(formData: FormData) {
  const { supabase } = await requireStaff();
  const path = listPath(formData);
  const { error } = await supabase.from("students").delete().eq("id", str(formData, "id"));
  if (error) back(path, "error", "Could not remove the student.");
  revalidatePath("/dashboard", "layout");
  back(path, "ok", "Student removed. Anything they submitted was removed with them.");
}

// Removes many students at once. The page asks "are you sure" first. Anything they submitted goes with them.
export async function deleteStudents(formData: FormData) {
  const { supabase } = await requireStaff();
  const path = listPath(formData);
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  if (!ids.length) back(path, "error", "Tick the students you want to remove first.");
  for (let i = 0; i < ids.length; i += 100) {
    const { error } = await supabase.from("students").delete().in("id", ids.slice(i, i + 100));
    if (error) back(path, "error", "Could not remove all of them. Some may be gone already, so check the list.");
  }
  revalidatePath("/dashboard", "layout");
  back(path, "ok", `${ids.length} student${ids.length === 1 ? "" : "s"} removed. Anything they submitted was removed with them.`);
}

// Empties the whole list. Needs the words typed in, so it cannot happen by accident.
export async function deleteAllStudents(formData: FormData) {
  const { supabase } = await requireStaff();
  const path = listPath(formData);
  if (str(formData, "confirm").toLowerCase() !== "remove everyone") back(path, "error", "You did not type the words, so nobody was removed.");
  const { error } = await supabase.from("students").delete().eq("cohort_course_id", str(formData, "cohort_course_id"));
  if (error) back(path, "error", "Could not empty the list.");
  revalidatePath("/dashboard", "layout");
  back(path, "ok", "The student list is now empty.");
}
