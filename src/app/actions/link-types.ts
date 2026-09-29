"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/staff";
import { slugify } from "@/lib/slug";
import { isBuiltInKey, parseWebsites } from "@/lib/link-types";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const go = (f: FormData, kind: "error" | "ok", message: string): never =>
  redirect(`/dashboard/cohorts/${str(f, "cohort_slug")}/${str(f, "course_slug")}/tasks?${kind}=${encodeURIComponent(message)}`);

export async function createLinkType(formData: FormData) {
  const { supabase, profile } = await requireStaff();
  const label = str(formData, "label");
  const domains = parseWebsites(str(formData, "website"));
  if (!label) go(formData, "error", "Name the kind of link, for example Gamma presentation.");
  if (!domains.length) go(formData, "error", "Type the website these links come from, for example gamma.app.");

  const base = `custom-${slugify(label)}`;
  for (let i = 1; i <= 20; i++) {
    const key = i === 1 ? base : `${base}-${i}`;
    const { error } = await supabase.from("link_types").insert({ key, label, domains, hint: str(formData, "hint"), created_by: profile.id });
    if (!error) {
      revalidatePath("/dashboard", "layout");
      go(formData, "ok", `${label} added. You can now tick it when you create a task.`);
    }
    if (error?.code !== "23505") go(formData, "error", "Could not add that kind of link.");
  }
  go(formData, "error", "Could not add that kind of link. Try a slightly different name.");
}

export async function deleteLinkType(formData: FormData) {
  const { supabase } = await requireStaff();
  const key = str(formData, "key");
  if (isBuiltInKey(key)) go(formData, "error", "Built in kinds of link cannot be deleted.");
  const { count } = await supabase.from("tasks").select("id", { count: "exact", head: true }).contains("required_links", [key]);
  if ((count ?? 0) > 0) go(formData, "error", `This kind of link is used by ${count} task${count === 1 ? "" : "s"}. Remove it from those tasks first.`);
  await supabase.from("link_types").delete().eq("key", key);
  revalidatePath("/dashboard", "layout");
  go(formData, "ok", "Kind of link deleted.");
}
