-- ============================================================
-- Survey of the Day, automatic + anonymous. Safe to re-run. Applied 2026-10-28.
-- Replaces the survey half of daily_briefing.sql (the announcement is unchanged).
--
-- • 100 questions live in survey_bank (data: survey_bank_data.sql). Each school day (Mon–Fri,
--   Idaho time) the first student to open the site gets the next unused number, so a
--   question never repeats until all 100 have been used (a trimester is ~60 school days).
--   Days nobody logs in (breaks, snow days) don't use up a question.
-- • ANONYMOUS: survey_votes records only THAT a student answered (one vote each);
--   survey_tallies holds only the totals. No table links a student to a choice, and
--   neither stores a time, so answers can't be matched back to names. Answers are final.
-- • Students see a day's totals after they vote; any past day's totals are visible to all
--   (Quest page calendar). Future questions are never created early, so they can't leak.
-- • The teacher can override today's question from the dashboard (old Daily Briefing card).
-- ============================================================

create table if not exists public.survey_bank (
  n    int primary key check (n between 1 and 1000),
  q    text not null,
  opts jsonb not null
);
alter table public.survey_bank enable row level security;

create table if not exists public.survey_days (
  day       date primary key,               -- Idaho calendar day
  trimester text not null,
  bank_n    int references public.survey_bank(n),   -- null = teacher's own question
  q         text,                            -- null = teacher turned the survey off today
  opts      jsonb not null default '[]'::jsonb
);
alter table public.survey_days enable row level security;

create table if not exists public.survey_votes (     -- who has answered (no choice stored)
  day        date not null references public.survey_days(day) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  primary key (day, student_id)
);
alter table public.survey_votes enable row level security;

create table if not exists public.survey_tallies (   -- totals only (no student stored)
  day    date not null references public.survey_days(day) on delete cascade,
  choice int  not null check (choice between 0 and 5),
  n      int  not null default 0,
  primary key (day, choice)
);
alter table public.survey_tallies enable row level security;

create or replace function public._survey_idaho_today() returns date
language sql stable as $$ select (now() at time zone 'America/Boise')::date $$;

create or replace function public._survey_ok(p_student_id uuid, p_pin_hash text, p_trimester text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.students s where s.id = p_student_id and s.pin_hash = p_pin_hash and s.trimester = p_trimester);
$$;

create or replace function public._survey_counts_day(p_day date) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(choice::text, n), '{}'::jsonb) from public.survey_tallies where day = p_day;
$$;

-- Today's row, creating it from the bank on the first visit of a school day. Null on weekends.
create or replace function public._survey_today(p_trimester text) returns public.survey_days
language plpgsql security definer set search_path = public as $$
declare d date := public._survey_idaho_today(); r public.survey_days; nxt int; maxn int;
begin
  select * into r from public.survey_days where day = d;
  if found then return r; end if;
  if extract(isodow from d) >= 6 then return null; end if;
  perform pg_advisory_xact_lock(hashtext('survey_today'));
  select * into r from public.survey_days where day = d;
  if found then return r; end if;
  select coalesce(max(n), 0) into maxn from public.survey_bank;
  if maxn = 0 then return null; end if;
  select coalesce((select bank_n from public.survey_days where bank_n is not null order by day desc limit 1), 0) % maxn + 1 into nxt;
  while not exists (select 1 from public.survey_bank where n = nxt) loop nxt := nxt % maxn + 1; end loop;
  insert into public.survey_days (day, trimester, bank_n, q, opts)
    select d, p_trimester, b.n, b.q, b.opts from public.survey_bank b where b.n = nxt
  returning * into r;
  return r;
end $$;

