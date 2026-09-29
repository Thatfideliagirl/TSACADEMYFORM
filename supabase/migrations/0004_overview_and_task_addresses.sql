-- 1. A task address only has to be unique inside its own course, so every cohort can have "week-1-assignment".
alter table public.tasks drop constraint if exists tasks_slug_key;
alter table public.tasks add constraint tasks_course_slug_key unique (cohort_course_id, slug);

-- 2. One quick trip that gives the numbers for every course a person can see.
-- It follows the same security rules: a moderator only gets the courses given to them.
create or replace function public.course_counts()
returns table (cohort_course_id uuid, students bigint, tasks bigint, submissions bigint, graded bigint, pending_requests bigint)
language sql stable security invoker set search_path = public as $$
  select cc.id,
    (select count(*) from students s where s.cohort_course_id = cc.id),
    (select count(*) from tasks t where t.cohort_course_id = cc.id),
    (select count(*) from submissions x join tasks t on t.id = x.task_id where t.cohort_course_id = cc.id),
    (select count(*) from submissions x join tasks t on t.id = x.task_id where t.cohort_course_id = cc.id and x.score is not null),
    (select count(*) from requests r join tasks t on t.id = r.task_id where t.cohort_course_id = cc.id and r.status = 'pending')
  from cohort_courses cc;
$$;
grant execute on function public.course_counts() to authenticated;
