-- Certificates. One template per course (reused by every cohort), a list of students approved for a certificate in each cohort course,
-- and the issue date. Nothing existing is changed.

-- The template picture and where the name and the date go. Belongs to the course, so a new cohort reuses it.
create table if not exists public.certificate_templates (
  course_id   uuid primary key references public.courses(id) on delete cascade,
  image       text not null,                 -- the picture, as a data address (resized in the browser before upload)
  width       integer not null,
  height      integer not null,
  boxes       jsonb not null,                -- position, size, font and colour of the name and the date
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null
);

-- Students approved for a certificate in one cohort course, and whether it has been issued.
create table if not exists public.certificates (
  id                uuid primary key default gen_random_uuid(),
  cohort_course_id  uuid not null references public.cohort_courses(id) on delete cascade,
  student_id        uuid not null references public.students(id) on delete cascade,
  submission_id     uuid references public.submissions(id) on delete set null,
  status            text not null default 'approved' check (status in ('approved', 'issued')),
  issue_date        date,
  added_by          uuid references public.profiles(id) on delete set null,
  added_at          timestamptz not null default now(),
  issued_by         uuid references public.profiles(id) on delete set null,
  issued_at         timestamptz,
  unique (cohort_course_id, student_id)
);
create index if not exists certificates_by_course on public.certificates (cohort_course_id, status);

alter table public.certificate_templates enable row level security;
alter table public.certificates enable row level security;

-- Staff can see the template settings. Only admins change them.
drop policy if exists certificate_templates_read on public.certificate_templates;
create policy certificate_templates_read on public.certificate_templates for select to authenticated using (true);
drop policy if exists certificate_templates_admin on public.certificate_templates;
create policy certificate_templates_admin on public.certificate_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Admins and the moderators of a cohort course manage its certificates.
drop policy if exists certificates_staff on public.certificates;
create policy certificates_staff on public.certificates for all to authenticated
  using (public.can_access_cohort_course(cohort_course_id)) with check (public.can_access_cohort_course(cohort_course_id));

grant select, insert, update, delete on public.certificate_templates, public.certificates to authenticated;
