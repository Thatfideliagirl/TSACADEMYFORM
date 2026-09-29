import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { allTypes, type CustomLinkType, type LinkDef } from "@/lib/link-types";

// Data the public form needs. It uses the full access client, so only ever return what a student may see.

export async function getForm(formSlug: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("cohort_courses")
    .select("id, form_name, form_slug, is_open, cohorts(name, is_open), courses(name)")
    .eq("form_slug", formSlug).maybeSingle();
  if (!data) return null;
  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] ?? null : v);
  const cohort = one(data.cohorts as { name: string; is_open: boolean } | { name: string; is_open: boolean }[] | null);
  const course = one(data.courses as { name: string } | { name: string }[] | null);
  return {
    id: data.id as string, formName: data.form_name as string, formSlug: data.form_slug as string,
    cohortName: cohort?.name ?? "", courseName: course?.name ?? "",
    open: Boolean(data.is_open && cohort?.is_open),
  };
}

export type TaskRow = {
  id: string; slug: string; kind: string; title: string; instructions: string; max_score: number;
  required_links: string[]; is_open: boolean; opens_at: string | null; closes_at: string | null;
};

export const TASK_COLUMNS = "id, slug, kind, title, instructions, max_score, required_links, is_open, opens_at, closes_at";

export function taskIsOpen(t: Pick<TaskRow, "is_open" | "opens_at" | "closes_at">, now = new Date()) {
  return t.is_open && (!t.opens_at || new Date(t.opens_at) <= now) && (!t.closes_at || new Date(t.closes_at) > now);
}

export async function customTypesFor(keys: string[]): Promise<CustomLinkType[]> {
  const wanted = keys.filter((k) => k.startsWith("custom-"));
  if (!wanted.length) return [];
  const { data } = await createAdminClient().from("link_types").select("key, label, domains, hint").in("key", wanted);
  return (data ?? []) as CustomLinkType[];
}

// The boxes for a task, in the order the task lists them.
export async function defsForTask(t: Pick<TaskRow, "required_links">): Promise<{ defs: LinkDef[]; custom: CustomLinkType[] }> {
  const custom = await customTypesFor(t.required_links);
  const all = allTypes(custom);
  const defs = t.required_links.map((k) => all.find((d) => d.key === k)).filter((d): d is LinkDef => !!d);
  return { defs, custom };
}
