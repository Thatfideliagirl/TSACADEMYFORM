"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireStaff } from "@/lib/staff";
import { DEFAULT_BOXES, type Box, type Boxes, type DateFormat } from "@/lib/certificate-render";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const back = (to: string, kind: "error" | "ok", message: string): never => {
  const u = new URL(to.startsWith("/dashboard/") ? to : "/dashboard", "http://x");
  u.searchParams.delete("error"); u.searchParams.delete("ok");
  u.searchParams.set(kind, message);
  redirect(`${u.pathname}${u.search}`);
};

const num = (v: unknown, min: number, max: number, fallback: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback; };
const FONT_KEYS = ["cormorant", "playfair", "vibes", "montserrat"];
function cleanBox(b: Partial<Box> | undefined, d: Box): Box {
  return {
    x: num(b?.x, 0, 1, d.x), y: num(b?.y, 0, 1, d.y), size: num(b?.size, 0.008, 0.15, d.size), maxWidth: num(b?.maxWidth, 0.1, 1, d.maxWidth),
    font: (FONT_KEYS.includes(String(b?.font)) ? b!.font : d.font) as Box["font"], bold: Boolean(b?.bold),
    color: /^#[0-9a-f]{6}$/i.test(String(b?.color)) ? String(b!.color) : d.color,
  };
}

export type SaveTemplateResult = { ok: true } | { ok: false; error: string };

