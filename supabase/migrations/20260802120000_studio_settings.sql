-- Studio-wide branding settings (brand name, primary colour, display font).
--
-- NOT YET APPLIED. The Profile page currently persists these to localStorage,
-- which is per-browser. Apply this migration and switch
-- src/lib/studio-theme.ts to read/write this table to make branding shared
-- across every user.
--
-- Single-row table: `id` is pinned so there can only ever be one settings row.

create table if not exists public.studio_settings (
  id            boolean primary key default true constraint studio_settings_singleton check (id),
  brand_name    text        not null default 'Saffron Planning Studio',
  primary_color text        not null default 'terracotta',
  display_font  text        not null default 'cormorant',
  updated_at    timestamptz not null default now(),
  updated_by    uuid        references auth.users (id) on delete set null
);

insert into public.studio_settings (id) values (true) on conflict (id) do nothing;

alter table public.studio_settings enable row level security;

-- Everyone signed in can read the branding (it drives the UI for all users).
drop policy if exists studio_settings_read on public.studio_settings;
create policy studio_settings_read
  on public.studio_settings
  for select
  to authenticated
  using (true);

-- Only admins may change it.
drop policy if exists studio_settings_write on public.studio_settings;
create policy studio_settings_write
  on public.studio_settings
  for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
