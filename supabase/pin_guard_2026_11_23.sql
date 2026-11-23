-- pin_guard_2026_11_23.sql — student PIN brute-force protection (migration pin_guard_2026_11_23).
-- STATUS 2026-11-23: NOT YET APPLIED. The scheduled run was stopped at the Supabase approval prompt (no one to approve).
--   To apply: run this file as migration pin_guard_2026_11_23 (it aborts by itself if any function changed since the backup).
-- Backup of every changed function: supabase/pin_guard_2026_11_23_backup.sql (also stored in pin_guard.fn_backup).
--
-- Rule: 5 wrong PINs for one student -> that student is locked for 15 minutes (same rule and message
-- the sign-in page already used since 2026-11-15). Every function that checks a student's PIN now goes
-- through ONE helper, public._pin_ok(student_id, pin_hash):
--   locked -> raises 'Too many wrong PINs — wait a few minutes and try again.'
--   wrong  -> counts a failure, returns false;   right -> clears the count, returns true.
--
-- Why sequences and not a table: most PIN-checking functions RAISE on a wrong PIN, which rolls back
-- anything written in that call — a failure row in a table would vanish. Sequence updates (setval) are
-- never rolled back, so each student gets a private counter pin_guard.f_<student id without dashes>
-- holding (unix seconds of last failure) * 8 + failures. The schema pin_guard is not reachable by
-- anon/authenticated and is not exposed through the API.
-- verify_student_pin keeps its old behaviour when locked (returns no rows; quest.html then calls
-- pin_lock_status for the message). visitor_login keeps its own per-last-name limit (auth_fail table).

create schema if not exists pin_guard;
revoke all on schema pin_guard from public, anon, authenticated;

-- Exact copy of every function this migration changes (for rollback).
create table if not exists pin_guard.fn_backup (sig text primary key, def text not null, saved_at timestamptz not null default now());
alter table pin_guard.fn_backup enable row level security;
revoke all on pin_guard.fn_backup from public, anon, authenticated;
insert into pin_guard.fn_backup (sig, def)
select s, pg_get_functiondef(to_regprocedure('public.' || s)) from unnest(array[
  '_arcade_auth(uuid,text,text)', '_cl_student_ok(uuid,text,text)', '_cw_ok(uuid,text,text)', '_duel_student(uuid,text)', '_es_student_ok(uuid,text,text)', '_fx_ok(uuid,text,text)', '_pet_auth(uuid,text,text)', '_rc_student_ok(uuid,text,text)', '_survey_ok(uuid,text,text)', 'ask_board(uuid,text,text)', 'exit_survey_status(uuid,text,text)', 'get_student_by_auth(uuid,text,text)', 'get_student_days(uuid,text)', 'get_student_tasks(uuid,text)', 'pin_lock_status(uuid,text,text)', 'pin_reset_set(text,uuid,text)', 'reading_status(uuid,text,text)', 'student_remember_perm(uuid,text)', 'teacher_clear_lockout(text,uuid)', 'verify_student_pin(uuid,text,text)', 'ask_submit(uuid,text,text,text,text)', 'complete_day(uuid,text,date)', 'complete_task(uuid,text,text)', 'get_project_data(uuid,text,text,text)', 'get_weight_control_quest_progress(uuid,text,text)', 'join_live_session(text,text,uuid,text,text)', 'mastery_status(uuid,text,text)', 'name_request_cancel(uuid,text,text)', 'name_request_status(uuid,text,text)', 'name_request(uuid,text,text,text)', 'remove_day(uuid,text,date)', 'remove_task(uuid,text,text)', 'reset_student_progress(uuid,text)', 'save_project_data(uuid,text,text,text,jsonb)', 'mastery_answer(uuid,text,text,uuid,integer,text)', 'mastery_start(uuid,text,text,integer)', 'save_weight_control_quest_progress(uuid,text,text,jsonb,integer,boolean)', 'wcq_learn_food(uuid,text,text,text,text)', 'wcq_make_dish(uuid,text,text,text,jsonb)', 'wcq_suggest_dish(uuid,text,text,text,jsonb,text)'
]) s
on conflict (sig) do nothing;

