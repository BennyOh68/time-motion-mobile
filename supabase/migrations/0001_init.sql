-- ============================================================================
-- 0001_init.sql — Time & Motion Study: Supabase data tables + RLS
-- Run this in the Supabase SQL Editor (or via supabase db push).
-- Enables cross-device sync: all collected data lives in Postgres, scoped to
-- the authenticated user via auth.uid().
-- ============================================================================

-- ── Table 1: time_entries (core data collection) ────────────────────────────
create table if not exists public.time_entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  category      text not null,            -- Preparation | Production | Waits | Safety | QC
  activity_name text not null,
  time_in       text,                     -- keeps existing "H:MMam/pm" display strings
  time_out      text,
  project_name  text,
  team_rig      text,
  work_type     text,                     -- JGP | GH
  ref_point     text,
  start_depth   numeric(8,2),
  end_depth     numeric(8,2),
  log_date      date not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists time_entries_user_date_idx
  on public.time_entries (user_id, log_date desc);

-- ── Table 2: dropdown_settings (per-user Setup page lists) ──────────────────
create table if not exists public.dropdown_settings (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  rig_list             jsonb not null default '[]'::jsonb,
  preparation_list     jsonb not null default '[]'::jsonb,
  production_list      jsonb not null default '[]'::jsonb,
  waits_list           jsonb not null default '[]'::jsonb,
  last_prep_selection  text not null default '',
  last_prod_selection  text not null default '',
  last_wait_selection  text not null default '',
  hidden_prep          jsonb not null default '{}'::jsonb,
  hidden_prod          jsonb not null default '{}'::jsonb,
  hidden_wait          jsonb not null default '{}'::jsonb,
  updated_at           timestamptz not null default now()
);

-- ── Optional Table 3: profiles (user metadata) ──────────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now()
);

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table public.time_entries      enable row level security;
alter table public.dropdown_settings enable row level security;
alter table public.profiles          enable row level security;

drop policy if exists "own time_entries" on public.time_entries;
create policy "own time_entries" on public.time_entries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own dropdown_settings" on public.dropdown_settings;
create policy "own dropdown_settings" on public.dropdown_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ── Grants (REQUIRED: PostgREST 403 "permission denied" without these) ───────
-- RLS still enforces row-level ownership below; grants merely let the API
-- roles reach the tables so policies can filter.
grant usage on schema public to anon, authenticated;
grant all on table public.time_entries      to anon, authenticated;
grant all on table public.dropdown_settings to anon, authenticated;
grant all on table public.profiles          to anon, authenticated;

-- ── Realtime (optional: push inserts/updates to all devices) ─────────────────
alter publication supabase_realtime add table public.time_entries;
alter publication supabase_realtime add table public.dropdown_settings;
