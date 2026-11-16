-- security_2026_11_15_rollback.sql — undo supabase/security_2026_11_15.sql.
-- Restores the exact function bodies that were live before 2026-11-15 (from pg_get_functiondef),
-- puts back the old class_codes policies/grants, and drops the new functions and auth_fail.
-- Run it all at once in the Supabase SQL editor. Revert the page commit too, or teacher-admin.html
-- and the new teacher.html calls will error (they fall back where they can).
-- You can also undo one part only: each block below stands alone, except that the lockout block
-- must run before "drop auth_fail" if you keep student_remember_perm.

-- ── 1. class_codes: old open policies + grants ──
create policy public_insert_class_codes on public.class_codes for insert to anon with check (true);
create policy public_delete_class_codes on public.class_codes for delete to anon using (true);
grant insert, update, delete, truncate, references, trigger on public.class_codes to anon, authenticated;
drop function if exists public.class_code_ok(text, text);
drop function if exists public.teacher_class_codes_list(text, text);
drop function if exists public.teacher_class_code_add(text, text, text, text);
drop function if exists public.teacher_class_code_remove(text, text, text);

-- ── 3. PIN lockout: old verify_student_pin / visitor_login / pin_reset_set ──
CREATE OR REPLACE FUNCTION public.verify_student_pin(p_student_id uuid, p_pin_hash text, p_trimester text)
 RETURNS TABLE(id uuid, display_name text, avatar text, class_code text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return query
    select s.id, s.display_name, s.avatar, s.class_code from students s
    where s.id = p_student_id and s.pin_hash = p_pin_hash and s.trimester = p_trimester;
  if found then
    insert into active_days (student_id, day_date)
    values (p_student_id, (now() at time zone 'America/Denver')::date)
    on conflict (student_id, day_date) do nothing;
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.visitor_login(p_last_name text, p_pin_hash text, p_trimester text)
 RETURNS TABLE(id uuid, display_name text, avatar text, class_code text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.id, s.display_name, s.avatar, s.class_code from public.students s
  where s.trimester = p_trimester and public._is_visitor(s.class_code)
    and lower(btrim(s.last_name)) = lower(btrim(coalesce(p_last_name, '')))
    and s.pin_hash = p_pin_hash
  order by s.last_seen desc nulls last limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.pin_reset_set(p_teacher_pass text, p_student_id uuid, p_pin_hash text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare t text;
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'Wrong teacher passphrase'; end if;
  if coalesce(p_pin_hash, '') !~ '^[0-9a-f]{64}$' then raise exception 'Bad PIN hash'; end if;
  select trimester into t from public.site_term where id = 1;
  update public.students set pin_hash = p_pin_hash where id = p_student_id and trimester = t;
  return found;
end $function$;

drop function if exists public.pin_lock_status(uuid, text, text);
drop function if exists public.teacher_clear_lockout(text, uuid);

-- ── 4. remember-me flag ──
drop function if exists public.student_remember_perm(uuid, text);

-- ── drop the rate-limit core (after the blocks above) ──
drop function if exists public._rl_blocked(text, int, interval);
drop function if exists public._rl_fail(text);
drop function if exists public._rl_clear(text);
drop table if exists public.auth_fail;

-- ── 5. public names: old bodies (full display names) ──
CREATE OR REPLACE FUNCTION public.get_leaderboard_data(p_trimester text)
 RETURNS TABLE(id uuid, display_name text, avatar text, class_code text, task_count bigint, day_dates date[])
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.id, s.display_name, s.avatar, s.class_code,
    count(distinct qp.task_key)::bigint as task_count,
    coalesce(array_agg(distinct ad.day_date order by ad.day_date)
      filter (where ad.day_date is not null and public._real_day(ad.student_id, ad.day_date)), array[]::date[]) as day_dates
  from students s
  left join quest_progress qp on qp.student_id = s.id
  left join active_days ad on ad.student_id = s.id
  where s.trimester = p_trimester and not s.is_demo
  group by s.id, s.display_name, s.avatar, s.class_code
  order by task_count desc, display_name asc;
$function$;

drop function if exists public.get_leaderboard_data_teacher(text, text);

CREATE OR REPLACE FUNCTION public.pet_gallery(p_trimester text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare sid uuid; out jsonb;
begin
  for sid in select p.student_id from public.student_pets p where p.trimester = p_trimester loop
    perform public._pet_tick(sid);
  end loop;
  select coalesce(jsonb_agg(public._pet_view(p, false)
           || jsonb_build_object('owner', coalesce(nullif(btrim(s.display_name), ''), 'Student'), 'sid', s.id)
         order by p.alive desc, p.health desc, p.streak desc, p.care_points desc), '[]'::jsonb)
    into out
  from public.student_pets p join public.students s on s.id = p.student_id
  where p.trimester = p_trimester and not s.is_demo;
  return out;
end $function$;

CREATE OR REPLACE FUNCTION public.pet_fallen(p_trimester text, p_days integer DEFAULT 14)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare sid uuid; out jsonb;
begin
  for sid in select p.student_id from public.student_pets p where p.trimester = p_trimester and p.alive loop
    perform public._pet_tick(sid);
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', d.pet_name, 'color', d.color,
           'owner', coalesce(nullif(btrim(s.display_name), ''), 'Student'),
           'died_at', d.died_at, 'revived', d.revived_at is not null)
         order by d.died_at desc), '[]'::jsonb)
    into out
  from (select * from public.pet_deaths
         where trimester = p_trimester
           and died_at > now() - make_interval(days => least(greatest(coalesce(p_days, 14), 1), 60))
         order by died_at desc limit 30) d
  join public.students s on s.id = d.student_id
  where not s.is_demo;
  return out;
end $function$;

CREATE OR REPLACE FUNCTION public.class_roster(p_class_code text, p_trimester text)
 RETURNS TABLE(id uuid, display_name text, avatar text, initial text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.id, btrim(s.display_name), coalesce(s.avatar, '⚔'), upper(left(btrim(s.last_name), 1))
  from public.students s
  where s.class_code = upper(btrim(p_class_code)) and s.trimester = p_trimester
    and exists (select 1 from public.class_codes c where c.code = s.class_code and c.trimester = p_trimester and c.active)
  order by lower(btrim(s.display_name)), upper(left(btrim(s.last_name), 1));
$function$;

CREATE OR REPLACE FUNCTION public.term_archive_get(p_trimester text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object('id', trimester, 'label', label, 'started_at', started_at, 'ended_at', ended_at,
                            'counts', counts, 'heroes', heroes, 'arcade', arcade, 'sprites', sprites)
  from public.term_archive where trimester = p_trimester;
$function$;

drop function if exists public._mask_names(jsonb, text);
