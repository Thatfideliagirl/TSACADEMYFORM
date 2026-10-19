"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getForm } from "@/lib/submit-data";
import type { Boxes } from "@/lib/certificate-render";

const NOT_REGISTERED = "This name and email are not registered for this cohort. Use the exact name and email you registered with. If you think this is a mistake, contact your cohort lead.";
const normName = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

export type CollectResult =
  | { ok: false; error: string }
  | { ok: true; state: "none" | "approved"; name: string }
  | { ok: true; state: "issued"; name: string; issueDate: string; courseId: string; version: string; width: number; height: number; boxes: Boxes; fileName: string };

// A student asks for their own certificate. Same name and email check as the submission form, with the same limit on tries.
// Only a student whose certificate was issued gets anything back.
export async function findCertificate(input: { formSlug: string; name: string; email: string }): Promise<CollectResult> {
  const name = String(input?.name ?? "");
  const email = String(input?.email ?? "").trim().toLowerCase();
  if (!name.trim() || !email) return { ok: false, error: "Type your full name and the email you registered with." };

  const db = createAdminClient();
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  const key = `certificate:${ip}`;
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await db.from("verify_attempts").select("id", { count: "exact", head: true }).eq("device_key", key).gte("created_at", since);
  if ((count ?? 0) >= 10) return { ok: false, error: "Too many tries from this device. Wait 10 minutes, then try again." };
  await db.from("verify_attempts").insert({ device_key: key });

  const form = await getForm(String(input?.formSlug ?? ""));
  if (!form) return { ok: false, error: "This link is not valid." };

  const { data: student } = await db.from("students").select("id, full_name, full_name_normalised").eq("cohort_course_id", form.id).eq("email", email).maybeSingle();
  if (!student || student.full_name_normalised !== normName(name)) return { ok: false, error: NOT_REGISTERED };

  const { data: cert } = await db.from("certificates").select("status, issue_date").eq("cohort_course_id", form.id).eq("student_id", student.id).maybeSingle();
  if (!cert) return { ok: true, state: "none", name: student.full_name };
  if (cert.status !== "issued" || !cert.issue_date) return { ok: true, state: "approved", name: student.full_name };

  const { data: cc } = await db.from("cohort_courses").select("course_id").eq("id", form.id).single();
  const { data: tpl } = cc ? await db.from("certificate_templates").select("width, height, boxes, updated_at").eq("course_id", cc.course_id).maybeSingle() : { data: null };
  if (!cc || !tpl) return { ok: true, state: "approved", name: student.full_name };
  return {
    ok: true, state: "issued", name: student.full_name, issueDate: cert.issue_date as string, courseId: cc.course_id as string,
    version: String(tpl.updated_at), width: tpl.width as number, height: tpl.height as number, boxes: tpl.boxes as Boxes,
    fileName: `${form.courseName} certificate ${student.full_name}`.replace(/[^A-Za-z0-9 -]/g, "").replace(/\s+/g, "-"),
  };
}