create or replace function pin_guard.seq_for(p_student_id uuid) returns regclass
language sql stable set search_path = '' as $$
  select pg_catalog.to_regclass('pin_guard.f_' || pg_catalog.replace(p_student_id::text, '-', ''));
$$;

create or replace function pin_guard.ensure_seq(p_student_id uuid) returns void
language plpgsql set search_path = '' as $$
begin
  if p_student_id is null then return; end if;
  execute pg_catalog.format('create sequence if not exists pin_guard.%I as bigint minvalue 0 start with 0 no cycle',
                            'f_' || pg_catalog.replace(p_student_id::text, '-', ''));
end $$;

-- When this student's lock ends (null = not locked).
create or replace function pin_guard.locked_until(p_student_id uuid) returns timestamptz
language plpgsql stable set search_path = '' as $$
declare s regclass := pin_guard.seq_for(p_student_id); v bigint; t bigint;
begin
  if s is null then return null; end if;
  v := coalesce(pg_catalog.pg_sequence_last_value(s), 0);
  t := v / 8;
  if v % 8 >= 5 and t + 900 > pg_catalog.floor(extract(epoch from pg_catalog.clock_timestamp()))::bigint then
    return pg_catalog.to_timestamp(t + 900);
  end if;
  return null;
end $$;

create or replace function pin_guard.reset(p_student_id uuid) returns void
language plpgsql set search_path = '' as $$
declare s regclass := pin_guard.seq_for(p_student_id);
begin
  if s is not null then perform pg_catalog.setval(s, 0, true); end if;
end $$;

revoke all on all functions in schema pin_guard from public, anon, authenticated;

