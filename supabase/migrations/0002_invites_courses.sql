-- Stage 2: an invite can carry the cohort courses a new moderator should get on day one.
alter table public.invites
  add column cohort_course_ids uuid[] not null default '{}';
