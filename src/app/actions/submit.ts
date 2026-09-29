"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { issuePass, readPass } from "@/lib/student-token";
import { checkLinkType, allTypes, type CustomLinkType, type LinkDef } from "@/lib/link-types";
import { checkOpen, type OpenStatus } from "@/lib/link-open";
import { defsForTask, getForm, taskIsOpen, TASK_COLUMNS, type TaskRow } from "@/lib/submit-data";

// Everything a student does goes through these three functions. The student list never leaves the server.

const NOT_REGISTERED = "This name and email are not registered for this cohort. Use the exact name and email you registered with. If you think this is a mistake, contact your cohort lead.";

export type TaskInfo = {
  slug: string; kind: "assignment" | "capstone"; title: string; instructions: string;
  required: string[]; custom: CustomLinkType[]; submittedAt: string | null;
  // What the student sent, so they can pick a link to replace. Only their own submission.
  sent: { key: string; label: string; url: string }[];
  // The one request they may use per task, once made.
  request: { kind: "replace_link" | "note"; status: "pending" | "approved" | "declined" } | null;
  // Set when a moderator held the work back: what to fix, and which links the student may send again.
  resubmit: { feedback: string; links: string[] } | null;
};
export type VerifyResult =
  | { ok: false; error: string }
  | { ok: true; token: string; studentName: string; tasks: TaskInfo[] };

const normName = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
const cleanUrl = (s: string) => s.trim();

async function deviceKey(prefix: string) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  return `${prefix}:${ip}`;
}

// Step 1: is this student on the list for this course? 10 tries per 10 minutes per device.
export async function verifyStudent(input: { formSlug: string; name: string; email: string }): Promise<VerifyResult> {
  const name = String(input?.name ?? "");
  const email = String(input?.email ?? "").trim().toLowerCase();
  if (!name.trim() || !email) return { ok: false, error: "Type your full name and the email you registered with." };

  const db = createAdminClient();
  const key = await deviceKey("verify");
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await db.from("verify_attempts").select("id", { count: "exact", head: true }).eq("device_key", key).gte("created_at", since);
  if ((count ?? 0) >= 10) return { ok: false, error: "Too many tries from this device. Wait 10 minutes, then try again." };
  await db.from("verify_attempts").insert({ device_key: key });

  const form = await getForm(String(input?.formSlug ?? ""));
  if (!form) return { ok: false, error: "This form link is not valid." };
  if (!form.open) return { ok: false, error: "This form is closed." };

  const { data: student } = await db.from("students").select("id, full_name, full_name_normalised").eq("cohort_course_id", form.id).eq("email", email).maybeSingle();
  if (!student || student.full_name_normalised !== normName(name)) return { ok: false, error: NOT_REGISTERED };

  const { data: tasks } = await db.from("tasks").select(TASK_COLUMNS).eq("cohort_course_id", form.id).order("created_at");
  const open = ((tasks ?? []) as TaskRow[]).filter((t) => taskIsOpen(t));
  type SubRow = { task_id: string; submitted_at: string; links: unknown; resubmit_asked?: boolean; resubmit_links?: string[]; resubmit_feedback?: string };
  let subs: SubRow[] | null = null;
  {
    const full = await db.from("submissions").select("task_id, submitted_at, links, resubmit_asked, resubmit_links, resubmit_feedback").eq("student_id", student.id);
    if (!full.error) subs = full.data as SubRow[];
    else subs = (await db.from("submissions").select("task_id, submitted_at, links").eq("student_id", student.id)).data as SubRow[] | null;
  }
  const done = new Map((subs ?? []).map((s) => [s.task_id, s]));
  const { data: reqs } = await db.from("requests").select("task_id, kind, status").eq("student_id", student.id);
  const reqBy = new Map((reqs ?? []).map((r) => [r.task_id, r]));

  const list: TaskInfo[] = [];
  for (const t of open) {
    const { defs, custom } = await defsForTask(t);
    const mine = done.get(t.id);
    const links = (mine?.links ?? {}) as Record<string, string>;
    const req = reqBy.get(t.id);
    list.push({
      slug: t.slug, kind: t.kind as "assignment" | "capstone", title: t.title, instructions: t.instructions,
      required: t.required_links, custom, submittedAt: (mine?.submitted_at as string | undefined) ?? null,
      sent: mine ? defs.filter((d) => links[d.key]).map((d) => ({ key: d.key, label: d.label, url: links[d.key] })) : [],
      request: req ? { kind: req.kind as "replace_link" | "note", status: req.status as "pending" | "approved" | "declined" } : null,
      resubmit: mine?.resubmit_asked ? { feedback: mine.resubmit_feedback ?? "", links: mine.resubmit_links ?? [] } : null,
    });
  }
  return { ok: true, token: issuePass(student.id, form.id), studentName: student.full_name, tasks: list };
}

type Loaded =
  | { error: string }
  | { error?: undefined; pass: NonNullable<ReturnType<typeof readPass>>; db: ReturnType<typeof createAdminClient>; task: TaskRow; defs: LinkDef[]; custom: CustomLinkType[] };

