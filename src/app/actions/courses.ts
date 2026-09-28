"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/staff";
import { slugify } from "@/lib/slug";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const back = (kind: "error" | "ok", message: string): never =>
  redirect(`/dashboard/courses?${kind}=${encodeURIComponent(message)}`);

export async function addCourse(formData: FormData) {
  const { supabase } = await requireAdmin();
  const name = str(formData, "name");
  if (!name) back("error", "Type the name of the course.");
  const { error } = await supabase.from("courses").insert({ name, slug: slugify(name) });
  if (error) back("error", error.code === "23505" ? "A course with that name already exists." : "Could not add the course.");
  revalidatePath("/dashboard", "layout");
  back("ok", `${name} added.`);
}

// Renaming keeps the form link addresses the same, so links already shared keep working.
export async function renameCourse(formData: FormData) {
  const { supabase } = await requireAdmin();
  const name = str(formData, "name");
  if (!name) back("error", "The course needs a name.");
  const { error } = await supabase.from("courses").update({ name }).eq("id", str(formData, "id"));
  if (error) back("error", error.code === "23505" ? "A course with that name already exists." : "Could not rename the course.");
  revalidatePath("/dashboard", "layout");
  back("ok", "Course renamed.");
}

export async function deleteCourse(formData: FormData) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("courses").delete().eq("id", str(formData, "id"));
  if (error) {
    back("error", error.code === "23503"
      ? "This course is running in a cohort. Remove it from those cohorts first, then delete it."
      : "Could not delete the course.");
  }
  revalidatePath("/dashboard", "layout");
  back("ok", "Course deleted.");
}
