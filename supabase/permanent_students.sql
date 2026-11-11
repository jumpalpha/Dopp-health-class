-- ============================================================
-- Permanent student accounts — 2026-11-10
-- Accounts with students.permanent = true never expire:
--   * "Start New Trimester" carries them into the new trimester as
--     regular TEST-class students (not visitors), with their
--     progress, sprite and checklist records moved along.
--   * The TEST class code moves to the new trimester too.
--   * On their devices, the saved login never expires (term.js).
-- Marked permanent: Mr. Dopp's own test account (TEST / Alsmypal)
-- and the demo account (Pilot).
-- ============================================================

alter table public.students add column if not exists permanent boolean not null default false;

update public.students set permanent = true
 where class_code = 'TEST' and display_name = 'Alsmypal';   -- Pilot is marked in demo_seed.sql

-- carry permanent students (and their records) into a new trimester
create or replace function public._carry_permanent(p_old text, p_new text)
returns int language plpgsql security definer set search_path to 'public' as $$
declare t record; n int;
begin
  perform set_config('app.demo_admin', 'on', true);       -- the demo account's rows are normally locked
  update public.class_codes set trimester = p_new, active = true where code = 'TEST';
  for t in
    select c.table_name from information_schema.columns c
      join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
     where c.table_schema = 'public' and tb.table_type = 'BASE TABLE' and c.column_name = 'student_id'
       and exists (select 1 from information_schema.columns c2 where c2.table_schema = 'public'
                     and c2.table_name = c.table_name and c2.column_name = 'trimester')
  loop
    execute format('update public.%I x set trimester = $1 where x.trimester = $2
                      and x.student_id in (select s.id from public.students s where s.permanent and s.trimester = $2)',
                   t.table_name) using p_new, p_old;
  end loop;
  update public.students set trimester = p_new, class_code = 'TEST'
   where permanent and trimester = p_old;
  get diagnostics n = row_count;
  perform set_config('app.demo_admin', 'off', true);
  return n;
end $$;
revoke all on function public._carry_permanent(text, text) from public, anon, authenticated;

