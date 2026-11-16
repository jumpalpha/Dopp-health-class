-- security_2026_11_15.sql — security/privacy fixes applied 2026-11-15 (migrations security_2026_11_15_*).
-- Undo: supabase/security_2026_11_15_rollback.sql
--
-- Every change keeps the existing function signatures and return shapes, so pages that are
-- already open or cached keep working. New functions are added beside the old ones.
--
--  1. class_codes: anon/authenticated can no longer insert/update/delete codes. The Class Code
--     Manager (teacher-admin.html) uses teacher_class_code_* RPCs gated by _teacher_ok.
--     Anon SELECT of active codes stays for now (old cached quest.html reads it); quest.html now
--     uses class_code_ok() instead, so the SELECT policy can be dropped after a week.
--  3. Wrong-PIN lockout: 5 wrong PINs for one student in 15 minutes locks that student for 15
--     minutes (verify_student_pin). Visitor sign-in (visitor_login) is limited per last name the
--     same way. Teacher unlock: teacher_clear_lockout(pass, student_id), or a PIN reset.
--  4. student_remember_perm(): lets term.js decide "never expires" from students.permanent.
--  5. Public boards show "First L." instead of a full display name (same rule as _b_pub_name):
--     get_leaderboard_data, pet_gallery, pet_fallen, class_roster, term_archive_get.
--     The teacher dashboard uses get_leaderboard_data_teacher (full names).

-- ───────────────────────────── migration: security_2026_11_15_class_codes ─────────────────────────────
drop policy if exists public_insert_class_codes on public.class_codes;
drop policy if exists public_delete_class_codes on public.class_codes;
revoke insert, update, delete, truncate, references, trigger on public.class_codes from anon, authenticated;

create or replace function public.class_code_ok(p_code text, p_trimester text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.class_codes c
                 where c.code = upper(btrim(coalesce(p_code, ''))) and c.trimester = p_trimester and c.active);
$$;

create or replace function public.teacher_class_codes_list(p_teacher_pass text, p_trimester text)
returns table(code text, label text) language plpgsql stable security definer set search_path = public as $$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'Wrong teacher passphrase'; end if;
  return query select c.code, c.label from public.class_codes c
                where c.trimester = p_trimester and c.active order by c.code;
end $$;

