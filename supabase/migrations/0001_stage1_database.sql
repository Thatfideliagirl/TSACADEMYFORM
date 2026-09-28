-- TS Academy Submit, Stage 1: tables, security rules and demo data.
-- Safe to read top to bottom. Run it once in the Supabase SQL Editor.

-- ============================================================
-- 1. TABLES
-- ============================================================

-- One row per staff member (admin or moderator). id matches their login.
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  email       text not null unique,
  role        text not null check (role in ('admin', 'moderator')),
  created_at  timestamptz not null default now()
);

-- A plain list of course names (Virtual Assistant, Cybersecurity, ...).
create table public.courses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  created_at  timestamptz not null default now()
);

-- A cohort, for example "Cohort 6". Only admins create these.
create table public.cohorts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  is_open     boolean not null default true,
  created_at  timestamptz not null default now()
);

-- A course running inside one cohort. This is where students, tasks and form links live.
create table public.cohort_courses (
  id          uuid primary key default gen_random_uuid(),
  cohort_id   uuid not null references public.cohorts(id) on delete cascade,
  course_id   uuid not null references public.courses(id) on delete restrict,
  form_name   text not null,
  form_slug   text not null unique,
  is_open     boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (cohort_id, course_id)
);

-- Which moderators look after which cohort course.
create table public.cohort_course_moderators (
  cohort_course_id  uuid not null references public.cohort_courses(id) on delete cascade,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  primary key (cohort_course_id, user_id)
);