async function loadTask(token: string, taskSlug: string): Promise<Loaded> {
  const pass = readPass(token);
  if (!pass) return { error: "Your session ran out. Refresh the page and enter your details again." };
  const db = createAdminClient();
  const { data } = await db.from("tasks").select(TASK_COLUMNS).eq("slug", taskSlug).eq("cohort_course_id", pass.cc).maybeSingle();
  const task = data as TaskRow | null;
  if (!task) return { error: "That task could not be found." };
  if (!taskIsOpen(task)) return { error: "This task is closed." };
  const { defs, custom } = await defsForTask(task);
  return { pass, db, task, defs, custom };
}

export type LinkCheckResult = { typeOk: boolean; status?: OpenStatus; message: string };

// Step 4: check one link box, right kind of link first, then whether it opens for anyone.
export async function checkLink(input: { token: string; taskSlug: string; key: string; url: string }): Promise<LinkCheckResult> {
  const t = await loadTask(input.token, input.taskSlug);
  if (t.error !== undefined) return { typeOk: false, message: t.error };
  const def = t.defs.find((d) => d.key === input.key);
  if (!def) return { typeOk: false, message: "This task does not ask for that link." };

  const url = cleanUrl(String(input.url ?? ""));
  const type = checkLinkType(def, url, allTypes(t.custom));
  if (!type.ok) return { typeOk: false, message: type.message };

  const status = await checkOpen(def, url);
  if (status === "locked") {
    return { typeOk: true, status, message: "This link is locked. Set sharing to Anyone with the link, then paste it again." };
  }
  return {
    typeOk: true, status,
    message: status === "unknown" ? "We could not check this link automatically. You can still submit it. A moderator will check it." : "",
  };
}

export type SubmitResult =
  | { ok: false; error: string; alreadySubmittedAt?: string }
  | { ok: true; submittedAt: string; received: { label: string; url: string; verified: boolean }[] };

// Step 5: save the submission. Everything is checked again here, so the screen cannot be tricked.
export async function submitWork(input: { token: string; taskSlug: string; links: Record<string, string> }): Promise<SubmitResult> {
  const t = await loadTask(input.token, input.taskSlug);
  if (t.error !== undefined) return { ok: false, error: t.error };
  const { pass, db, task, defs, custom } = t;

  const { data: existing } = await db.from("submissions").select("submitted_at").eq("task_id", task.id).eq("student_id", pass.sid).maybeSingle();
  if (existing) return { ok: false, error: "You already submitted this task.", alreadySubmittedAt: existing.submitted_at };

  const links: Record<string, string> = {};
  const seen = new Set<string>();
  const all = allTypes(custom);
  for (const def of defs) {
    const url = cleanUrl(String(input.links?.[def.key] ?? ""));
    if (!url) return { ok: false, error: `Paste your ${def.label} link.` };
    const type = checkLinkType(def, url, all);
    if (!type.ok) return { ok: false, error: `${def.label}: ${type.message}` };
    const norm = url.toLowerCase().replace(/\/+$/, "");
    if (seen.has(norm)) return { ok: false, error: "You pasted the same link in two boxes." };
    seen.add(norm);
    links[def.key] = url;
  }

  const results = await Promise.all(defs.map(async (d) => [d.key, await checkOpen(d, links[d.key])] as const));
  const locked = defs.find((d) => results.find(([k]) => k === d.key)?.[1] === "locked");
  if (locked) return { ok: false, error: `${locked.label}: this link is locked. Set sharing to Anyone with the link, then paste it again.` };
  const unverified = results.filter(([, s]) => s === "unknown").map(([k]) => k);

  const { data: saved, error } = await db.from("submissions")
    .insert({ task_id: task.id, student_id: pass.sid, links, unverified_links: unverified })
    .select("submitted_at").single();
  if (error) {
    if (error.code === "23505") return { ok: false, error: "You already submitted this task." };
    return { ok: false, error: "Something went wrong saving your work. Please try again." };
  }
  return {
    ok: true, submittedAt: saved.submitted_at,
    received: defs.map((d) => ({ label: d.label, url: links[d.key], verified: !unverified.includes(d.key) })),
  };
}

export type ResubmitResult = { ok: false; error: string } | { ok: true; received: { label: string; url: string; verified: boolean }[] };

