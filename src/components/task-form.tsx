"use client";

import Link from "next/link";
import { saveTask } from "@/app/actions/tasks";
import { SubmitButton } from "./submit-button";
import { useKeepValues } from "./use-keep-values";
import { toLagosInput } from "@/lib/lagos";

export type TaskValues = {
  id?: string; slug?: string; kind: string; title: string; instructions: string; max_score: number;
  required_links: string[]; is_open: boolean; opens_at: string | null; closes_at: string | null;
};

const field = "rounded-xl border-[1.5px] border-line bg-white px-3 py-2.5 focus:border-brand focus:outline-none";

export function TaskForm({ ctx, task, hasSubmissions, types }: {
  ctx: { cohortCourseId: string; cohortSlug: string; courseSlug: string; formSlug?: string }; task?: TaskValues; hasSubmissions?: boolean; types: { key: string; label: string }[];
}) {
  const v: TaskValues = task ?? { kind: "assignment", title: "", instructions: "", max_score: 100, required_links: [], is_open: true, opens_at: null, closes_at: null };
  const { state, pending, onSubmit } = useKeepValues(saveTask);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6 rounded-2xl border border-line bg-white p-6">
      <input type="hidden" name="cohort_course_id" value={ctx.cohortCourseId} />
      <input type="hidden" name="cohort_slug" value={ctx.cohortSlug} />
      <input type="hidden" name="course_slug" value={ctx.courseSlug} />
      {v.id && <><input type="hidden" name="task_id" value={v.id} /><input type="hidden" name="task_slug" value={v.slug} /></>}

      <div className="grid gap-5 sm:grid-cols-[1fr_12rem]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="title" className="font-semibold">Title</label>
          <input id="title" name="title" required defaultValue={v.title} placeholder="Week 3 Assignment" className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="kind" className="font-semibold">Type</label>
          <select id="kind" name="kind" defaultValue={v.kind} className={field}>
            <option value="assignment">Assignment</option>
            <option value="capstone">Capstone</option>
          </select>
        </div>
      </div>

      {v.id && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="slug_new" className="font-semibold">Link address of this task</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">/submit/{ctx.formSlug}/</span>
            <input id="slug_new" name="slug_new" defaultValue={v.slug} className={`${field} min-w-0 flex-1`} />
          </div>
          <p className="text-sm text-muted">Letters, numbers and dashes only. If you change it, the old direct link for this task stops working.</p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="instructions" className="font-semibold">Instructions students will see</label>
        <textarea id="instructions" name="instructions" rows={4} defaultValue={v.instructions} className={field}
          placeholder="Tell students exactly what to send and how." />
      </div>

      <div className="flex flex-col gap-1.5 sm:w-48">
        <label htmlFor="max_score" className="font-semibold">Highest score</label>
        <input id="max_score" name="max_score" type="number" min={1} step={1} required defaultValue={v.max_score} className={field} />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="font-semibold">Links students must send</legend>
        <p className="text-sm text-muted">
          {hasSubmissions ? "Students have already submitted, so these cannot be changed any more." : "Tick every kind of link this task needs. Each one gets its own box on the form. Need a different kind? Add it on the Tasks page first."}
        </p>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          {types.map(({ key: k, label }) => (
            <label key={k} className={`flex items-center gap-3 rounded-xl border-[1.5px] border-line bg-white px-4 py-3 font-medium has-[:checked]:border-brand has-[:checked]:bg-sky ${hasSubmissions ? "opacity-70" : "cursor-pointer"}`}>
              <input type="checkbox" name="link" value={k} defaultChecked={v.required_links.includes(k)} disabled={hasSubmissions} className="h-5 w-5 accent-brand" />
              {label}
            </label>
          ))}
        </div>
        {hasSubmissions && v.required_links.map((k) => <input key={k} type="hidden" name="link" value={k} />)}
      </fieldset>

      <label className="flex items-center gap-3 font-medium">
        <input type="checkbox" name="is_open" defaultChecked={v.is_open} className="h-5 w-5 accent-brand" />
        Open for submissions
      </label>

      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-2 font-semibold">Optional dates <span className="font-normal text-muted">(Lagos time)</span></legend>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="opens_at" className="text-sm font-semibold">Opens</label>
          <input id="opens_at" name="opens_at" type="datetime-local" defaultValue={toLagosInput(v.opens_at)} className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="closes_at" className="text-sm font-semibold">Closes</label>
          <input id="closes_at" name="closes_at" type="datetime-local" defaultValue={toLagosInput(v.closes_at)} className={field} />
        </div>
      </fieldset>

      {state?.error && <p role="alert" className="rounded-xl bg-[#fbe9e6] px-4 py-3 text-sm font-medium text-fail">{state.error}</p>}

      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton pending={pending}>{v.id ? "Save task" : "Create task"}</SubmitButton>
        <Link href={`/dashboard/cohorts/${ctx.cohortSlug}/${ctx.courseSlug}/tasks`} className="font-semibold text-brand">Cancel</Link>
      </div>
    </form>
  );
}