-- Invites. Admin adds an email, the app stores only a scrambled (hashed) version of the code.
create table public.invites (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  role        text not null check (role in ('admin', 'moderator')),
  code_hash   text not null,
  used_at     timestamptz,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- The uploaded student list for one cohort course.
create table public.students (
  id                   uuid primary key default gen_random_uuid(),
  cohort_course_id     uuid not null references public.cohort_courses(id) on delete cascade,
  full_name            text not null,
  -- Lowercase, extra spaces removed. Used to match what a student types.
  full_name_normalised text generated always as (lower(regexp_replace(btrim(full_name), '\s+', ' ', 'g'))) stored,
  email                text not null,
  created_at           timestamptz not null default now(),
  unique (cohort_course_id, email)
);

-- Assignments and capstones.
create table public.tasks (
  id                uuid primary key default gen_random_uuid(),
  cohort_course_id  uuid not null references public.cohort_courses(id) on delete cascade,
  kind              text not null check (kind in ('assignment', 'capstone')),
  title             text not null,
  slug              text not null unique,
  instructions      text not null default '',
  max_score         integer not null default 100 check (max_score > 0),
  required_links    text[] not null default '{}',
  is_open           boolean not null default true,
  opens_at          timestamptz,
  closes_at         timestamptz,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);

-- One submission per student per task. The unique line below is what enforces it.
create table public.submissions (
  id                     uuid primary key default gen_random_uuid(),
  task_id                uuid not null references public.tasks(id) on delete cascade,
  student_id             uuid not null references public.students(id) on delete cascade,
  links                  jsonb not null default '{}',
  unverified_links       text[] not null default '{}',
  submitted_at           timestamptz not null default now(),
  reviewed               jsonb not null default '{}',
  score                  numeric check (score >= 0),
  comment                text not null default '',
  graded_by              uuid references public.profiles(id) on delete set null,
  graded_at              timestamptz,
  changed_after_grading  boolean not null default false,
  unique (task_id, student_id)
);

-- Old links kept when a moderator allows a replacement.
create table public.submission_link_history (
  id             uuid primary key default gen_random_uuid(),
  submission_id  uuid not null references public.submissions(id) on delete cascade,
  link_type      text not null,
  old_url        text not null,
  new_url        text not null,
  changed_at     timestamptz not null default now()
);

-- One request per student per task: replace a link, or leave a note.
create table public.requests (
  id             uuid primary key default gen_random_uuid(),
  task_id        uuid not null references public.tasks(id) on delete cascade,
  student_id     uuid not null references public.students(id) on delete cascade,
  submission_id  uuid not null references public.submissions(id) on delete cascade,
  kind           text not null check (kind in ('replace_link', 'note')),
  link_type      text,
  new_url        text,
  reason         text not null check (char_length(btrim(reason)) >= 40),
  status         text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  decided_by     uuid references public.profiles(id) on delete set null,
  decided_at     timestamptz,
  created_at     timestamptz not null default now(),
  unique (task_id, student_id),
  check (kind = 'note' or (link_type is not null and new_url is not null))
);

-- Used by the student form to limit guessing. Only the server touches this table.
create table public.verify_attempts (
  id          bigint generated always as identity primary key,
  device_key  text not null,
  created_at  timestamptz not null default now()
);
create index verify_attempts_lookup on public.verify_attempts (device_key, created_at);

-- Helpful lookups
create index students_lookup       on public.students (cohort_course_id, email);
create index tasks_by_course       on public.tasks (cohort_course_id);
create index submissions_by_task   on public.submissions (task_id);
create index requests_by_task      on public.requests (task_id, status);

-- ============================================================
-- 2. SMALL HELPERS
-- ============================================================

-- Emails are always stored lowercase with no spaces at the ends.
create function public.normalise_email() returns trigger
language plpgsql as $$
begin
  new.email := lower(btrim(new.email));
  return new;
end $$;

create trigger students_email_clean before insert or update on public.students
  for each row execute function public.normalise_email();
create trigger invites_email_clean before insert or update on public.invites
  for each row execute function public.normalise_email();
create trigger profiles_email_clean before insert or update on public.profiles
  for each row execute function public.normalise_email();

-- Is the person signed in an admin?
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Can the person signed in work in this cohort course? Admins: always. Moderators: only their own.
create function public.can_access_cohort_course(cc uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from public.cohort_course_moderators m
                 where m.cohort_course_id = cc and m.user_id = auth.uid());
$$;

create function public.can_access_task(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tasks k
                 where k.id = t and public.can_access_cohort_course(k.cohort_course_id));
$$;

create function public.can_access_submission(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.submissions x
                 where x.id = s and public.can_access_task(x.task_id));
$$;

-- Moderators may update some columns only. The app's server (no signed in person) is not limited.
create function public.guard_cohort_course_update() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and (new.cohort_id <> old.cohort_id or new.course_id <> old.course_id or new.form_slug <> old.form_slug) then
    raise exception 'Only an admin can change the cohort, course or form link address.';
  end if;
  return new;
end $$;
create trigger cohort_courses_guard before update on public.cohort_courses
  for each row execute function public.guard_cohort_course_update();

create function public.guard_submission_update() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null and (
       new.task_id <> old.task_id or new.student_id <> old.student_id
       or new.links <> old.links or new.unverified_links <> old.unverified_links
       or new.submitted_at <> old.submitted_at) then
    raise exception 'Moderators can mark a submission but cannot change what the student sent.';
  end if;
  return new;
end $$;
create trigger submissions_guard before update on public.submissions
  for each row execute function public.guard_submission_update();

create function public.guard_request_update() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null and (
       new.task_id <> old.task_id or new.student_id <> old.student_id or new.submission_id <> old.submission_id
       or new.kind <> old.kind or new.link_type is distinct from old.link_type
       or new.new_url is distinct from old.new_url or new.reason <> old.reason) then
    raise exception 'Moderators can allow or decline a request but cannot edit it.';
  end if;
  return new;
end $$;
create trigger requests_guard before update on public.requests
  for each row execute function public.guard_request_update();

-- ============================================================
-- 3. SECURITY RULES (Row Level Security)
-- Students have no rules here on purpose: they never read tables directly.
-- The app's server checks them and talks to the database on their behalf.
-- ============================================================

alter table public.profiles                 enable row level security;
alter table public.courses                  enable row level security;
alter table public.cohorts                  enable row level security;
alter table public.cohort_courses           enable row level security;
alter table public.cohort_course_moderators enable row level security;
alter table public.invites                  enable row level security;
alter table public.students                 enable row level security;
alter table public.tasks                    enable row level security;
alter table public.submissions              enable row level security;
alter table public.submission_link_history  enable row level security;
alter table public.requests                 enable row level security;
alter table public.verify_attempts          enable row level security;

-- profiles: you see yourself, admins see everyone and manage roles.
create policy profiles_read   on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_admin  on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- courses: any signed in staff can read the list, only admins change it.
create policy courses_read    on public.courses for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid()));
create policy courses_admin   on public.courses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- cohorts: admins see all, moderators see cohorts where they have a course.
create policy cohorts_read    on public.cohorts for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.cohort_courses cc
    where cc.cohort_id = cohorts.id and public.can_access_cohort_course(cc.id)));
create policy cohorts_admin   on public.cohorts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- cohort courses: staff read their own, moderators may rename the form, only admins create or delete.
create policy cc_read         on public.cohort_courses for select to authenticated
  using (public.can_access_cohort_course(id));