create or replace function public._survey_json(r public.survey_days, p_student_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare voted boolean; past boolean := r.day < public._survey_idaho_today();
begin
  voted := p_student_id is not null and exists (select 1 from public.survey_votes v where v.day = r.day and v.student_id = p_student_id);
  return jsonb_build_object('id', r.day::text, 'day', r.day, 'q', r.q, 'opts', r.opts, 'voted', voted, 'open', not past,
    'counts', case when voted or past then public._survey_counts_day(r.day) else null end,
    'total', case when voted or past then (select coalesce(sum(n), 0) from public.survey_tallies t where t.day = r.day) else null end);
end $$;

-- ---------- student ----------
create or replace function public.briefing_get(p_student_id uuid, p_pin_hash text, p_trimester text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare b public.daily_briefing; r public.survey_days;
begin
  if not public._survey_ok(p_student_id, p_pin_hash, p_trimester) then raise exception 'not signed in'; end if;
  select * into b from public.daily_briefing where trimester = p_trimester;
  r := public._survey_today(p_trimester);
  return jsonb_build_object('announcement', coalesce(b.announcement, ''), 'updated_at', b.updated_at,
    'survey', case when r.day is null or r.q is null then null else public._survey_json(r, p_student_id) end);
end $$;

-- p_survey_id is the day ('2026-10-28'). One vote per student per day; final.
create or replace function public.survey_answer(p_student_id uuid, p_pin_hash text, p_trimester text, p_survey_id text, p_choice int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.survey_days;
begin
  if not public._survey_ok(p_student_id, p_pin_hash, p_trimester) then raise exception 'not signed in'; end if;
  r := public._survey_today(p_trimester);
  if r.day is null or r.q is null or r.day::text is distinct from p_survey_id then raise exception 'That survey has closed'; end if;
  if p_choice < 0 or p_choice >= jsonb_array_length(r.opts) then raise exception 'bad choice'; end if;
  insert into public.survey_votes (day, student_id) values (r.day, p_student_id) on conflict do nothing;
  if found then
    insert into public.survey_tallies (day, choice, n) values (r.day, p_choice, 1)
    on conflict (day, choice) do update set n = public.survey_tallies.n + 1;
  end if;
  return public._survey_json(r, p_student_id);
end $$;

-- Quest page calendar: every survey day in the range up to today, newest last.
create or replace function public.survey_calendar(p_student_id uuid, p_pin_hash text, p_trimester text, p_from date, p_to date)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if not public._survey_ok(p_student_id, p_pin_hash, p_trimester) then raise exception 'not signed in'; end if;
  perform public._survey_today(p_trimester);
  return coalesce((select jsonb_agg(public._survey_json(r, p_student_id) order by r.day)
    from public.survey_days r
    where r.day between p_from and least(p_to, public._survey_idaho_today()) and r.q is not null), '[]'::jsonb);
end $$;

-- ---------- teacher ----------
create or replace function public.briefing_teacher_get(p_teacher_pass text, p_trimester text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare b public.daily_briefing; r public.survey_days;
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  select * into b from public.daily_briefing where trimester = p_trimester;
  r := public._survey_today(p_trimester);
  return jsonb_build_object('announcement', coalesce(b.announcement, ''), 'updated_at', b.updated_at,
    'weekend', r.day is null,
    'survey', case when r.day is null or r.q is null then null else
      public._survey_json(r, null) || jsonb_build_object('bank_n', r.bank_n,
        'counts', public._survey_counts_day(r.day),
        'total', (select coalesce(sum(n), 0) from public.survey_tallies t where t.day = r.day)) end);
end $$;

-- Saves the announcement. If the question/choices differ from today's, today's survey is
-- replaced with the teacher's (answers so far are cleared). Empty question = no survey today.
create or replace function public.briefing_teacher_set(p_teacher_pass text, p_trimester text, p_announcement text, p_survey_q text, p_survey_opts jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.survey_days; v_q text := left(nullif(btrim(coalesce(p_survey_q, '')), ''), 300); v_opts jsonb := coalesce(p_survey_opts, '[]'::jsonb);
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  if v_q is not null and (jsonb_typeof(v_opts) <> 'array' or jsonb_array_length(v_opts) not between 2 and 6) then
    raise exception 'A survey needs 2 to 6 choices'; end if;
  if v_q is null then v_opts := '[]'::jsonb; end if;
  insert into public.daily_briefing (trimester, announcement, updated_at)
  values (p_trimester, left(coalesce(p_announcement, ''), 2000), now())
  on conflict (trimester) do update set announcement = excluded.announcement, updated_at = now();
  r := public._survey_today(p_trimester);
  if r.day is null then
    if v_q is not null then raise exception 'There is no Survey of the Day on weekends'; end if;
  elsif r.q is distinct from v_q or r.opts is distinct from v_opts then
    delete from public.survey_votes where day = r.day;
    delete from public.survey_tallies where day = r.day;
    update public.survey_days set q = v_q, opts = v_opts, bank_n = null where day = r.day;
  end if;
  return public.briefing_teacher_get(p_teacher_pass, p_trimester);
end $$;

revoke all on function public._survey_today(text) from public, anon, authenticated;
revoke all on function public._survey_json(public.survey_days, uuid) from public, anon, authenticated;
revoke all on function public._survey_counts_day(date) from public, anon, authenticated;
revoke all on function public._survey_ok(uuid, text, text) from public, anon, authenticated;
grant execute on function public.briefing_get(uuid, text, text) to anon, authenticated;
grant execute on function public.survey_answer(uuid, text, text, text, int) to anon, authenticated;
grant execute on function public.survey_calendar(uuid, text, text, date, date) to anon, authenticated;
grant execute on function public.briefing_teacher_get(text, text) to anon, authenticated;
grant execute on function public.briefing_teacher_set(text, text, text, text, jsonb) to anon, authenticated;
