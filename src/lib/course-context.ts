import "server-only";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/staff";

// Loads one course inside one cohort for the signed in person. Shows "not found" if they may not see it.
export async function getCourseContext(cohortSlug: string, courseSlug: string) {
  const { supabase, profile } = await requireStaff();
  const { data: cohort } = await supabase.from("cohorts").select("id, name, slug").eq("slug", cohortSlug).maybeSingle();
  const { data: course } = await supabase.from("courses").select("id, name, slug").eq("slug", courseSlug).maybeSingle();
  if (!cohort || !course) notFound();
  const { data: cc } = await supabase
    .from("cohort_courses").select("id, form_name, form_slug, is_open")
    .eq("cohort_id", cohort.id).eq("course_id", course.id).maybeSingle();
  if (!cc) notFound();
  return { supabase, profile, cohort, course, cc };
}