// A student a moderator asked to resubmit sends new links, only for the links the moderator switched on.
// The other links cannot be touched. The old links go into the history, and the moderator is told through the bell.
export async function submitResubmission(input: { token: string; taskSlug: string; links: Record<string, string> }): Promise<ResubmitResult> {
  const t = await loadTask(input.token, input.taskSlug);
  if (t.error !== undefined) return { ok: false, error: t.error };
  const { pass, db, task, defs, custom } = t;

  const { data: sub } = await db.from("submissions")
    .select("id, links, unverified_links, reviewed, resubmit_asked, resubmit_links").eq("task_id", task.id).eq("student_id", pass.sid).maybeSingle();
  if (!sub) return { ok: false, error: "You have not submitted this task yet." };
  if (!sub.resubmit_asked) return { ok: false, error: "Your moderator has not asked you to resubmit this task." };

  const old = sub.links as Record<string, string>;
  const open = (sub.resubmit_links as string[]).filter((k) => defs.some((d) => d.key === k));
  if (!open.length) return { ok: false, error: "There is no link to send again for this task." };

  const all = allTypes(custom);
  const fresh: Record<string, string> = {};
  const seen = new Set(Object.entries(old).filter(([k]) => !open.includes(k)).map(([, u]) => norm(u)));
  for (const key of open) {
    const def = defs.find((d) => d.key === key)!;
    const url = cleanUrl(String(input.links?.[key] ?? ""));
    if (!url) return { ok: false, error: `Paste your new ${def.label} link.` };
    const type = checkLinkType(def, url, all);
    if (!type.ok) return { ok: false, error: `${def.label}: ${type.message}` };
    if (norm(url) === norm(String(old[key] ?? ""))) return { ok: false, error: `${def.label}: this is the same link you sent before. Send the new one.` };
    if (seen.has(norm(url))) return { ok: false, error: "You pasted the same link in two boxes." };
    seen.add(norm(url));
    fresh[key] = url;
  }

  const results = await Promise.all(open.map(async (k) => [k, await checkOpen(defs.find((d) => d.key === k)!, fresh[k])] as const));
  const locked = results.find(([, s]) => s === "locked");
  if (locked) return { ok: false, error: `${defs.find((d) => d.key === locked[0])!.label}: this link is locked. Set sharing to Anyone with the link, then paste it again.` };
  const unknown = results.filter(([, s]) => s === "unknown").map(([k]) => k);

  const reviewed = { ...((sub.reviewed ?? {}) as Record<string, boolean>) };
  for (const k of open) { reviewed[k] = false; reviewed[`opens:${k}`] = false; }
  const stillUnverified = ((sub.unverified_links ?? []) as string[]).filter((k) => !open.includes(k));

  await db.from("submission_link_history").insert(open.map((k) => ({ submission_id: sub.id, link_type: k, old_url: old[k] ?? "", new_url: fresh[k] })));
  const { error } = await db.from("submissions").update({
    links: { ...old, ...fresh }, unverified_links: [...stillUnverified, ...unknown], reviewed,
    resubmit_asked: false, resubmit_links: [], resubmitted_at: new Date().toISOString(),
  }).eq("id", sub.id).eq("resubmit_asked", true);
  if (error) return { ok: false, error: "Something went wrong saving your new links. Please try again." };
  return { ok: true, received: open.map((k) => ({ label: defs.find((d) => d.key === k)!.label, url: fresh[k], verified: !unknown.includes(k) })) };
}

export type RequestResult = { ok: true } | { ok: false; error: string };

// Step 8: a student who already submitted may make ONE request per task.
// Either replace one link (same kind of link, checked again) or leave a note. A reason of 40 characters or more is needed.
export async function sendRequest(input: { token: string; taskSlug: string; kind: "replace_link" | "note"; linkKey?: string; newUrl?: string; reason: string }): Promise<RequestResult> {
  const t = await loadTask(input.token, input.taskSlug);
  if (t.error !== undefined) return { ok: false, error: t.error };
  const { pass, db, task, defs, custom } = t;

  const reason = String(input.reason ?? "").trim();
  if (reason.length < 40) return { ok: false, error: "Please explain in at least 40 characters, so the moderator understands." };

  const { data: sub } = await db.from("submissions").select("id, links").eq("task_id", task.id).eq("student_id", pass.sid).maybeSingle();
  if (!sub) return { ok: false, error: "You have not submitted this task yet." };
  const { data: used } = await db.from("requests").select("id").eq("task_id", task.id).eq("student_id", pass.sid).maybeSingle();
  if (used) return { ok: false, error: "You have already used your one request for this task." };

  const row: Record<string, unknown> = { task_id: task.id, student_id: pass.sid, submission_id: sub.id, kind: input.kind, reason };
  if (input.kind === "replace_link") {
    const def = defs.find((d) => d.key === input.linkKey);
    if (!def) return { ok: false, error: "Choose which link you want to replace." };
    const url = cleanUrl(String(input.newUrl ?? ""));
    const type = checkLinkType(def, url, allTypes(custom));
    if (!type.ok) return { ok: false, error: `${def.label}: ${type.message}` };
    if (norm(url) === norm(String((sub.links as Record<string, string>)[def.key] ?? ""))) return { ok: false, error: "That is the same link you already sent. Use a note instead if the link itself is fine." };
    if ((await checkOpen(def, url)) === "locked") return { ok: false, error: `${def.label}: this link is locked. Set sharing to Anyone with the link, then paste it again.` };
    row.link_type = def.key; row.new_url = url;
  } else if (input.kind !== "note") {
    return { ok: false, error: "Choose what you want to do." };
  }

  const { error } = await db.from("requests").insert(row);
  if (error) return { ok: false, error: error.code === "23505" ? "You have already used your one request for this task." : "Something went wrong sending your request. Please try again." };
  return { ok: true };
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\/+$/, "");
