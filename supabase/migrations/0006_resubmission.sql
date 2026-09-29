-- Resubmission: a moderator can hold a submission back and ask the student to send new links for the ones that were wrong.
-- Everything here is an addition. Nothing that exists is changed or deleted.
alter table public.submissions
  add column if not exists resubmit_asked     boolean     not null default false,
  add column if not exists resubmit_links     text[]      not null default '{}',
  add column if not exists resubmit_feedback  text        not null default '',
  add column if not exists resubmit_asked_at  timestamptz,
  add column if not exists resubmit_asked_by  uuid references public.profiles(id) on delete set null,
  add column if not exists resubmit_count     integer     not null default 0,
  add column if not exists resubmitted_at     timestamptz;

create index if not exists submissions_waiting_resubmit on public.submissions (task_id) where resubmit_asked;

-- The Overview numbers now also know how many submissions are waiting for a student to resubmit.
drop function if exists public.course_counts();
create function public.course_counts()
returns table (cohort_course_id uuid, students bigint, tasks bigint, submissions bigint, graded bigint, pending_requests bigint, waiting_resubmit bigint)
language sql stable security invoker set search_path = public as $$
  select cc.id,
    (select count(*) from students s where s.cohort_course_id = cc.id),
    (select count(*) from tasks t where t.cohort_course_id = cc.id),
    (select count(*) from submissions x join tasks t on t.id = x.task_id where t.cohort_course_id = cc.id),
    (select count(*) from submissions x join tasks t on t.id = x.task_id where t.cohort_course_id = cc.id and x.score is not null),
    (select count(*) from requests r join tasks t on t.id = r.task_id where t.cohort_course_id = cc.id and r.status = 'pending'),
    (select count(*) from submissions x join tasks t on t.id = x.task_id where t.cohort_course_id = cc.id and x.resubmit_asked)
  from cohort_courses cc;
$$;
grant execute on function public.course_counts() to authenticated;
