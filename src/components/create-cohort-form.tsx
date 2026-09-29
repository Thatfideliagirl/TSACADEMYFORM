"use client";

import { createCohort } from "@/app/actions/cohorts";
import { SubmitButton } from "./submit-button";
import { inputClass } from "./auth-shell";
import { useKeepValues } from "./use-keep-values";

export function CreateCohortForm({ courses }: { courses: { id: string; name: string }[] }) {
  const { state, pending, onSubmit } = useKeepValues(createCohort);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="font-semibold">Cohort name</label>
        <input id="name" name="name" required placeholder="Cohort 7" className={inputClass} />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="font-semibold">Courses in this cohort</legend>
        <p className="text-sm text-muted">Tick every course that runs in this cohort. You can add more later.</p>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          {courses.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-xl border-[1.5px] border-line bg-white px-4 py-3 font-medium has-[:checked]:border-brand has-[:checked]:bg-sky">
              <input type="checkbox" name="course" value={c.id} className="h-5 w-5 accent-brand" />
              {c.name}
            </label>
          ))}
        </div>
      </fieldset>
      {state?.error && <p role="alert" className="rounded-xl bg-[#fbe9e6] px-4 py-3 text-sm font-medium text-fail">{state.error}</p>}
      <SubmitButton pending={pending} className="self-start">Create cohort</SubmitButton>
    </form>
  );
}