// Admins only. Saves the picture (if a new one was chosen) and where the name and date go.
export async function saveTemplate(input: { courseId: string; image?: string; width?: number; height?: number; boxes: Boxes }): Promise<SaveTemplateResult> {
  const { supabase, profile } = await requireAdmin();
  const boxes: Boxes = {
    name: cleanBox(input.boxes?.name, DEFAULT_BOXES.name), date: cleanBox(input.boxes?.date, DEFAULT_BOXES.date),
    dateFormat: (["long", "short", "numeric"].includes(String(input.boxes?.dateFormat)) ? input.boxes.dateFormat : "long") as DateFormat,
  };
  const row: Record<string, unknown> = { course_id: input.courseId, boxes, updated_at: new Date().toISOString(), updated_by: profile.id };
  if (input.image) {
    if (!/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(input.image)) return { ok: false, error: "That picture could not be read. Use a JPG or PNG." };
    if (input.image.length > 3_600_000) return { ok: false, error: "That picture is too large. Try a smaller one." };
    row.image = input.image; row.width = Math.round(num(input.width, 100, 6000, 0)); row.height = Math.round(num(input.height, 100, 6000, 0));
  } else {
    const { data: existing } = await supabase.from("certificate_templates").select("course_id").eq("course_id", input.courseId).maybeSingle();
    if (!existing) return { ok: false, error: "Choose the template picture first." };
  }
  const { error } = await supabase.from("certificate_templates").upsert(row, { onConflict: "course_id" });
  if (error) return { ok: false, error: "Could not save the template. Please try again." };
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

// Adds marked capstones to the Certificates list. They are only added, nothing is moved or removed from Submissions.
async function addSubmissions(ids: string[], onlyCourse?: string) {
  const { supabase, profile } = await requireStaff();
  const { data: subs } = ids.length
    ? await supabase.from("submissions").select("id, student_id, score, tasks!inner(kind, cohort_course_id)").in("id", ids)
    : { data: [] };
  type Row = { id: string; student_id: string; score: number | null; tasks: { kind: string; cohort_course_id: string } | { kind: string; cohort_course_id: string }[] };
  const eligible = ((subs ?? []) as Row[]).map((s) => ({ ...s, task: Array.isArray(s.tasks) ? s.tasks[0] : s.tasks }))
    .filter((s) => s.task.kind === "capstone" && s.score !== null && (!onlyCourse || s.task.cohort_course_id === onlyCourse));
  const skipped = ids.length - eligible.length;
  if (!eligible.length) return { added: 0, already: 0, skipped };
  const { data: before } = await supabase.from("certificates").select("student_id, cohort_course_id").in("cohort_course_id", [...new Set(eligible.map((s) => s.task.cohort_course_id))]);
  const have = new Set((before ?? []).map((c) => `${c.cohort_course_id}:${c.student_id}`));
  const fresh = eligible.filter((s) => !have.has(`${s.task.cohort_course_id}:${s.student_id}`));
  const unique = new Map(fresh.map((s) => [`${s.task.cohort_course_id}:${s.student_id}`, s]));
  if (unique.size) {
    const { error } = await supabase.from("certificates").upsert(
      [...unique.values()].map((s) => ({ cohort_course_id: s.task.cohort_course_id, student_id: s.student_id, submission_id: s.id, added_by: profile.id })),
      { onConflict: "cohort_course_id,student_id", ignoreDuplicates: true },
    );
    if (error) throw new Error("CERTIFICATE_ADD_FAILED");
  }
  revalidatePath("/dashboard", "layout");
  return { added: unique.size, already: eligible.length - unique.size, skipped };
}

const summary = (r: { added: number; already: number; skipped: number }) =>
  `${r.added} added to Certificates. An admin issues them.${r.already ? ` ${r.already} were already on the list.` : ""}${r.skipped ? ` ${r.skipped} skipped because they are not a marked capstone.` : ""}`;

// From Submissions: the ticked rows.
export async function addToCertificates(formData: FormData) {
  const to = str(formData, "return_to");
  const ids = formData.getAll("ids").map(String);
  if (!ids.length) back(to, "error", "Tick at least one marked capstone first.");
  try { back(to, "ok", summary(await addSubmissions(ids))); }
  catch (e) { if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e; back(to, "error", "Could not add them. Please try again."); }
}

// From the Certificates page: every marked capstone in this course.
export async function addAllMarkedCapstones(formData: FormData) {
  const { supabase } = await requireAdmin();
  const to = str(formData, "return_to");
  const cc = str(formData, "cohort_course_id");
  const { data } = await supabase.from("submissions").select("id, tasks!inner(kind, cohort_course_id)").eq("tasks.cohort_course_id", cc).eq("tasks.kind", "capstone").not("score", "is", null).limit(5000);
  const ids = (data ?? []).map((r) => r.id);
  if (!ids.length) back(to, "error", "There are no marked capstones in this course yet.");
  try { back(to, "ok", summary(await addSubmissions(ids, cc))); }
  catch (e) { if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e; back(to, "error", "Could not add them. Please try again."); }
}

// Issue: sets the issue date and unlocks the certificate for the student. Admins only.
export async function issueCertificates(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const to = str(formData, "return_to");
  const ids = formData.getAll("ids").map(String);
  const date = str(formData, "issue_date");
  if (!ids.length) back(to, "error", "Tick at least one student first.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) back(to, "error", "Choose the issue date.");
  const { data: rows } = await supabase.from("certificates").select("id, cohort_course_id, cohort_courses(courses(id))").in("id", ids);
  const courseIds = new Set((rows ?? []).map((r) => { const cc = Array.isArray(r.cohort_courses) ? r.cohort_courses[0] : r.cohort_courses; const c = Array.isArray(cc?.courses) ? cc?.courses[0] : cc?.courses; return c?.id as string | undefined; }).filter(Boolean));
  const { data: tpl } = await supabase.from("certificate_templates").select("course_id").in("course_id", [...courseIds] as string[]);
  if ((tpl ?? []).length < courseIds.size) back(to, "error", "This course has no certificate template yet. An admin adds it on the Courses page, under Certificate template.");
  const { error } = await supabase.from("certificates").update({ status: "issued", issue_date: date, issued_by: profile.id, issued_at: new Date().toISOString() }).in("id", ids);
  if (error) back(to, "error", "Could not issue them. Please try again.");
  revalidatePath("/dashboard", "layout");
  back(to, "ok", `${ids.length} certificate${ids.length === 1 ? "" : "s"} issued. Those students can now collect them.`);
}

// Back to Approved. The student can no longer collect it.
export async function withdrawCertificates(formData: FormData) {
  const { supabase } = await requireAdmin();
  const to = str(formData, "return_to");
  const ids = formData.getAll("ids").map(String);
  if (!ids.length) back(to, "error", "Tick at least one student first.");
  const { error } = await supabase.from("certificates").update({ status: "approved", issue_date: null, issued_by: null, issued_at: null }).in("id", ids);
  if (error) back(to, "error", "Could not withdraw them. Please try again.");
  revalidatePath("/dashboard", "layout");
  back(to, "ok", "Withdrawn. They are back to Approved and cannot collect yet.");
}

// Takes students off the list. Admins and moderators can. Only students who are still Approved, so an issued certificate is never removed by accident.
export async function removeCertificates(formData: FormData) {
  const { supabase } = await requireStaff();
  const to = str(formData, "return_to");
  const ids = formData.getAll("ids").map(String);
  if (!ids.length) back(to, "error", "Tick at least one student first.");
  const { error } = await supabase.from("certificates").delete().in("id", ids).eq("status", "approved");
  if (error) back(to, "error", "Could not take them off. Please try again.");
  revalidatePath("/dashboard", "layout");
  back(to, "ok", "Taken off the list. Students who were already issued stay on it. Withdraw them first.");
}