create policy cc_update       on public.cohort_courses for update to authenticated
  using (public.can_access_cohort_course(id)) with check (public.can_access_cohort_course(id));
create policy cc_admin_insert on public.cohort_courses for insert to authenticated
  with check (public.is_admin());
create policy cc_admin_delete on public.cohort_courses for delete to authenticated
  using (public.is_admin());

-- moderator assignments: admins manage, a moderator can see their own.
create policy ccm_read        on public.cohort_course_moderators for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy ccm_admin       on public.cohort_course_moderators for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- invites: admins only.
create policy invites_admin   on public.invites for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- students and tasks: full control for anyone who can work in that cohort course.
create policy students_staff  on public.students for all to authenticated
  using (public.can_access_cohort_course(cohort_course_id))
  with check (public.can_access_cohort_course(cohort_course_id));
create policy tasks_staff     on public.tasks for all to authenticated
  using (public.can_access_cohort_course(cohort_course_id))
  with check (public.can_access_cohort_course(cohort_course_id));

-- submissions, history, requests: staff can read and mark. Only the server creates them.
create policy submissions_read   on public.submissions for select to authenticated
  using (public.can_access_task(task_id));
create policy submissions_mark   on public.submissions for update to authenticated
  using (public.can_access_task(task_id)) with check (public.can_access_task(task_id));
create policy history_read       on public.submission_link_history for select to authenticated
  using (public.can_access_submission(submission_id));
create policy requests_read      on public.requests for select to authenticated
  using (public.can_access_task(task_id));
create policy requests_decide    on public.requests for update to authenticated
  using (public.can_access_task(task_id)) with check (public.can_access_task(task_id));

-- verify_attempts: no policies at all. Nobody signed in can touch it. Only the server can.

-- ============================================================
-- 4. STARTING DATA
-- ============================================================

-- The real course list.
insert into public.courses (name, slug) values
  ('Virtual Assistant',     'virtual-assistant'),
  ('Project Management',    'project-management'),
  ('Cybersecurity',         'cybersecurity'),
  ('Data Analytics',        'data-analytics'),
  ('AI and Automation',     'ai-and-automation'),
  ('Product Design',        'product-design'),
  ('Software Development',  'software-development');

-- DEMO DATA. Delete the cohort called "Demo Cohort" later and all of this goes with it.
insert into public.cohorts (name, slug) values ('Demo Cohort', 'demo-cohort');

insert into public.cohort_courses (cohort_id, course_id, form_name, form_slug)
select c.id, k.id, 'Virtual Assistant Submissions (demo)', 'demo-virtual-assistant'
from public.cohorts c, public.courses k where c.slug = 'demo-cohort' and k.slug = 'virtual-assistant';

insert into public.cohort_courses (cohort_id, course_id, form_name, form_slug)
select c.id, k.id, 'Project Management Submissions (demo)', 'demo-project-management'
from public.cohorts c, public.courses k where c.slug = 'demo-cohort' and k.slug = 'project-management';

insert into public.students (cohort_course_id, full_name, email)
select cc.id, s.full_name, s.email
from public.cohort_courses cc,
     (values ('Adaeze Okafor', 'adaeze.o@example.com'),
             ('Tunde Bakare',  'tunde.b@example.com'),
             ('Chioma Nwosu',  'chioma.n@example.com')) as s(full_name, email)
where cc.form_slug = 'demo-virtual-assistant';

insert into public.tasks (cohort_course_id, kind, title, slug, instructions, max_score, required_links)
select cc.id, t.kind, t.title, t.slug, t.instructions, t.max_score, t.links
from public.cohort_courses cc,
     (values
       ('assignment', 'Week 3 Assignment (demo)', 'demo-va-week-3',
        'Write the client welcome email in a Google Doc and build the tracker in Notion.', 20, array['gdoc', 'notion']),
       ('capstone', 'Capstone (demo)', 'demo-va-capstone',
        'Complete all five tasks and paste each link in its own box.', 100, array['drive', 'gdoc', 'notion', 'canva', 'trello'])
     ) as t(kind, title, slug, instructions, max_score, links)
where cc.form_slug = 'demo-virtual-assistant';

insert into public.submissions (task_id, student_id, links)
select t.id, s.id, jsonb_build_object(
  'gdoc',   'https://docs.google.com/document/d/1DemoWelcomeEmail/edit',
  'notion', 'https://demo.notion.site/Client-Tracker')
from public.tasks t, public.students s
where t.slug = 'demo-va-week-3' and s.email = 'chioma.n@example.com';
