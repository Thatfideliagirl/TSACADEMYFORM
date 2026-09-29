-- Notification bell: remembers when each staff member last looked, so the bell can count what is new since then.
alter table public.profiles add column if not exists notifications_seen_at timestamptz not null default now();
