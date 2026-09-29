import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { getCourseContext } from "@/lib/course-context";
import { Banner } from "@/components/banner";
import { DangerZone } from "@/components/danger-zone";
import { TaskForm } from "@/components/task-form";
import { allTypes } from "@/lib/link-types";
import { deleteTask } from "@/app/actions/tasks";

export default async function EditTaskPage({ params, searchParams }: {
  params: Promise<{ slug: string; course: string; task: string }>; searchParams: Promise<{ error?: string }>;
}) {
  const { slug, course: courseSlug, task: taskSlug } = await params;
  const { error } = await searchParams;
  const { supabase, cohort, course, cc } = await getCourseContext(slug, courseSlug);

  const { data: task } = await supabase
    .from("tasks").select("id, slug, kind, title, instructions, max_score, required_links, is_open, opens_at, closes_at")
    .eq("slug", taskSlug).eq("cohort_course_id", cc.id).maybeSingle();
  if (!task) notFound();
  const { data: custom } = await supabase.from("link_types").select("key, label, domains, hint").order("label");
  const { count } = await supabase.from("submissions").select("id", { count: "exact", head: true }).eq("task_id", task.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href={`/dashboard/cohorts/${cohort.slug}/${course.slug}/tasks`}>Tasks</BackLink>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Edit task</h1>
        <p className="mt-1 text-muted">{course.name}, {cohort.name}</p>
      </div>
      <Banner error={error} />
      <TaskForm ctx={{ cohortCourseId: cc.id, cohortSlug: cohort.slug, courseSlug: course.slug, formSlug: cc.form_slug }} task={task} hasSubmissions={(count ?? 0) > 0} types={allTypes(custom ?? []).map(({ key, label }) => ({ key, label }))} />
      <DangerZone title="Delete this task" confirmWord={task.title} action={deleteTask} buttonLabel="Delete task for good"
        warning={`This removes the task and every submission for it${count ? ` (${count} so far)` : ""}. It cannot be undone.`}>
        <input type="hidden" name="task_id" value={task.id} />
        <input type="hidden" name="task_slug" value={task.slug} />
        <input type="hidden" name="cohort_slug" value={cohort.slug} />
        <input type="hidden" name="course_slug" value={course.slug} />
      </DangerZone>
    </div>
  );
}
