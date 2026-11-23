-- pin_guard_2026_11_23_backup.sql — exact copies (pg_get_functiondef, md5-checked) of every function
-- changed by the 2026-11-23 PIN brute-force protection (migration pin_guard_2026_11_23).
-- ROLLBACK: run this whole file in the Supabase SQL editor, then run the DROP lines at the bottom.
-- Restoring these definitions also restores their original STABLE/VOLATILE settings.

-- _arcade_auth(uuid,text,text)  md5 e3a69ff65f4cc207ca2c7baba4465f36
CREATE OR REPLACE FUNCTION public._arcade_auth(p_student_id uuid, p_pin_hash text, p_trimester text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.students s
                 where s.id = p_student_id and s.pin_hash = p_pin_hash and s.trimester = p_trimester);
$function$;

-- _cl_student_ok(uuid,text,text)  md5 57fd23c5c7841ed62d8440434aba6f44
CREATE OR REPLACE FUNCTION public._cl_student_ok(p_student_id uuid, p_pin_hash text, p_trimester text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.students s
                 where s.id = p_student_id and s.pin_hash = p_pin_hash and s.trimester = p_trimester
                   and (public._cl_released(p_trimester) or s.class_code ilike 'TEST%'));
$function$;

-- _cw_ok(uuid,text,text)  md5 7d2346db29019ccdaa65e67d6747a329
CREATE OR REPLACE FUNCTION public._cw_ok(p_student_id uuid, p_pin_hash text, p_trimester text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.students s
                 where s.id = p_student_id and s.pin_hash = p_pin_hash and s.trimester = p_trimester
                   and ((select live from public.cw_live where id = 1) or s.class_code ilike 'TEST'));
$function$;

-- _duel_student(uuid,text)  md5 7cabd3b4468bc4024e124115e1fc19e0
CREATE OR REPLACE FUNCTION public._duel_student(p_student_id uuid, p_pin_hash text)
 RETURNS students
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.* from public.students s, public.site_term t
  where t.id = 1 and s.id = p_student_id and s.pin_hash = p_pin_hash and s.trimester = t.trimester;
$function$;

-- _es_student_ok(uuid,text,text)  md5 ecadedf07a07b115aeec7673af7d245d
CREATE OR REPLACE FUNCTION public._es_student_ok(p_student_id uuid, p_pin_hash text, p_trimester text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.students s
                  where s.id = p_student_id and s.pin_hash = p_pin_hash
                    and (s.trimester = p_trimester or s.permanent or s.is_demo));
$function$;

-- _fx_ok(uuid,text,text)  md5 d88414b006af2b05f91b728b86e0e068
CREATE OR REPLACE FUNCTION public._fx_ok(p_student_id uuid, p_pin_hash text, p_trimester text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.students s
                 where s.id = p_student_id and s.pin_hash = p_pin_hash and s.trimester = p_trimester
                   and ((select live from public.fx_live where id = 1) or s.class_code ilike 'TEST'));
$function$;

-- _pet_auth(uuid,text,text)  md5 a027d6d6f432811c798d33e12d630200
CREATE OR REPLACE FUNCTION public._pet_auth(p_student_id uuid, p_pin_hash text, p_trimester text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.students s
                 where s.id = p_student_id and s.pin_hash = p_pin_hash and s.trimester = p_trimester);
$function$;

-- _rc_student_ok(uuid,text,text)  md5 3b161cea0ff046d48e70a0b5d0151858
CREATE OR REPLACE FUNCTION public._rc_student_ok(p_student_id uuid, p_pin_hash text, p_trimester text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.students s
                  where s.id = p_student_id and s.pin_hash = p_pin_hash
                    and (s.trimester = p_trimester or s.permanent or s.is_demo));
$function$;

-- _survey_ok(uuid,text,text)  md5 3b0b02956587548f84a619fa862cd821
CREATE OR REPLACE FUNCTION public._survey_ok(p_student_id uuid, p_pin_hash text, p_trimester text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.students s where s.id = p_student_id and s.pin_hash = p_pin_hash and s.trimester = p_trimester);
$function$;

-- ask_board(uuid,text,text)  md5 e1a6c950717422587243033f4c738261
CREATE OR REPLACE FUNCTION public.ask_board(p_student_id uuid, p_pin_hash text, p_trimester text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from public.students s where s.id = p_student_id and s.pin_hash = p_pin_hash and s.trimester = p_trimester)
    then raise exception 'not signed in'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('topic', q.topic, 'body', q.body, 'answer', q.answer, 'answered_on', q.answered_on)
      order by q.answered_on desc nulls last, q.day desc)
    from public.ask_questions q where q.trimester = p_trimester and q.status = 'posted'), '[]'::jsonb);
