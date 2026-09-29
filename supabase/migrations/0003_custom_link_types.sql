-- Stage 4 extra: staff can add their own kinds of link (Gamma, Figma, Loom, anything).
create table public.link_types (
  key         text primary key check (key like 'custom-%'),
  label       text not null,
  domains     text[] not null check (cardinality(domains) > 0),
  hint        text not null default '',
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.link_types enable row level security;

create policy link_types_read on public.link_types for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid()));
create policy link_types_write on public.link_types for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid()))
  with check (exists (select 1 from public.profiles where id = auth.uid()));
