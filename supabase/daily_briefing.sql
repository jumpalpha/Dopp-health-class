-- ============================================================
-- Daily Briefing: teacher announcement + Survey of the Day. Safe to re-run.
-- Shown on welcome.html ("Welcome back" screen). Applied 2026-10-18.
--
-- Same pattern as the rest of the site: RLS on, no policies; the website only calls
-- the SECURITY DEFINER functions below. Students authenticate with id + PIN hash,
-- the teacher with the dashboard passphrase (_teacher_ok).
-- Nothing here awards XP. Survey answers are anonymous to other students: they only
-- ever see totals, and only after answering.
-- ============================================================

create table if not exists public.daily_briefing (
  trimester    text primary key,
  announcement text not null default '',
  survey_id    text,                       -- changes whenever the teacher posts a new question
  survey_q     text,
  survey_opts  jsonb not null default '[]'::jsonb,   -- ["Yes","No",...] (2–6 choices)
  updated_at   timestamptz not null default now()
);
alter table public.daily_briefing enable row level security;

create table if not exists public.survey_answers (
  survey_id  text not null,
  student_id uuid not null references public.students(id) on delete cascade,
  trimester  text not null,
  choice     int  not null check (choice between 0 and 5),
  answered_at timestamptz not null default now(),
  primary key (survey_id, student_id)
);
alter table public.survey_answers enable row level security;

create or replace function public._survey_counts(p_survey text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(choice::text, n), '{}'::jsonb)
    from (select choice, count(*) n from public.survey_answers where survey_id = p_survey group by choice) x;
$$;
revoke all on function public._survey_counts(text) from public, anon, authenticated;

-- ---------- student ----------
create or replace function public.briefing_get(p_student_id uuid, p_pin_hash text, p_trimester text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare b public.daily_briefing; mine int;
begin
  if not exists (select 1 from public.students s where s.id = p_student_id and s.pin_hash = p_pin_hash and s.trimester = p_trimester)
    then raise exception 'not signed in'; end if;
  select * into b from public.daily_briefing where trimester = p_trimester;
  if not found then return jsonb_build_object('announcement', '', 'survey', null); end if;
  if b.survey_id is not null then
    select choice into mine from public.survey_answers where survey_id = b.survey_id and student_id = p_student_id;
  end if;
  return jsonb_build_object(
    'announcement', b.announcement, 'updated_at', b.updated_at,
    'survey', case when b.survey_id is null then null else jsonb_build_object(
      'id', b.survey_id, 'q', b.survey_q, 'opts', b.survey_opts, 'mine', mine,
      'counts', case when mine is null then null else public._survey_counts(b.survey_id) end) end);
end $$;

create or replace function public.survey_answer(p_student_id uuid, p_pin_hash text, p_trimester text, p_survey_id text, p_choice int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b public.daily_briefing;
begin
  if not exists (select 1 from public.students s where s.id = p_student_id and s.pin_hash = p_pin_hash and s.trimester = p_trimester)
    then raise exception 'not signed in'; end if;
  select * into b from public.daily_briefing where trimester = p_trimester;
  if not found or b.survey_id is distinct from p_survey_id then raise exception 'That survey has closed'; end if;
  if p_choice < 0 or p_choice >= jsonb_array_length(b.survey_opts) then raise exception 'bad choice'; end if;
  insert into public.survey_answers (survey_id, student_id, trimester, choice)
  values (p_survey_id, p_student_id, p_trimester, p_choice)
  on conflict (survey_id, student_id) do update set choice = excluded.choice, answered_at = now();
  return jsonb_build_object('mine', p_choice, 'counts', public._survey_counts(p_survey_id));
end $$;

-- ---------- teacher ----------
create or replace function public.briefing_teacher_get(p_teacher_pass text, p_trimester text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare b public.daily_briefing;
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  select * into b from public.daily_briefing where trimester = p_trimester;
  if not found then return jsonb_build_object('announcement', '', 'survey', null); end if;
  return jsonb_build_object('announcement', b.announcement, 'updated_at', b.updated_at,
    'survey', case when b.survey_id is null then null else jsonb_build_object(
      'id', b.survey_id, 'q', b.survey_q, 'opts', b.survey_opts, 'counts', public._survey_counts(b.survey_id),
      'total', (select count(*) from public.survey_answers where survey_id = b.survey_id)) end);
end $$;

-- p_survey_q null/empty = no survey. A different question or choices starts a fresh survey (new id, zero answers).
create or replace function public.briefing_teacher_set(p_teacher_pass text, p_trimester text, p_announcement text, p_survey_q text, p_survey_opts jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b public.daily_briefing; q text := nullif(btrim(coalesce(p_survey_q, '')), ''); opts jsonb := coalesce(p_survey_opts, '[]'::jsonb); sid text;
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  if q is not null and (jsonb_typeof(opts) <> 'array' or jsonb_array_length(opts) not between 2 and 6) then
    raise exception 'A survey needs 2 to 6 choices'; end if;
  if q is null then opts := '[]'::jsonb; end if;
  select * into b from public.daily_briefing where trimester = p_trimester;
  if q is null then sid := null;
  elsif found and b.survey_id is not null and b.survey_q = q and b.survey_opts = opts then sid := b.survey_id;
  else sid := p_trimester || '-' || to_char(now(), 'YYYYMMDDHH24MISS');
  end if;
  insert into public.daily_briefing (trimester, announcement, survey_id, survey_q, survey_opts, updated_at)
  values (p_trimester, left(coalesce(p_announcement, ''), 2000), sid, left(q, 300), opts, now())
  on conflict (trimester) do update set announcement = excluded.announcement, survey_id = excluded.survey_id,
    survey_q = excluded.survey_q, survey_opts = excluded.survey_opts, updated_at = now();
  return public.briefing_teacher_get(p_teacher_pass, p_trimester);
end $$;

grant execute on function public.briefing_get(uuid, text, text) to anon, authenticated;
grant execute on function public.survey_answer(uuid, text, text, text, int) to anon, authenticated;
grant execute on function public.briefing_teacher_get(text, text) to anon, authenticated;
grant execute on function public.briefing_teacher_set(text, text, text, text, jsonb) to anon, authenticated;
