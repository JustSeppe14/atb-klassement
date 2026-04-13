-- ATB Klassement — Supabase database schema
-- Run this in the Supabase SQL Editor: https://supabase.com → your project → SQL Editor

-- ============================================================
-- 1. DEELNEMERS (participants)
-- ============================================================
create table if not exists deelnemers (
  id          bigserial primary key,
  bib         integer not null unique,
  naam        text not null,
  klasse      text not null,
  categorie   text not null check (categorie in ('STA', 'SEN', 'DAM')),
  team        text,
  created_at  timestamptz default now()
);

-- ============================================================
-- 2. RACE RESULTS
-- ============================================================
create table if not exists race_results (
  id          bigserial primary key,
  week        integer not null check (week >= 1 and week <= 20),
  bib         integer not null,
  plaats      integer not null,
  klasse      text,       -- klasse the rider competed in that week (null = current klasse)
  created_at  timestamptz default now(),
  unique (week, bib)
);

-- Migration: add klasse column if upgrading from an existing install
alter table race_results add column if not exists klasse text;

-- ============================================================
-- 3. CONFIG (single row, id=1)
-- ============================================================
create table if not exists config (
  id                        integer primary key default 1,
  current_week              integer default 1,
  is_second_period_started  boolean default false,
  second_period_start_week  integer default 12,
  season_ended              boolean default false,
  updated_at                timestamptz default now(),
  constraint config_single_row check (id = 1)
);

-- Insert default config row
insert into config (id) values (1) on conflict (id) do nothing;

-- ============================================================
-- 4. RACES
-- ============================================================
create table if not exists races (
  id          serial primary key,
  name        text not null,
  date        date,
  sort_order  integer default 0
);

create table if not exists klasse_history (
  id          bigserial primary key,
  bib         integer not null,
  old_klasse  text not null,
  new_klasse  text not null,
  -- week number of the FIRST race in the new klasse (sort_order)
  -- NULL means "not yet assigned to a race" — still useful as an audit log
  from_week   integer,
  changed_at  timestamptz default now()
);


create index if not exists klasse_history_bib_idx on klasse_history (bib);
-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================
alter table deelnemers enable row level security;
alter table race_results enable row level security;
alter table config enable row level security;
alter table races enable row level security;
alter table klasse_history enable row level security;

-- ============================================================
-- 6. POLICIES (read access for everyone)
-- ============================================================

-- Drop policies if they already exist
drop policy if exists "Allow read deelnemers" on deelnemers;
drop policy if exists "Allow read race_results" on race_results;
drop policy if exists "Allow read config" on config;
drop policy if exists "Allow read races" on races;
drop policy if exists "Allow read klasse_history" on klasse_history;

-- Create policies
create policy "Allow read deelnemers"     on deelnemers    for select using (true);
create policy "Allow read race_results"   on race_results for select using (true);
create policy "Allow read config"         on config       for select using (true);
create policy "Allow read races"          on races        for select using (true);
create policy "Allow read klasse_history" on klasse_history for select using (true);
