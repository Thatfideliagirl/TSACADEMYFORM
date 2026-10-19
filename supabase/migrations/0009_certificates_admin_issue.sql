-- Only admins issue certificates. Moderators can see the list for their courses and add students to it.
drop policy if exists certificates_staff on public.certificates;
drop policy if exists certificates_read on public.certificates;
drop policy if exists certificates_add on public.certificates;
drop policy if exists certificates_admin_change on public.certificates;
drop policy if exists certificates_admin_remove on public.certificates;

create policy certificates_read on public.certificates for select to authenticated
  using (public.can_access_cohort_course(cohort_course_id));
create policy certificates_add on public.certificates for insert to authenticated
  with check (public.can_access_cohort_course(cohort_course_id) and status = 'approved');
create policy certificates_admin_change on public.certificates for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy certificates_admin_remove on public.certificates for delete to authenticated
  using (public.is_admin());
