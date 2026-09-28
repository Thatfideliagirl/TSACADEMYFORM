"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireStaff } from "@/lib/staff";
import { slugify } from "@/lib/slug";
import type { FormState } from "./auth";

// Insert a row, adding -2, -3 ... to the slug if it is already taken.
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
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the cohort a name, for example Cohort 7." };
  const courseIds = formData.getAll("course").map(String);

  let slug: string;
  try {
    const made = await insertWithFreeSlug(slugify(name), (s) =>
      supabase.from("cohorts").insert({ name, slug: s }).select("id").single());
    slug = made.slug;
    await addCourses(supabase, (made.data as unknown as { id: string }).id, slug, courseIds);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create the cohort." };
  }
  revalidatePath("/dashboard");
  redirect(`/dashboard/cohorts/${slug}`);
}

export async function addCourseToCohort(formData: FormData) {
  const { supabase } = await requireAdmin();
  const cohortId = String(formData.get("cohort_id"));
  const cohortSlug = String(formData.get("cohort_slug"));
  const courseId = String(formData.get("course_id"));
  if (courseId) await addCourses(supabase, cohortId, cohortSlug, [courseId]);
  revalidatePath(`/dashboard/cohorts/${cohortSlug}`);
}

export async function assignModerator(formData: FormData) {
  const { supabase } = await requireAdmin();
  const cohortSlug = String(formData.get("cohort_slug"));
  const userId = String(formData.get("user_id"));
  if (userId) {
    await supabase.from("cohort_course_moderators")
      .upsert({ cohort_course_id: String(formData.get("cohort_course_id")), user_id: userId }, { ignoreDuplicates: true });
  }
  revalidatePath(`/dashboard/cohorts/${cohortSlug}`);
}

export async function removeModerator(formData: FormData) {
  const { supabase } = await requireAdmin();
  const cohortSlug = String(formData.get("cohort_slug"));
  await supabase.from("cohort_course_moderators").delete()
    .eq("cohort_course_id", String(formData.get("cohort_course_id"))).eq("user_id", String(formData.get("user_id")));
  revalidatePath(`/dashboard/cohorts/${cohortSlug}`);
}

export async function renameForm(formData: FormData) {
  const { supabase } = await requireStaff();
  const cohortSlug = String(formData.get("cohort_slug"));
  const formName = String(formData.get("form_name") ?? "").trim();
  if (formName) {
    await supabase.from("cohort_courses").update({ form_name: formName }).eq("id", String(formData.get("cohort_course_id")));
  }
  revalidatePath(`/dashboard/cohorts/${cohortSlug}`);
}
