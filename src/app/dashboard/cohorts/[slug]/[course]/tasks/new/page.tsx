import Link from "next/link";
import { getCourseContext } from "@/lib/course-context";
import { Banner } from "@/components/banner";
import { TaskForm } from "@/components/task-form";

export default async function NewTaskPage({ params, searchParams }: {
  params: Promise<{ slug: string; course: string }>; searchParams: Promise<{ error?: string }>;
}) {
  const { slug, course: courseSlug } = await params;
  const { error } = await searchParams;
  const { cohort, course, cc } = await getCourseContext(slug, courseSlug);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/dashboard/cohorts/${cohort.slug}/${course.slug}/tasks`} className="text-sm font-semibold text-brand">← Tasks</Link>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">New task</h1>
        <p className="mt-1 text-muted">{course.name}, {cohort.name}</p>
      </div>
      <Banner error={error} />
      <TaskForm ctx={{ cohortCourseId: cc.id, cohortSlug: cohort.slug, courseSlug: course.slug }} />
    </div>
  );
}
