import "server-only";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/staff";

type One<T> = T | T[] | null;
const one = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);

// Loads one course inside one cohort for the signed in person, in a single database trip.
// Shows "not found" if they may not see it.
export async function getCourseContext(cohortSlug: string, courseSlug: string) {
  const { supabase, profile } = await requireStaff();
  const { data } = await supabase
    .from("cohort_courses")
    .select("id, form_name, form_slug, is_open, cohorts!inner(id, name, slug), courses!inner(id, name, slug)")
    .eq("cohorts.slug", cohortSlug).eq("courses.slug", courseSlug).maybeSingle();
  const cohort = one(data?.cohorts as One<{ id: string; name: string; slug: string }>);
  const course = one(data?.courses as One<{ id: string; name: string; slug: string }>);
  if (!data || !cohort || !course) notFound();
  return { supabase, profile, cohort, course, cc: { id: data.id as string, form_name: data.form_name as string, form_slug: data.form_slug as string, is_open: data.is_open as boolean } };
}