end $function$;

-- exit_survey_status(uuid,text,text)  md5 f621868b78d54497b48fbfa83a42c73c
CREATE OR REPLACE FUNCTION public.exit_survey_status(p_student_id uuid, p_pin_hash text, p_trimester text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.exit_surveys;
begin
  if not public._es_student_ok(p_student_id, p_pin_hash, p_trimester) then raise exception 'not signed in'; end if;
  select * into r from public.exit_surveys where student_id = p_student_id and trimester = p_trimester;
  return jsonb_build_object('done', r.id is not null, 'submitted_at', r.submitted_at,
                            'answers', coalesce(r.answers, '{}'::jsonb), 'comments', coalesce(r.comments, '{}'::jsonb));
end $function$;

-- get_student_by_auth(uuid,text,text)  md5 0bcb7f901ca3740170d553f36fcbb452
CREATE OR REPLACE FUNCTION public.get_student_by_auth(p_student_id uuid, p_pin_hash text, p_trimester text)
 RETURNS TABLE(id uuid, display_name text, avatar text, class_code text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.id, s.display_name, s.avatar, s.class_code
  from students s
  where s.id = p_student_id
    and s.pin_hash = p_pin_hash
    and s.trimester = p_trimester;
$function$;

-- get_student_days(uuid,text)  md5 31f5916b5fc8f93c6157198e8011f5d8
CREATE OR REPLACE FUNCTION public.get_student_days(p_student_id uuid, p_pin_hash text)
 RETURNS TABLE(day_date date)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select ad.day_date from active_days ad join students s on s.id = ad.student_id
  where ad.student_id = p_student_id and s.pin_hash = p_pin_hash and public._real_day(ad.student_id, ad.day_date);
$function$;

-- get_student_tasks(uuid,text)  md5 d43e4a7355aa762121d7845a389e6001
CREATE OR REPLACE FUNCTION public.get_student_tasks(p_student_id uuid, p_pin_hash text)
 RETURNS TABLE(task_key text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select qp.task_key
  from quest_progress qp
  join students s on s.id = qp.student_id
  where qp.student_id = p_student_id
    and s.pin_hash = p_pin_hash;
$function$;

-- pin_lock_status(uuid,text,text)  md5 81dcb05de18c3177f601d8a19148db9a
CREATE OR REPLACE FUNCTION public.pin_lock_status(p_student_id uuid DEFAULT NULL::uuid, p_last_name text DEFAULT NULL::text, p_trimester text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with k as (
    select 'stu:' || p_student_id::text as key where p_student_id is not null
    union all
    select 'vis:' || lower(btrim(p_last_name)) || ':' || coalesce(p_trimester, '')
     where coalesce(btrim(p_last_name), '') <> '' and p_trimester is not null
  ), u as (
    select (select f.at from public.auth_fail f where f.key = k.key and f.at > now() - interval '15 minutes'
             order by f.at desc offset 4 limit 1) + interval '15 minutes' as until
    from k
  )
  select jsonb_build_object('locked', max(until) is not null,
                            'minutes', case when max(until) is null then 0
                                            else greatest(1, ceil(extract(epoch from (max(until) - now())) / 60))::int end)
  from u;
$function$;

-- pin_reset_set(text,uuid,text)  md5 4e7ec8ffafc81c64aadfbe4e6af56987
CREATE OR REPLACE FUNCTION public.pin_reset_set(p_teacher_pass text, p_student_id uuid, p_pin_hash text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare t text; ok boolean;
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'Wrong teacher passphrase'; end if;
  if coalesce(p_pin_hash, '') !~ '^[0-9a-f]{64}$' then raise exception 'Bad PIN hash'; end if;
  select trimester into t from public.site_term where id = 1;
  update public.students set pin_hash = p_pin_hash where id = p_student_id and trimester = t;
  ok := found;
  if ok then perform public._rl_clear('stu:' || p_student_id::text); end if;
  return ok;
end $function$;

-- reading_status(uuid,text,text)  md5 26290d58adbf92a013e7eea9c6de9d04
CREATE OR REPLACE FUNCTION public.reading_status(p_student_id uuid, p_pin_hash text, p_trimester text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.reading_checks; n int;
begin
  if not public._rc_student_ok(p_student_id, p_pin_hash, p_trimester) then raise exception 'not signed in'; end if;
  select * into r from public.reading_checks
   where student_id = p_student_id and trimester = p_trimester order by taken_at desc limit 1;
  select count(*) into n from public.reading_checks where student_id = p_student_id and trimester = p_trimester;
  return jsonb_build_object(
    'attempts', n,
    'can_take', true,
    'latest', case when r.id is null then null else jsonb_build_object(
      'level', r.level, 'sre_net', r.sre_net, 'taken_at', r.taken_at, 'form', r.details->>'form') end);
end $function$;

-- student_remember_perm(uuid,text)  md5 ccc534dcc16b6020516f76df63fb7c2a
CREATE OR REPLACE FUNCTION public.student_remember_perm(p_student_id uuid, p_pin_hash text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select not public._rl_blocked('stu:' || coalesce(p_student_id::text, ''))
     and exists (select 1 from public.students s where s.id = p_student_id and s.pin_hash = p_pin_hash and s.permanent);
$function$;

-- teacher_clear_lockout(text,uuid)  md5 777faa1d180b0832d43e61ffcb712b1c
CREATE OR REPLACE FUNCTION public.teacher_clear_lockout(p_teacher_pass text, p_student_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s record;
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'Wrong teacher passphrase'; end if;
  delete from public.auth_fail where key = 'stu:' || p_student_id::text;
  select st.last_name, st.trimester into s from public.students st where st.id = p_student_id;
  if found then
    delete from public.auth_fail where key = 'vis:' || lower(btrim(coalesce(s.last_name, ''))) || ':' || coalesce(s.trimester, '');
  end if;
  return true;
end $function$;

-- verify_student_pin(uuid,text,text)  md5 527c08a0839db337adc9dc3fd1afa4ed
CREATE OR REPLACE FUNCTION public.verify_student_pin(p_student_id uuid, p_pin_hash text, p_trimester text)
 RETURNS TABLE(id uuid, display_name text, avatar text, class_code text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare k text := 'stu:' || coalesce(p_student_id::text, '');
begin
  if public._rl_blocked(k) then return; end if;
  return query
    select s.id, s.display_name, s.avatar, s.class_code from students s
    where s.id = p_student_id and s.pin_hash = p_pin_hash and s.trimester = p_trimester;
  if found then
    insert into active_days (student_id, day_date)
    values (p_student_id, (now() at time zone 'America/Denver')::date)
    on conflict (student_id, day_date) do nothing;
    perform public._rl_clear(k);
  elsif exists (select 1 from students s where s.id = p_student_id and s.trimester = p_trimester) then
    perform public._rl_fail(k);
  end if;
end $function$;

-- ask_submit(uuid,text,text,text,text)  md5 8cad2afac61c243f46e86824a89f5896
CREATE OR REPLACE FUNCTION public.ask_submit(p_student_id uuid, p_pin_hash text, p_trimester text, p_topic text, p_body text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d date := (now() at time zone 'America/Boise')::date; used int; v_body text := btrim(coalesce(p_body, ''));
begin
  if not exists (select 1 from public.students s where s.id = p_student_id and s.pin_hash = p_pin_hash and s.trimester = p_trimester)
    then raise exception 'not signed in'; end if;
  if char_length(v_body) < 3 then raise exception 'Please type your question'; end if;
  if char_length(v_body) > 1000 then raise exception 'Please keep it under 1000 characters'; end if;
  select n into used from public.ask_limits where student_id = p_student_id and day = d;
  if coalesce(used, 0) >= 3 then raise exception 'You can ask 3 questions a day. Try again tomorrow!'; end if;
  insert into public.ask_limits (student_id, day, n) values (p_student_id, d, 1)
    on conflict (student_id, day) do update set n = public.ask_limits.n + 1;
  insert into public.ask_questions (trimester, day, topic, body)
    values (p_trimester, d, left(coalesce(nullif(btrim(p_topic), ''), 'Health question'), 60), v_body);
  return jsonb_build_object('ok', true, 'left_today', 2 - coalesce(used, 0));
end $function$;

-- complete_day(uuid,text,date)  md5 9284672fb54a1b04b4064a0125924f57
CREATE OR REPLACE FUNCTION public.complete_day(p_student_id uuid, p_pin_hash text, p_day_date date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (
    select 1 from students s
    where s.id = p_student_id
      and s.pin_hash = p_pin_hash
  ) then
    raise exception 'Unauthorized';
  end if;

  insert into active_days (student_id, day_date)
  values (p_student_id, p_day_date)
  on conflict (student_id, day_date) do nothing;
end;
$function$;

-- complete_task(uuid,text,text)  md5 b90a3ba0005a01599b4c7f85f5219109
CREATE OR REPLACE FUNCTION public.complete_task(p_student_id uuid, p_pin_hash text, p_task_key text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (
    select 1 from students s
    where s.id = p_student_id
      and s.pin_hash = p_pin_hash
  ) then
    raise exception 'Unauthorized';
  end if;

  insert into quest_progress (student_id, task_key)
  values (p_student_id, p_task_key)
  on conflict (student_id, task_key) do nothing;
end;
$function$;

-- get_project_data(uuid,text,text,text)  md5 ac01d6025b3d26f3a72c43cac12540ad
CREATE OR REPLACE FUNCTION public.get_project_data(p_student_id uuid, p_pin_hash text, p_trimester text, p_project_key text)
 RETURNS TABLE(data jsonb, updated_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select d.data, d.updated_at
  from public.student_project_data d
  where d.student_id = p_student_id and d.trimester = p_trimester
    and d.project_key = p_project_key
    and exists (select 1 from public.students s
      where s.id = p_student_id and s.pin_hash = p_pin_hash
        and s.trimester = p_trimester);
$function$;

-- get_weight_control_quest_progress(uuid,text,text)  md5 7108b6d283638e13e970d6a5a4396d8f
CREATE OR REPLACE FUNCTION public.get_weight_control_quest_progress(p_student_id uuid, p_pin_hash text, p_trimester text)
 RETURNS TABLE(student_id uuid, trimester text, draft_data jsonb, stage_completed integer, is_submitted boolean, submitted_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    w.student_id,
    w.trimester,
    w.draft_data,
    w.stage_completed,
    w.is_submitted,
    w.submitted_at,
    w.updated_at
  from public.weight_control_quest_progress w
  where w.student_id = p_student_id
    and w.trimester = p_trimester
    and exists (
      select 1
      from public.students s
      where s.id = p_student_id
        and s.pin_hash = p_pin_hash
        and s.trimester = p_trimester
    );
$function$;

-- join_live_session(text,text,uuid,text,text)  md5 2b9e061c3c6ae05b6d6cf6c423d0037a
CREATE OR REPLACE FUNCTION public.join_live_session(p_join_code text, p_nickname text, p_student_id uuid DEFAULT NULL::uuid, p_pin_hash text DEFAULT NULL::text, p_trimester text DEFAULT NULL::text)
 RETURNS TABLE(session_id uuid, player_id uuid, player_token text, game_type text, team integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  v_s     public.live_sessions;
  v_token text := gen_random_uuid()::text;
  v_hash  text;
  v_pid   uuid;
  v_name  text;
  v_team  int;
  v_n     int;
begin
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  select * into v_s from public.live_sessions s
   where s.join_code = btrim(p_join_code) and s.phase <> 'ended'
   order by s.created_at desc limit 1;
  if not found then raise exception 'No game with that code'; end if;

  if p_student_id is not null then
    select coalesce(nullif(btrim(st.display_name), ''), st.last_name) into v_name
      from public.students st
     where st.id = p_student_id and st.pin_hash = p_pin_hash
       and st.trimester = p_trimester;
    if not found then raise exception 'Login expired - sign in again on the Quest page'; end if;
    v_name := left(coalesce(v_name, 'Student'), 24);

    -- rejoining (refresh / new device): keep same player, new token
    select p.id, p.team into v_pid, v_team from public.live_players p
     where p.session_id = v_s.id and p.student_id = p_student_id;
    if v_pid is not null then
      update public.live_players p set token_hash = v_hash where p.id = v_pid;
      return query select v_s.id, v_pid, v_token, v_s.game_type, v_team;
      return;
    end if;
  else
    if coalesce(v_s.settings->>'require_login', 'false') = 'true' then
      raise exception 'This game needs your Quest login';
    end if;
    v_name := left(btrim(coalesce(p_nickname, '')), 24);
    if v_name = '' then raise exception 'Enter a nickname'; end if;
  end if;

  select count(*) into v_n from public.live_players p where p.session_id = v_s.id;
  if v_n >= 200 then raise exception 'Game is full'; end if;
  if coalesce(v_s.settings->>'teams', '') ~ '^[2-4]$' then
    v_team := (v_n % (v_s.settings->>'teams')::int) + 1;
  end if;

  insert into public.live_players (session_id, student_id, nickname, team, token_hash)
  values (v_s.id, p_student_id, v_name, v_team, v_hash)
  returning id into v_pid;

  return query select v_s.id, v_pid, v_token, v_s.game_type, v_team;
end $function$;

-- mastery_status(uuid,text,text)  md5 ef6ef99d926e48b6295b9bf626243733
CREATE OR REPLACE FUNCTION public.mastery_status(p_student_id uuid, p_pin_hash text, p_trimester text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from public.students s where s.id = p_student_id and s.pin_hash = p_pin_hash and s.trimester = p_trimester) then
    raise exception 'Login expired';
  end if;
  return jsonb_build_object(
    'verified_xp', (select coalesce(sum(e.xp), 0) from public.xp_events e where e.student_id = p_student_id and e.trimester = p_trimester),
    'chapters', (select coalesce(jsonb_object_agg(x.chapter::text, jsonb_build_object(
        'passed', x.passed, 'best', x.best, 'attempts', x.attempts, 'wait_seconds', x.wait_seconds)), '{}'::jsonb)
      from (select c.chapter,
                   coalesce(bool_or(a.passed), false) as passed,
                   coalesce(max(a.correct) filter (where a.finished_at is not null), 0) as best,
                   count(a.id) filter (where a.finished_at is not null) as attempts,
                   greatest(0, coalesce(ceil(extract(epoch from (max(a.finished_at) filter (where a.passed is false) + interval '10 minutes') - now())), 0))::int as wait_seconds
              from (select distinct chapter from public.mastery_bank) c
              left join public.mastery_attempts a on a.chapter = c.chapter and a.student_id = p_student_id
             group by c.chapter) x));
end $function$;

-- name_request_cancel(uuid,text,text)  md5 3d7ec93268070b516daf06e710280147
CREATE OR REPLACE FUNCTION public.name_request_cancel(p_student_id uuid, p_pin_hash text, p_trimester text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from public.students where id = p_student_id and pin_hash = p_pin_hash and trimester = p_trimester) then
    raise exception 'Login expired — sign in again';
  end if;
  delete from public.name_requests where student_id = p_student_id and status = 'pending';
  return jsonb_build_object('ok', true);
end $function$;

-- name_request_status(uuid,text,text)  md5 1a6f9cca974b8b9409e01cfd22e02ca6
CREATE OR REPLACE FUNCTION public.name_request_status(p_student_id uuid, p_pin_hash text, p_trimester text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from public.students where id = p_student_id and pin_hash = p_pin_hash and trimester = p_trimester) then
    raise exception 'Login expired — sign in again';
  end if;
  return (select jsonb_build_object('status', status, 'new_name', new_name, 'at', coalesce(decided_at, created_at))
            from public.name_requests where student_id = p_student_id order by created_at desc limit 1);
end $function$;

-- name_request(uuid,text,text,text)  md5 09f63016e6200f7023476ac69ecf78ee
CREATE OR REPLACE FUNCTION public.name_request(p_student_id uuid, p_pin_hash text, p_trimester text, p_new_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s public.students; n text := btrim(regexp_replace(coalesce(p_new_name, ''), '\s+', ' ', 'g'));
begin
  select * into s from public.students where id = p_student_id and pin_hash = p_pin_hash and trimester = p_trimester;
  if s.id is null then raise exception 'Login expired — sign in again'; end if;
  if char_length(n) < 1 or char_length(n) > 20 then raise exception 'Names can be 1 to 20 characters'; end if;
  if n !~ '^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .''-]*$' then raise exception 'Use letters only (spaces, hyphens and apostrophes are OK)'; end if;
  if n = s.display_name then raise exception 'That is already your name'; end if;
  delete from public.name_requests where student_id = s.id and status = 'pending';
  insert into public.name_requests (student_id, trimester, old_name, new_name) values (s.id, p_trimester, s.display_name, n);
  return jsonb_build_object('ok', true, 'status', 'pending', 'new_name', n);
end $function$;

-- remove_day(uuid,text,date)  md5 7646a049ed210b86b47bdb80ad5472fc
CREATE OR REPLACE FUNCTION public.remove_day(p_student_id uuid, p_pin_hash text, p_day_date date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (
    select 1 from students s
    where s.id = p_student_id
      and s.pin_hash = p_pin_hash
  ) then
    raise exception 'Unauthorized';
  end if;

  delete from active_days
  where student_id = p_student_id
    and day_date = p_day_date;
end;
$function$;

-- remove_task(uuid,text,text)  md5 f9ed5a2179e6fb7f349612764b659fb6
CREATE OR REPLACE FUNCTION public.remove_task(p_student_id uuid, p_pin_hash text, p_task_key text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (
    select 1 from students s
    where s.id = p_student_id
      and s.pin_hash = p_pin_hash
  ) then
    raise exception 'Unauthorized';
  end if;

  delete from quest_progress
  where student_id = p_student_id
    and task_key = p_task_key;
end;
$function$;

-- reset_student_progress(uuid,text)  md5 9d9ced3b279b5a2de3ad7a92af67c798
CREATE OR REPLACE FUNCTION public.reset_student_progress(p_student_id uuid, p_pin_hash text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (
    select 1 from students s
    where s.id = p_student_id
      and s.pin_hash = p_pin_hash
  ) then
    raise exception 'Unauthorized';
  end if;

  delete from quest_progress where student_id = p_student_id;
  delete from active_days where student_id = p_student_id;
end;
$function$;

-- save_project_data(uuid,text,text,text,jsonb)  md5 4d2f3d59f3ea5d1bc8552b1636fe6941
CREATE OR REPLACE FUNCTION public.save_project_data(p_student_id uuid, p_pin_hash text, p_trimester text, p_project_key text, p_data jsonb)
 RETURNS TABLE(updated_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  insert into public.student_project_data
    (student_id, trimester, project_key, data, updated_at)
  select p_student_id, p_trimester, p_project_key,
         coalesce(p_data, '{}'::jsonb), now()
  where exists (select 1 from public.students s
    where s.id = p_student_id and s.pin_hash = p_pin_hash
      and s.trimester = p_trimester)
  on conflict (student_id, trimester, project_key)
  do update set data = excluded.data, updated_at = now()
  returning student_project_data.updated_at;
$function$;

-- mastery_answer(uuid,text,text,uuid,integer,text)  md5 91d9d1e623996636735e9491902cee99
CREATE OR REPLACE FUNCTION public.mastery_answer(p_student_id uuid, p_pin_hash text, p_trimester text, p_attempt_id uuid, p_index integer, p_choice text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a public.mastery_attempts; v_right boolean; v_key text; v_total int; v_pass boolean; v_xp int := 0;
begin
  if not exists (select 1 from public.students s where s.id = p_student_id and s.pin_hash = p_pin_hash and s.trimester = p_trimester) then
    raise exception 'Login expired';
  end if;
  select * into a from public.mastery_attempts m
   where m.id = p_attempt_id and m.student_id = p_student_id for update;
  if not found or a.finished_at is not null then raise exception 'This check is over. Start a new one.'; end if;
  if p_index <> a.current then raise exception 'Out of order'; end if;

  v_key := a.questions->a.current->>'key';
  v_right := (p_choice = v_key);
  v_total := jsonb_array_length(a.questions);
  a.correct := a.correct + case when v_right then 1 else 0 end;
  a.current := a.current + 1;

  if a.current >= v_total then
    v_pass := a.correct >= 8;
    update public.mastery_attempts set current = a.current, correct = a.correct, finished_at = now(), passed = v_pass where id = a.id;
    if v_pass then
      insert into public.xp_events (student_id, trimester, source, ref, xp)
      values (p_student_id, p_trimester, 'mastery', 'mastery:ch' || a.chapter, 50)
      on conflict (student_id, ref) do nothing;
      if found then v_xp := 50; end if;
    end if;
    return jsonb_build_object('correct', v_right, 'answer', v_key, 'done', true,
                              'score', a.correct, 'total', v_total, 'passed', v_pass, 'xp', v_xp);
  end if;

  update public.mastery_attempts set current = a.current, correct = a.correct where id = a.id;
  return jsonb_build_object('correct', v_right, 'answer', v_key, 'done', false, 'score', a.correct,
                            'question', public._mastery_q(a.questions, a.current));
end $function$;

-- mastery_start(uuid,text,text,integer)  md5 69170ae0da3c374f77d74ffb836b0b7a
CREATE OR REPLACE FUNCTION public.mastery_start(p_student_id uuid, p_pin_hash text, p_trimester text, p_chapter integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_last public.mastery_attempts; v_qs jsonb; v_id uuid; v_wait int;
  v_need int; v_have int;
begin
  if not exists (select 1 from public.students s where s.id = p_student_id and s.pin_hash = p_pin_hash and s.trimester = p_trimester) then
    raise exception 'Login expired';
  end if;
  if not exists (select 1 from public.mastery_bank b where b.chapter = p_chapter) then raise exception 'No questions for that chapter'; end if;
  if exists (select 1 from public.mastery_attempts a where a.student_id = p_student_id and a.chapter = p_chapter and a.passed) then
    return jsonb_build_object('already_passed', true);
  end if;

  -- 2026-10-29: must finish the chapter reader first (T1 chapters 1-4 excused)
  if not (p_trimester = '2026-T1' and p_chapter < 5) then
    select coalesce(max((e.meta->>'of')::int), 0), count(distinct e.item)
      into v_need, v_have
      from public.checklist_events e
     where e.student_id = p_student_id and e.trimester = p_trimester
       and e.kind = 'read' and e.chapter = p_chapter;
    if v_have = 0 or v_have < v_need then
      raise exception 'Read Chapter % first! Finish every lesson in the chapter reader, then come back for the Mastery check. Reading is how we learn. So read it!', p_chapter;
    end if;
  end if;

  -- abandoned attempts become fails
  update public.mastery_attempts a set finished_at = now(), passed = false
   where a.student_id = p_student_id and a.finished_at is null;

  select * into v_last from public.mastery_attempts a
   where a.student_id = p_student_id and a.chapter = p_chapter and a.finished_at is not null
   order by a.finished_at desc limit 1;
  if found and v_last.passed is false then
    v_wait := ceil(extract(epoch from (v_last.finished_at + interval '10 minutes') - now()));
    if v_wait > 0 then
      return jsonb_build_object('wait_seconds', v_wait);
    end if;
  end if;

  select jsonb_agg(jsonb_build_object('term', t.term,
           'def', regexp_replace(t.def, '(?i)' || regexp_replace(t.term, '([.*+?^${}()|\[\]\\])', '\\\1', 'g'), '_____', 'g'),
           'opts', t.opts, 'key', t.term))
    into v_qs
  from (
    select b.term, b.def,
           (select jsonb_agg(x.term order by random()) from (
              select b.term union all
              (select o.term from public.mastery_bank o where o.chapter = b.chapter and o.term <> b.term order by random() limit 3)
            ) x) as opts
    from public.mastery_bank b where b.chapter = p_chapter
    order by random() limit 10
  ) t;

  insert into public.mastery_attempts (student_id, trimester, chapter, questions)
  values (p_student_id, p_trimester, p_chapter, v_qs) returning id into v_id;
  return jsonb_build_object('attempt_id', v_id, 'question', public._mastery_q(v_qs, 0));
end $function$;

-- save_weight_control_quest_progress(uuid,text,text,jsonb,integer,boolean)  md5 ff5135d0b75d8ce8991c1a4fab703093
CREATE OR REPLACE FUNCTION public.save_weight_control_quest_progress(p_student_id uuid, p_pin_hash text, p_trimester text, p_draft_data jsonb, p_stage_completed integer, p_is_submitted boolean)
 RETURNS TABLE(student_id uuid, trimester text, draft_data jsonb, stage_completed integer, is_submitted boolean, submitted_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  insert into public.weight_control_quest_progress (
    student_id,
    trimester,
    draft_data,
    stage_completed,
    is_submitted,
    submitted_at,
    updated_at
  )
  select
    p_student_id,
    p_trimester,
    coalesce(p_draft_data, '{}'::jsonb),
    greatest(0, least(coalesce(p_stage_completed, 0), 5)),
    coalesce(p_is_submitted, false),
    case when coalesce(p_is_submitted, false) then now() else null end,
    now()
  where exists (
    select 1
    from public.students s
    where s.id = p_student_id
      and s.pin_hash = p_pin_hash
      and s.trimester = p_trimester
  )
  on conflict (student_id, trimester) do update set
    draft_data = excluded.draft_data,
    stage_completed = excluded.stage_completed,
    is_submitted = excluded.is_submitted,
    submitted_at = case
      when excluded.is_submitted = true
        then coalesce(public.weight_control_quest_progress.submitted_at, now())
      else public.weight_control_quest_progress.submitted_at
    end,
    updated_at = now()
  returning
    weight_control_quest_progress.student_id,
    weight_control_quest_progress.trimester,
    weight_control_quest_progress.draft_data,
    weight_control_quest_progress.stage_completed,
    weight_control_quest_progress.is_submitted,
    weight_control_quest_progress.submitted_at,
    weight_control_quest_progress.updated_at;
$function$;

-- wcq_learn_food(uuid,text,text,text,text)  md5 7d33c09390339adf5f43ebe12a48eee7
CREATE OR REPLACE FUNCTION public.wcq_learn_food(p_student_id uuid, p_pin_hash text, p_trimester text, p_name text, p_category text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_norm text := public._wcq_norm(p_name); v_votes jsonb; v_cat text;
begin
  if not exists (select 1 from public.students s where s.id = p_student_id and s.pin_hash = p_pin_hash and s.trimester = p_trimester)
    then raise exception 'not signed in'; end if;
  if p_category not in ('meat', 'grain', 'fruit', 'veg', 'dairy', 'fat', 'sweet') then raise exception 'bad type'; end if;
  if char_length(v_norm) < 2 or char_length(v_norm) > 40 or not public._wcq_clean(p_name) then return jsonb_build_object('ok', false); end if;
  insert into public.wcq_learned_foods (norm_name, name, votes, category)
    values (v_norm, left(btrim(p_name), 40), jsonb_build_object(p_category, 1), p_category)
    on conflict (norm_name) do update set
      votes = public.wcq_learned_foods.votes || jsonb_build_object(p_category, coalesce((public.wcq_learned_foods.votes ->> p_category)::int, 0) + 1),
      updated_at = now();
  select votes into v_votes from public.wcq_learned_foods where norm_name = v_norm;
  select key into v_cat from jsonb_each_text(v_votes) order by value::int desc, key limit 1;
  update public.wcq_learned_foods set category = v_cat where norm_name = v_norm;
  return jsonb_build_object('ok', true, 'cat', v_cat);
end $function$;

-- wcq_make_dish(uuid,text,text,text,jsonb)  md5 c1d0d03dc13b24d7ebf170bb93ab86ab
CREATE OR REPLACE FUNCTION public.wcq_make_dish(p_student_id uuid, p_pin_hash text, p_trimester text, p_name text, p_ings jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_norm text := public._wcq_norm(p_name); v_n int;
begin
  if not exists (select 1 from public.students s where s.id = p_student_id and s.pin_hash = p_pin_hash and s.trimester = p_trimester)
    then raise exception 'not signed in'; end if;
  if char_length(v_norm) < 3 or char_length(v_norm) > 50 then raise exception 'Give your dish a name (3–50 letters)'; end if;
  if not public._wcq_clean(p_name) then raise exception 'Please pick a different name for your dish'; end if;
  if jsonb_typeof(p_ings) <> 'array' or jsonb_array_length(p_ings) < 1 or jsonb_array_length(p_ings) > 8 then raise exception 'Pick 1 to 8 foods'; end if;
  if (select count(*) from public.wcq_dish_makers where student_id = p_student_id) >= 20 then raise exception 'You have made 20 dishes already!'; end if;
  insert into public.wcq_student_dishes (norm_name, name, ings) values (v_norm, left(btrim(p_name), 50), p_ings)
    on conflict (norm_name) do nothing;
  insert into public.wcq_dish_makers (norm_name, student_id) values (v_norm, p_student_id) on conflict do nothing;
  select count(*) into v_n from public.wcq_dish_makers where norm_name = v_norm;
  return jsonb_build_object('ok', true, 'makers', v_n, 'shared', v_n >= 2);
end $function$;

-- wcq_suggest_dish(uuid,text,text,text,jsonb,text)  md5 b9151303c61060a0c55cd10c95f7314c
CREATE OR REPLACE FUNCTION public.wcq_suggest_dish(p_student_id uuid, p_pin_hash text, p_trimester text, p_name text, p_foods jsonb, p_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d date := (now() at time zone 'America/Boise')::date; used int;
  v_name text := left(btrim(coalesce(p_name, '')), 60);
  v_norm text := lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'));
  v_note text := left(btrim(coalesce(p_note, '')), 300);
  v_foods jsonb := case when jsonb_typeof(p_foods) = 'array' then p_foods else '[]'::jsonb end;
  v_id uuid;
begin
  if not exists (select 1 from public.students s where s.id = p_student_id and s.pin_hash = p_pin_hash and s.trimester = p_trimester)
    then raise exception 'not signed in'; end if;
  if char_length(v_name) < 2 then raise exception 'Type the name of the dish'; end if;
  select n into used from public.wcq_suggest_limits where student_id = p_student_id and day = d;
  if coalesce(used, 0) >= 5 then raise exception 'You can suggest 5 dishes a day. Try again tomorrow!'; end if;
  insert into public.wcq_suggest_limits (student_id, day, n) values (p_student_id, d, 1)
    on conflict (student_id, day) do update set n = public.wcq_suggest_limits.n + 1;
  select id into v_id from public.wcq_recipe_suggestions where norm_name = v_norm and status = 'new' limit 1;
  if v_id is not null then
    update public.wcq_recipe_suggestions set
      n = n + 1, updated_at = now(),
      foods = (select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from (
                 select jsonb_array_elements(foods) x union select jsonb_array_elements(v_foods)) q),
      notes = case when v_note = '' then notes else (notes || to_jsonb(v_note)) end
    where id = v_id;
  else
    insert into public.wcq_recipe_suggestions (trimester, dish_name, norm_name, foods, notes)
      values (p_trimester, v_name, v_norm, v_foods, case when v_note = '' then '[]'::jsonb else jsonb_build_array(v_note) end);
  end if;
  return jsonb_build_object('ok', true);
end $function$;

-- After restoring the functions above, remove the new pieces:
-- drop trigger if exists students_pin_guard_seq on public.students;
-- drop function if exists public._pin_guard_new_student();
-- drop function if exists public._pin_ok(uuid, text);
-- drop schema if exists pin_guard cascade;
