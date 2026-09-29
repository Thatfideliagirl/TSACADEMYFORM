"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireStaff } from "@/lib/staff";
import { slugify } from "@/lib/slug";
import type { FormState } from "./auth";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const refresh = () => revalidatePath("/dashboard", "layout");
// Send someone back to a page with a message to show.
const back = (path: string, kind: "error" | "ok", message: string): never =>
  redirect(`${path}?${kind}=${encodeURIComponent(message)}`);

// Insert a row, adding -2, -3 ... to the address if it is already taken.
async function insertWithFreeSlug<T>(baseSlug: string, insert: (slug: string) => PromiseLike<{ error: { code?: string; message: string } | null; data: T | null }>) {
  for (let i = 1; i <= 20; i++) {
    const slug = i === 1 ? baseSlug : `${baseSlug}-${i}`;
    const { error, data } = await insert(slug);
    if (!error) return { slug, data: data as T };
    if (error.code !== "23505") throw new Error(error.message);
  }
  throw new Error("Could not find a free address for this name.");
}

async function addCourses(supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"], cohortId: string, cohortSlug: string, courseIds: string[]) {
  if (!courseIds.length) return;
  const { data: courses } = await supabase.from("courses").select("id, name, slug").in("id", courseIds);
  for (const c of courses ?? []) {
    await insertWithFreeSlug(`${cohortSlug}-${c.slug}`, (slug) =>
      supabase.from("cohort_courses").insert({
        cohort_id: cohortId, course_id: c.id, form_name: `${c.name} Submissions`, form_slug: slug,
      }).select("id").single());
  }
}

export async function createCohort(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const name = str(formData, "name");
  if (!name) return { error: "Give the cohort a name, for example Cohort 7." };
  let slug: string;
  try {
    const made = await insertWithFreeSlug(slugify(name), (s) =>
      supabase.from("cohorts").insert({ name, slug: s }).select("id").single());
    slug = made.slug;
    await addCourses(supabase, (made.data as unknown as { id: string }).id, slug, formData.getAll("course").map(String));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create the cohort." };
  }
  refresh();
  redirect(`/dashboard/cohorts/${slug}`);
}

export async function updateCohort(formData: FormData) {
  const { supabase } = await requireAdmin();
  const slug = str(formData, "cohort_slug");
  const name = str(formData, "name");
  if (!name) back(`/dashboard/cohorts/${slug}`, "error", "The cohort needs a name.");
  const { error } = await supabase.from("cohorts")
    .update({ name, is_open: formData.get("is_open") === "on" }).eq("id", str(formData, "cohort_id"));
  if (error) back(`/dashboard/cohorts/${slug}`, "error", "Could not save the changes.");
  refresh();
  back(`/dashboard/cohorts/${slug}`, "ok", "Cohort saved.");
}

export async function deleteCohort(formData: FormData) {
  const { supabase } = await requireAdmin();
  const slug = str(formData, "cohort_slug");
  const { data: cohort } = await supabase.from("cohorts").select("id, name").eq("id", str(formData, "cohort_id")).single();
  if (!cohort || str(formData, "confirm").toLowerCase() !== cohort.name.toLowerCase()) {
    back(`/dashboard/cohorts/${slug}`, "error", "The name you typed does not match, so nothing was deleted.");
  }
  await supabase.from("cohorts").delete().eq("id", cohort!.id);
  refresh();
  redirect("/dashboard");
}

export async function addCourseToCohort(formData: FormData) {
  const { supabase } = await requireAdmin();
  const slug = str(formData, "cohort_slug");
  const courseId = str(formData, "course_id");
  if (courseId) await addCourses(supabase, str(formData, "cohort_id"), slug, [courseId]);
  refresh();
  back(`/dashboard/cohorts/${slug}`, "ok", "Course added.");
}

// Form name and open or closed. Admins and the moderators of that course can do this.
export async function updateCohortCourse(formData: FormData) {
  const { supabase } = await requireStaff();
  const path = `/dashboard/cohorts/${str(formData, "cohort_slug")}/${str(formData, "course_slug")}`;
  const formName = str(formData, "form_name");
  if (!formName) back(path, "error", "The form needs a name.");
  const { error } = await supabase.from("cohort_courses")
    .update({ form_name: formName, is_open: formData.get("is_open") === "on" }).eq("id", str(formData, "cohort_course_id"));
  if (error) back(path, "error", "Could not save the changes.");
  refresh();
  back(path, "ok", "Course saved.");
}

export async function removeCourseFromCohort(formData: FormData) {
  const { supabase } = await requireAdmin();
  const cohortPath = `/dashboard/cohorts/${str(formData, "cohort_slug")}`;
  const coursePath = `${cohortPath}/${str(formData, "course_slug")}`;
  if (str(formData, "confirm").toLowerCase() !== str(formData, "course_name").toLowerCase()) {
    back(coursePath, "error", "The name you typed does not match, so nothing was removed.");
  }
  await supabase.from("cohort_courses").delete().eq("id", str(formData, "cohort_course_id"));
  refresh();
  back(cohortPath, "ok", "Course removed from this cohort.");
}

export async function assignModerator(formData: FormData) {
  const { supabase } = await requireAdmin();
  const userId = str(formData, "user_id");
  if (userId) {
    await supabase.from("cohort_course_moderators")
      .upsert({ cohort_course_id: str(formData, "cohort_course_id"), user_id: userId }, { ignoreDuplicates: true });
  }
  refresh();
}

export async function removeModerator(formData: FormData) {
  const { supabase } = await requireAdmin();
  await supabase.from("cohort_course_moderators").delete()
    .eq("cohort_course_id", str(formData, "cohort_course_id")).eq("user_id", str(formData, "user_id"));
  refresh();
}
