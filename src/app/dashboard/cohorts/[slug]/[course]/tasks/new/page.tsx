import { BackLink } from "@/components/back-link";
import { getCourseContext } from "@/lib/course-context";
import { Banner } from "@/components/banner";
import { TaskForm } from "@/components/task-form";
import { allTypes } from "@/lib/link-types";

export default async function NewTaskPage({ params, searchParams }: {
  params: Promise<{ slug: string; course: string }>; searchParams: Promise<{ error?: string }>;
}) {
  const { slug, course: courseSlug } = await params;
  const { error } = await searchParams;
  const { supabase, cohort, course, cc } = await getCourseContext(slug, courseSlug);
  const { data: custom } = await supabase.from("link_types").select("key, label, domains, hint").order("label");
  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href={`/dashboard/cohorts/${cohort.slug}/${course.slug}/tasks`}>Tasks</BackLink>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">New task</h1>
        <p className="mt-1 text-muted">{course.name}, {cohort.name}</p>
      </div>
      <Banner error={error} />
      <TaskForm ctx={{ cohortCourseId: cc.id, cohortSlug: cohort.slug, courseSlug: course.slug }} types={allTypes(custom ?? [])} />
    </div>
  );
}