-- THE shared PIN check.
create or replace function public._pin_ok(p_student_id uuid, p_pin_hash text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare
  s regclass; v bigint := 0; n int := 0; t bigint;
  now_s bigint := pg_catalog.floor(extract(epoch from pg_catalog.clock_timestamp()))::bigint;
begin
  if p_student_id is null then return false; end if;
  s := pin_guard.seq_for(p_student_id);
  if s is not null then
    v := coalesce(pg_catalog.pg_sequence_last_value(s), 0);
    n := (v % 8)::int; t := v / 8;
    if now_s - t >= 900 then n := 0; end if;           -- 15 quiet minutes: start counting again
    if n >= 5 then
      raise exception 'Too many wrong PINs — wait a few minutes and try again.' using hint = 'pin_locked';
    end if;
  end if;
  if exists (select 1 from public.students st where st.id = p_student_id and st.pin_hash = p_pin_hash) then
    if s is not null and v <> 0 then perform pg_catalog.setval(s, 0, true); end if;
    return true;
  end if;
  if s is not null then perform pg_catalog.setval(s, now_s * 8 + least(n + 1, 7), true); end if;
  return false;
end $$;
revoke all on function public._pin_ok(uuid, text) from public, anon, authenticated;

-- Every student (now and future) gets a counter.
create or replace function public._pin_guard_new_student() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pin_guard.ensure_seq(new.id);
  return new;
end $$;
revoke all on function public._pin_guard_new_student() from public, anon, authenticated;
drop trigger if exists students_pin_guard_seq on public.students;
create trigger students_pin_guard_seq after insert on public.students
  for each row execute function public._pin_guard_new_student();
do $$ declare r record; begin
  for r in select id from public.students loop perform pin_guard.ensure_seq(r.id); end loop;
end $$;

-- Rewrite the 33 functions that compared students.pin_hash directly: the comparison becomes
-- (select public._pin_ok(p_student_id, p_pin_hash)). STABLE ones become VOLATILE (they now write).
-- Each must still match the backed-up md5 and contain exactly one comparison, or nothing is applied.
do $$
declare r record; d text; n int;
  pat constant text := '\m(s\.|st\.)?pin_hash = p_pin_hash\M';
begin
  for r in select * from (values
    ('_arcade_auth(uuid,text,text)','e3a69ff65f4cc207ca2c7baba4465f36'),
    ('_cl_student_ok(uuid,text,text)','57fd23c5c7841ed62d8440434aba6f44'),
    ('_cw_ok(uuid,text,text)','7d2346db29019ccdaa65e67d6747a329'),
    ('_duel_student(uuid,text)','7cabd3b4468bc4024e124115e1fc19e0'),
    ('_es_student_ok(uuid,text,text)','ecadedf07a07b115aeec7673af7d245d'),
    ('_fx_ok(uuid,text,text)','d88414b006af2b05f91b728b86e0e068'),
    ('_pet_auth(uuid,text,text)','a027d6d6f432811c798d33e12d630200'),
    ('_rc_student_ok(uuid,text,text)','3b161cea0ff046d48e70a0b5d0151858'),
    ('_survey_ok(uuid,text,text)','3b0b02956587548f84a619fa862cd821'),
    ('ask_board(uuid,text,text)','e1a6c950717422587243033f4c738261'),
    ('get_student_by_auth(uuid,text,text)','0bcb7f901ca3740170d553f36fcbb452'),
    ('get_student_days(uuid,text)','31f5916b5fc8f93c6157198e8011f5d8'),
    ('get_student_tasks(uuid,text)','d43e4a7355aa762121d7845a389e6001'),
    ('ask_submit(uuid,text,text,text,text)','8cad2afac61c243f46e86824a89f5896'),
    ('complete_day(uuid,text,date)','9284672fb54a1b04b4064a0125924f57'),
    ('complete_task(uuid,text,text)','b90a3ba0005a01599b4c7f85f5219109'),
    ('get_project_data(uuid,text,text,text)','ac01d6025b3d26f3a72c43cac12540ad'),
    ('get_weight_control_quest_progress(uuid,text,text)','7108b6d283638e13e970d6a5a4396d8f'),
    ('join_live_session(text,text,uuid,text,text)','2b9e061c3c6ae05b6d6cf6c423d0037a'),
    ('mastery_status(uuid,text,text)','ef6ef99d926e48b6295b9bf626243733'),
    ('name_request_cancel(uuid,text,text)','3d7ec93268070b516daf06e710280147'),
    ('name_request_status(uuid,text,text)','1a6f9cca974b8b9409e01cfd22e02ca6'),
    ('name_request(uuid,text,text,text)','09f63016e6200f7023476ac69ecf78ee'),
    ('remove_day(uuid,text,date)','7646a049ed210b86b47bdb80ad5472fc'),
    ('remove_task(uuid,text,text)','f9ed5a2179e6fb7f349612764b659fb6'),
    ('reset_student_progress(uuid,text)','9d9ced3b279b5a2de3ad7a92af67c798'),
    ('save_project_data(uuid,text,text,text,jsonb)','4d2f3d59f3ea5d1bc8552b1636fe6941'),
    ('mastery_answer(uuid,text,text,uuid,integer,text)','91d9d1e623996636735e9491902cee99'),
    ('mastery_start(uuid,text,text,integer)','69170ae0da3c374f77d74ffb836b0b7a'),
    ('save_weight_control_quest_progress(uuid,text,text,jsonb,integer,boolean)','ff5135d0b75d8ce8991c1a4fab703093'),
    ('wcq_learn_food(uuid,text,text,text,text)','7d33c09390339adf5f43ebe12a48eee7'),
    ('wcq_make_dish(uuid,text,text,text,jsonb)','c1d0d03dc13b24d7ebf170bb93ab86ab'),
    ('wcq_suggest_dish(uuid,text,text,text,jsonb,text)','b9151303c61060a0c55cd10c95f7314c')
  ) x(sig, m) loop
    d := pg_get_functiondef(to_regprocedure('public.' || r.sig));
    if d is null then raise exception 'missing %', r.sig; end if;
    if md5(d) <> r.m then raise exception '% changed since backup', r.sig; end if;
    select count(*) into n from regexp_matches(d, pat, 'g');
    if n <> 1 then raise exception '% has % PIN comparisons', r.sig, n; end if;
    d := regexp_replace(d, pat, '(select public._pin_ok(p_student_id, p_pin_hash))');
    d := replace(d, ' STABLE SECURITY DEFINER', ' VOLATILE SECURITY DEFINER');
    execute d;
  end loop;
end $$;

-- Called by the web pages and STABLE before; they now reach _pin_ok, which writes.
do $$ begin
  if md5(pg_get_functiondef('public.exit_survey_status(uuid,text,text)'::regprocedure)) <> 'f621868b78d54497b48fbfa83a42c73c'
  or md5(pg_get_functiondef('public.reading_status(uuid,text,text)'::regprocedure)) <> '26290d58adbf92a013e7eea9c6de9d04'
  then raise exception 'status functions changed since backup'; end if;
end $$;
alter function public.exit_survey_status(uuid, text, text) volatile;
alter function public.reading_status(uuid, text, text) volatile;

-- Sign-in: same columns and side effect as before. Locked -> no rows (page shows the lock message).
create or replace function public.verify_student_pin(p_student_id uuid, p_pin_hash text, p_trimester text)
 returns table(id uuid, display_name text, avatar text, class_code text)
 language plpgsql security definer set search_path to 'public' as $function$
begin
  if pin_guard.locked_until(p_student_id) is not null then return; end if;
  if not public._pin_ok(p_student_id, p_pin_hash) then return; end if;
  return query
    select s.id, s.display_name, s.avatar, s.class_code from students s
    where s.id = p_student_id and s.trimester = p_trimester;
  if found then
    insert into active_days (student_id, day_date)
    values (p_student_id, (now() at time zone 'America/Denver')::date)
    on conflict (student_id, day_date) do nothing;
  end if;
end $function$;

create or replace function public.student_remember_perm(p_student_id uuid, p_pin_hash text)
 returns boolean language plpgsql volatile security definer set search_path to 'public' as $function$
begin
  if pin_guard.locked_until(p_student_id) is not null then return false; end if;
  return public._pin_ok(p_student_id, p_pin_hash)
     and exists (select 1 from public.students s where s.id = p_student_id and s.permanent);
end $function$;

create or replace function public.pin_lock_status(p_student_id uuid default null, p_last_name text default null, p_trimester text default null)
 returns jsonb language sql stable security definer set search_path to 'public' as $function$
  with u as (
    select pin_guard.locked_until(p_student_id) as until where p_student_id is not null
    union all
    select (select f.at from public.auth_fail f
             where f.key = 'vis:' || lower(btrim(p_last_name)) || ':' || coalesce(p_trimester, '')
               and f.at > now() - interval '15 minutes'
             order by f.at desc offset 4 limit 1) + interval '15 minutes'
     where coalesce(btrim(p_last_name), '') <> '' and p_trimester is not null
  )
  select jsonb_build_object('locked', max(until) is not null,
                            'minutes', case when max(until) is null then 0
                                            else greatest(1, ceil(extract(epoch from (max(until) - now())) / 60))::int end)
  from u;
$function$;

create or replace function public.teacher_clear_lockout(p_teacher_pass text, p_student_id uuid)
 returns boolean language plpgsql security definer set search_path to 'public' as $function$
declare s record;
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'Wrong teacher passphrase'; end if;
  perform pin_guard.reset(p_student_id);
  delete from public.auth_fail where key = 'stu:' || p_student_id::text;
  select st.last_name, st.trimester into s from public.students st where st.id = p_student_id;
  if found then
    delete from public.auth_fail where key = 'vis:' || lower(btrim(coalesce(s.last_name, ''))) || ':' || coalesce(s.trimester, '');
  end if;
  return true;
end $function$;

create or replace function public.pin_reset_set(p_teacher_pass text, p_student_id uuid, p_pin_hash text)
 returns boolean language plpgsql security definer set search_path to 'public' as $function$
declare t text; ok boolean;
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'Wrong teacher passphrase'; end if;
  if coalesce(p_pin_hash, '') !~ '^[0-9a-f]{64}$' then raise exception 'Bad PIN hash'; end if;
  select trimester into t from public.site_term where id = 1;
  update public.students set pin_hash = p_pin_hash where id = p_student_id and trimester = t;
  ok := found;
  if ok then
    perform public._rl_clear('stu:' || p_student_id::text);
    perform pin_guard.reset(p_student_id);
  end if;
  return ok;
end $function$;