create or replace function public.teacher_class_code_add(p_teacher_pass text, p_code text, p_label text, p_trimester text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_code text := upper(btrim(coalesce(p_code, '')));
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'Wrong teacher passphrase'; end if;
  if v_code !~ '^[A-Z0-9_-]{1,12}$' then raise exception 'Class code: 1 to 12 letters or numbers'; end if;
  if coalesce(btrim(p_trimester), '') = '' then raise exception 'Missing trimester'; end if;
  insert into public.class_codes (code, label, trimester)
  values (v_code, left(coalesce(nullif(btrim(p_label), ''), v_code), 40), btrim(p_trimester));
  return true;
end $$;

create or replace function public.teacher_class_code_remove(p_teacher_pass text, p_code text, p_trimester text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'Wrong teacher passphrase'; end if;
  delete from public.class_codes c where c.code = upper(btrim(coalesce(p_code, ''))) and c.trimester = p_trimester;
  return found;
end $$;

-- ───────────────────────────── migration: security_2026_11_15_pin_lockout ─────────────────────────────
-- A failure only sticks if the function RETURNS normally (a raised exception rolls the row back),
-- so the rate-limited logins return an empty result instead of raising.
create table if not exists public.auth_fail (
  id   bigserial primary key,
  key  text not null,
  at   timestamptz not null default now()
);
create index if not exists auth_fail_key_at on public.auth_fail (key, at desc);
alter table public.auth_fail enable row level security;   -- no policies: no direct access
revoke all on public.auth_fail from anon, authenticated;

create or replace function public._rl_blocked(p_key text, p_max int default 5, p_window interval default '15 minutes')
returns boolean language sql stable security definer set search_path = public as $$
  select count(*) >= p_max from public.auth_fail where key = p_key and at > now() - p_window;
$$;
create or replace function public._rl_fail(p_key text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.auth_fail (key) values (p_key);
  if random() < 0.02 then delete from public.auth_fail where at < now() - interval '1 day'; end if;
end $$;
create or replace function public._rl_clear(p_key text)
returns void language sql security definer set search_path = public as $$
  delete from public.auth_fail where key = p_key;
$$;
revoke all on function public._rl_blocked(text, int, interval) from public, anon, authenticated;
revoke all on function public._rl_fail(text) from public, anon, authenticated;
revoke all on function public._rl_clear(text) from public, anon, authenticated;

-- Same signature, columns and side effect (logs today's active day) as before, plus the lockout.
create or replace function public.verify_student_pin(p_student_id uuid, p_pin_hash text, p_trimester text)
 returns table(id uuid, display_name text, avatar text, class_code text)
 language plpgsql security definer set search_path to 'public' as $function$
declare k text := 'stu:' || coalesce(p_student_id::text, '');
begin
  if public._rl_blocked(k) then return; end if;   -- locked: even the right PIN waits 15 minutes
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

-- Same signature and columns as before (was STABLE sql; now VOLATILE so it can record failures).
create or replace function public.visitor_login(p_last_name text, p_pin_hash text, p_trimester text)
 returns table(id uuid, display_name text, avatar text, class_code text)
 language plpgsql security definer set search_path to 'public' as $function$
declare k text := 'vis:' || lower(btrim(coalesce(p_last_name, ''))) || ':' || coalesce(p_trimester, '');
begin
  if public._rl_blocked(k) then return; end if;
  return query
    select s.id, s.display_name, s.avatar, s.class_code from public.students s
    where s.trimester = p_trimester and public._is_visitor(s.class_code)
      and lower(btrim(s.last_name)) = lower(btrim(coalesce(p_last_name, '')))
      and s.pin_hash = p_pin_hash
    order by s.last_seen desc nulls last limit 1;
  if found then
    perform public._rl_clear(k);
  elsif exists (select 1 from public.students s where s.trimester = p_trimester and public._is_visitor(s.class_code)
                  and lower(btrim(s.last_name)) = lower(btrim(coalesce(p_last_name, '')))) then
    perform public._rl_fail(k);
  end if;
end $function$;

-- For the sign-in pages: is this student (or visitor last name) locked, and for how many minutes?
create or replace function public.pin_lock_status(p_student_id uuid default null, p_last_name text default null, p_trimester text default null)
returns jsonb language sql stable security definer set search_path = public as $$
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
$$;

create or replace function public.teacher_clear_lockout(p_teacher_pass text, p_student_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare s record;
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'Wrong teacher passphrase'; end if;
  delete from public.auth_fail where key = 'stu:' || p_student_id::text;
  select st.last_name, st.trimester into s from public.students st where st.id = p_student_id;
  if found then
    delete from public.auth_fail where key = 'vis:' || lower(btrim(coalesce(s.last_name, ''))) || ':' || coalesce(s.trimester, '');
  end if;
  return true;
end $$;

-- Same as before, and a teacher PIN reset also clears that student's lockout.
create or replace function public.pin_reset_set(p_teacher_pass text, p_student_id uuid, p_pin_hash text)
 returns boolean language plpgsql security definer set search_path to 'public' as $function$
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

-- ───────────────────────────── migration: security_2026_11_15_remember_perm ─────────────────────────────
-- term.js: a remembered login never expires only if the server says the account is permanent.
create or replace function public.student_remember_perm(p_student_id uuid, p_pin_hash text)
returns boolean language sql stable security definer set search_path = public as $$
  select not public._rl_blocked('stu:' || coalesce(p_student_id::text, ''))
     and exists (select 1 from public.students s where s.id = p_student_id and s.pin_hash = p_pin_hash and s.permanent);
$$;

-- ───────────────────────────── migration: security_2026_11_15_public_names ─────────────────────────────
-- Public: "First L." (only changes display names with 2+ words, e.g. "Jo Smith" -> "Jo S.").
create or replace function public.get_leaderboard_data(p_trimester text)
 returns table(id uuid, display_name text, avatar text, class_code text, task_count bigint, day_dates date[])
 language sql security definer set search_path to 'public' as $function$
  select s.id, case when s.display_name is null then null else public._b_pub_name(s.display_name) end as display_name,
    s.avatar, s.class_code,
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

-- Teacher dashboard: same columns, full names.
create or replace function public.get_leaderboard_data_teacher(p_teacher_pass text, p_trimester text)
 returns table(id uuid, display_name text, avatar text, class_code text, task_count bigint, day_dates date[])
 language plpgsql security definer set search_path to 'public' as $function$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'Wrong teacher passphrase'; end if;
  return query
  select s.id, s.display_name, s.avatar, s.class_code,
    count(distinct qp.task_key)::bigint,
    coalesce(array_agg(distinct ad.day_date order by ad.day_date)
      filter (where ad.day_date is not null and public._real_day(ad.student_id, ad.day_date)), array[]::date[])
  from students s
  left join quest_progress qp on qp.student_id = s.id
  left join active_days ad on ad.student_id = s.id
  where s.trimester = p_trimester and not s.is_demo
  group by s.id, s.display_name, s.avatar, s.class_code
  order by 5 desc, 2 asc;
end $function$;

create or replace function public.pet_gallery(p_trimester text)
 returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare sid uuid; out jsonb;
begin
  for sid in select p.student_id from public.student_pets p where p.trimester = p_trimester loop
    perform public._pet_tick(sid);
  end loop;
  select coalesce(jsonb_agg(public._pet_view(p, false)
           || jsonb_build_object('owner', public._b_pub_name(coalesce(nullif(btrim(s.display_name), ''), 'Student')), 'sid', s.id)
         order by p.alive desc, p.health desc, p.streak desc, p.care_points desc), '[]'::jsonb)
    into out
  from public.student_pets p join public.students s on s.id = p.student_id
  where p.trimester = p_trimester and not s.is_demo;
  return out;
end $function$;

create or replace function public.pet_fallen(p_trimester text, p_days integer default 14)
 returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare sid uuid; out jsonb;
begin
  for sid in select p.student_id from public.student_pets p where p.trimester = p_trimester and p.alive loop
    perform public._pet_tick(sid);
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', d.pet_name, 'color', d.color,
           'owner', public._b_pub_name(coalesce(nullif(btrim(s.display_name), ''), 'Student')),
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

create or replace function public.class_roster(p_class_code text, p_trimester text)
 returns table(id uuid, display_name text, avatar text, initial text)
 language sql stable security definer set search_path to 'public' as $function$
  select s.id,
         case when btrim(s.display_name) ~ '\s' then public._b_pub_name(s.display_name) else btrim(s.display_name) end,
         coalesce(s.avatar, '⚔'), upper(left(btrim(s.last_name), 1))
  from public.students s
  where s.class_code = upper(btrim(p_class_code)) and s.trimester = p_trimester
    and exists (select 1 from public.class_codes c where c.code = s.class_code and c.trimester = p_trimester and c.active)
  order by lower(btrim(s.display_name)), upper(left(btrim(s.last_name), 1));
$function$;

-- Past-term archive: mask hero names and sprite owners when read (stored rows are unchanged).
create or replace function public._mask_names(p_arr jsonb, p_field text)
returns jsonb language sql immutable set search_path = public as $$
  select case when p_arr is null or jsonb_typeof(p_arr) <> 'array' then p_arr else
    coalesce((select jsonb_agg(case when jsonb_typeof(e) = 'object' and jsonb_typeof(e -> p_field) = 'string'
                                    then e || jsonb_build_object(p_field, public._b_pub_name(e ->> p_field)) else e end
                               order by n)
              from jsonb_array_elements(p_arr) with ordinality x(e, n)), '[]'::jsonb) end;
$$;
revoke all on function public._mask_names(jsonb, text) from public, anon, authenticated;

create or replace function public.term_archive_get(p_trimester text)
 returns jsonb language sql stable security definer set search_path to 'public' as $function$
  select jsonb_build_object('id', trimester, 'label', label, 'started_at', started_at, 'ended_at', ended_at,
                            'counts', counts, 'heroes', public._mask_names(heroes, 'name'), 'arcade', arcade,
                            'sprites', public._mask_names(sprites, 'owner'))
  from public.term_archive where trimester = p_trimester;
$function$;
