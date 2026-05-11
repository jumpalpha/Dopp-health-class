-- ═══════════════════════════════════════════════════════════════
-- LEGEND OF WELLNESS — Supabase Database Setup
-- Run this entire file in:
--   Supabase Dashboard → SQL Editor → New query → Paste → Run
-- ═══════════════════════════════════════════════════════════════

-- ── TABLES ───────────────────────────────────────────────────

-- Teacher-managed class codes (one per period per trimester)
create table if not exists class_codes (
  code       text primary key,
  label      text not null,
  trimester  text not null default '2026-T1',
  active     boolean default true,
  created_at timestamptz default now()
);

-- Students (identified by class_code + last_name + trimester)
create table if not exists students (
  id           uuid default gen_random_uuid() primary key,
  class_code   text references class_codes(code) on delete restrict,
  last_name    text not null,
  display_name text not null,
  pin_hash     text not null,
  avatar       text default '⚔',
  trimester    text not null default '2026-T1',
  created_at   timestamptz default now()
);

create unique index if not exists students_class_name_trimester
  on students (class_code, lower(last_name), trimester);

-- One row per completed task per student
create table if not exists quest_progress (
  student_id   uuid references students(id) on delete cascade,
  task_key     text not null,
  completed_at timestamptz default now(),
  primary key  (student_id, task_key)
);

-- Activity streak days
create table if not exists active_days (
  student_id uuid references students(id) on delete cascade,
  day_date   date not null,
  primary key (student_id, day_date)
);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────

alter table class_codes    enable row level security;
alter table students       enable row level security;
alter table quest_progress enable row level security;
alter table active_days    enable row level security;

-- Class codes: anyone can read active ones (to validate login)
create policy "read_active_codes"
  on class_codes for select using (active = true);

-- Students: open read/write for publishable key (PIN protects individual records)
create policy "students_select" on students for select using (true);
create policy "students_insert" on students for insert with check (true);
create policy "students_update" on students for update using (true);

-- Progress: full access
create policy "progress_all"
  on quest_progress for all using (true) with check (true);

-- Active days: full access
create policy "days_all"
  on active_days for all using (true) with check (true);

-- ── SEED CLASS CODES (update trimester label each term) ──────

insert into class_codes (code, label, trimester) values
  ('PERIOD1', 'Period 1', '2026-T1'),
  ('PERIOD2', 'Period 2', '2026-T1'),
  ('PERIOD3', 'Period 3', '2026-T1'),
  ('PERIOD4', 'Period 4', '2026-T1'),
  ('PERIOD5', 'Period 5', '2026-T1'),
  ('PERIOD6', 'Period 6', '2026-T1')
on conflict do nothing;

-- ── TO ADD A NEW TRIMESTER ────────────────────────────────────
-- 1. Update TRIMESTER constant in quest.html and teacher.html
-- 2. Run the insert below with the new trimester code:
--
-- insert into class_codes (code, label, trimester) values
--   ('PERIOD1', 'Period 1', '2026-T2'),
--   ('PERIOD2', 'Period 2', '2026-T2'),
--   ('PERIOD3', 'Period 3', '2026-T2'),
--   ('PERIOD4', 'Period 4', '2026-T2'),
--   ('PERIOD5', 'Period 5', '2026-T2'),
--   ('PERIOD6', 'Period 6', '2026-T2');