create or replace function public.start_new_trimester(p_teacher_pass text, p_new text, p_label text, p_code_prefix text, p_periods integer default 6)
 returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  t public.site_term;
  v_new text := upper(btrim(coalesce(p_new, '')));
  v_prefix text := upper(btrim(coalesce(p_code_prefix, '')));
  v_label text := left(btrim(coalesce(p_label, '')), 60);
  v_heroes jsonb; v_arcade jsonb; v_sprites jsonb; v_counts jsonb;
  n_students int; n_visitors int; n_sprites int; i int; oc record;
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'Teacher passphrase required'; end if;
  select * into t from public.site_term where id = 1 for update;
  v_new := regexp_replace(v_new, '^(\d{4})-T', '\1-T');
  if v_new !~ '^\d{4}-T[1-3]$' then raise exception 'Trimester must look like 2026-T2'; end if;
  if v_prefix !~ '^[0-9A-Z]{4,10}$' then raise exception 'Class code start must be 4-10 letters/numbers, like 2627T2'; end if;
  if v_new = t.trimester then raise exception 'That is already the current trimester'; end if;
  if exists (select 1 from public.term_archive a where a.trimester = v_new) then raise exception 'That trimester already happened'; end if;
  if exists (select 1 from public.class_codes c where c.code like v_prefix || 'P%' and c.trimester <> v_new) then
    raise exception 'Class codes starting with % are already used', v_prefix;
  end if;
  if v_label = '' then v_label := v_new; end if;
  p_periods := least(greatest(coalesce(p_periods, 6), 1), 9);

  -- 1) freeze the old trimester
  select coalesce(jsonb_agg(h order by (h->>'verified_xp')::int desc, (h->>'tasks')::int desc), '[]'::jsonb) into v_heroes
  from (
    select jsonb_build_object(
             'name', coalesce(nullif(btrim(l.display_name), ''), 'Student'),
             'avatar', l.avatar,
             'period', public._arcade_group(l.class_code),
             'tasks', coalesce(l.task_count, 0),
             'days', coalesce(array_length(l.day_dates, 1), 0),
             'verified_xp', coalesce(v.verified_xp, 0),
             'mastery_passed', coalesce(v.mastery_passed, 0)) h
    from public.get_leaderboard_data(t.trimester) l
    left join public.get_verified_xp(t.trimester) v on v.student_id = l.id
    where not public._is_visitor(l.class_code)
      and not exists (select 1 from public.students s where s.id = l.id and s.permanent)
  ) z;

  select jsonb_build_object(
           'champions', public.arcade_champions(t.trimester, 'all', 25),
           'games', coalesce((select jsonb_object_agg(g.key, public.arcade_board(t.trimester, g.key, 'all', 10))
                              from public.arcade_games g
                              where exists (select 1 from public.arcade_scores a where a.game = g.key and a.trimester = t.trimester)),
                             '{}'::jsonb))
    into v_arcade;

  perform public._pet_tick(p.student_id) from public.student_pets p where p.trimester = t.trimester and p.alive;
  select coalesce(jsonb_agg(public._pet_view(p, false)
           || jsonb_build_object('owner', coalesce(nullif(btrim(s.display_name), ''), 'Student'),
                                 'period', public._arcade_group(s.class_code),
                                 'best_streak', p.best_streak, 'care_points', p.care_points,
                                 'days', greatest(1, (now()::date - p.born_at::date) + 1))
         order by p.alive desc, p.care_points desc, p.best_streak desc), '[]'::jsonb)
    into v_sprites
  from public.student_pets p join public.students s on s.id = p.student_id
  where p.trimester = t.trimester and not public._is_visitor(s.class_code) and not s.permanent;

  select count(*) filter (where not public._is_visitor(class_code)), count(*) filter (where public._is_visitor(class_code))
    into n_students, n_visitors from public.students where trimester = t.trimester and not permanent;
  select count(*) into n_sprites from public.student_pets p
   where p.trimester = t.trimester and not exists (select 1 from public.students s where s.id = p.student_id and s.permanent);
  v_counts := jsonb_build_object('students', n_students, 'visitors', n_visitors, 'sprites', n_sprites);

  insert into public.term_archive (trimester, label, code_prefix, started_at, counts, heroes, arcade, sprites)
  values (t.trimester, t.label, t.code_prefix, t.started_at, v_counts, v_heroes, v_arcade, v_sprites);

  -- 1b) permanent accounts (teacher test + demo) move into the new trimester untouched
  perform public._carry_permanent(t.trimester, v_new);

  -- 2) graduate every sprite (they live on in the hall); visitors may hatch a new one
  delete from public.student_pets where trimester = t.trimester;

  -- 3) new class codes; old ones close
  update public.class_codes set active = false where trimester = t.trimester;
  for i in 1..p_periods loop
    insert into public.class_codes (code, label, trimester, active)
    values (v_prefix || 'P' || i, 'Period ' || i, v_new, true)
    on conflict (code) do update set active = true, trimester = excluded.trimester, label = excluded.label;
  end loop;
  insert into public.class_codes (code, label, trimester, active) values ('VISITOR-' || v_new, 'Visitors', v_new, true)
  on conflict (code) do update set active = true, trimester = excluded.trimester;

  -- 4) everyone else from the old trimester becomes a visitor (same last name + PIN).
  for oc in select distinct s.class_code from public.students s
            where s.trimester = t.trimester and not public._is_visitor(s.class_code) loop
    insert into public.class_codes (code, label, trimester, active)
    values ('VISITOR-' || v_new || '-' || oc.class_code, 'Past students (' || t.trimester || ' ' || public._arcade_group(oc.class_code) || ')', v_new, true)
    on conflict (code) do nothing;
    update public.students s set class_code = 'VISITOR-' || v_new || '-' || oc.class_code, trimester = v_new, last_seen = now()
    where s.trimester = t.trimester and s.class_code = oc.class_code;
  end loop;
  update public.students s set class_code = 'VISITOR-' || v_new, trimester = v_new
  where s.trimester = t.trimester and public._is_visitor(s.class_code);

  -- 5) flip the switch
  update public.site_term set trimester = v_new, label = v_label, code_prefix = v_prefix, started_at = now() where id = 1;

  return jsonb_build_object('ok', true, 'from', t.trimester, 'to', v_new, 'label', v_label, 'counts', v_counts,
                            'codes', (select jsonb_agg(c.code order by c.code) from public.class_codes c
                                      where c.trimester = v_new and c.code like v_prefix || 'P%'));
end $function$;
