-- Lets a moderator tick that they have emailed the feedback to a student, and remembers who ticked it and when.
alter table public.submissions
  add column if not exists resubmit_emailed_at timestamptz,
  add column if not exists resubmit_emailed_by uuid references public.profiles(id) on delete set null;
