-- ============================================================
-- Trimester switch ("Start new trimester" on the Teacher Dashboard). Safe to re-run.
--   * site_term: the ONE place the current trimester lives. Every page reads it (term.js).
--   * term_archive: a frozen copy of each finished trimester — Hall of Heroes, arcade
--     boards and the Sprite Hall of Fame — so past champions stay visible forever.
--   * start_new_trimester(): teacher passphrase only. Archives the old trimester,
--     graduates every sprite into the hall, opens new class codes, and turns every
--     old student into a visitor (same last name + PIN, signs in on visitor.html).
-- Same pattern as the rest of the site: RLS on, no policies, website only calls the
-- SECURITY DEFINER functions below.
-- ============================================================

create table if not exists public.site_term (
  id          int primary key default 1 check (id = 1),
  trimester   text not null,
  label       text not null,
  code_prefix text not null,
  started_at  timestamptz not null default now()
);
alter table public.site_term enable row level security;
insert into public.site_term (id, trimester, label, code_prefix)
values (1, '2026-T1', 'Trimester 1 · 2026–27', '2627T1')
on conflict (id) do nothing;

create table if not exists public.term_archive (
  trimester   text primary key,
  label       text not null,
  code_prefix text,
  started_at  timestamptz,
  ended_at    timestamptz not null default now(),
  counts      jsonb not null default '{}'::jsonb,
  heroes      jsonb not null default '[]'::jsonb,   -- class students, ranked
  arcade      jsonb not null default '{}'::jsonb,   -- {champions:[...], games:{key:[...]}}
  sprites     jsonb not null default '[]'::jsonb    -- graduated sprites
);
alter table public.term_archive enable row level security;

-- ---------- private helpers ----------
create or replace function public._teacher_ok(p_teacher_pass text)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.live_teacher_key k
                 where k.pass_hash = extensions.crypt(coalesce(p_teacher_pass, ''), k.pass_hash));
$$;
revoke all on function public._teacher_ok(text) from public, anon, authenticated;

-- ---------- public ----------
create or replace function public.current_term()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', trimester, 'label', label, 'prefix', code_prefix, 'started_at', started_at)
  from public.site_term where id = 1;
$$;

create or replace function public.past_terms()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', trimester, 'label', label, 'ended_at', ended_at, 'counts', counts)
                            order by ended_at desc), '[]'::jsonb)
  from public.term_archive;
$$;

create or replace function public.term_archive_get(p_trimester text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', trimester, 'label', label, 'started_at', started_at, 'ended_at', ended_at,
                            'counts', counts, 'heroes', heroes, 'arcade', arcade, 'sprites', sprites)
  from public.term_archive where trimester = p_trimester;
$$;

-- Past students sign in here (they are visitors now). Matches last name + PIN among
-- this trimester's visitor accounts, whichever old period they came from.
create or replace function public.visitor_login(p_last_name text, p_pin_hash text, p_trimester text)
returns table(id uuid, display_name text, avatar text, class_code text)
language sql stable security definer set search_path = public as $$
  select s.id, s.display_name, s.avatar, s.class_code from public.students s
  where s.trimester = p_trimester and public._is_visitor(s.class_code)
    and lower(btrim(s.last_name)) = lower(btrim(coalesce(p_last_name, '')))
    and s.pin_hash = p_pin_hash
  order by s.last_seen desc nulls last limit 1;
$$;

-- ---------- teacher ----------
-- What a switch would do right now (shown before the teacher confirms).
create or replace function public.term_preview(p_teacher_pass text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t public.site_term;
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'Teacher passphrase required'; end if;
  select * into t from public.site_term where id = 1;
  return jsonb_build_object(
    'id', t.trimester, 'label', t.label, 'prefix', t.code_prefix, 'started_at', t.started_at,
    'students', (select count(*) from public.students s where s.trimester = t.trimester and not public._is_visitor(s.class_code)),
    'visitors', (select count(*) from public.students s where s.trimester = t.trimester and public._is_visitor(s.class_code)),
    'sprites',  (select count(*) from public.student_pets p where p.trimester = t.trimester),
    'codes',    (select coalesce(jsonb_agg(c.code order by c.code), '[]'::jsonb) from public.class_codes c
                  where c.trimester = t.trimester and c.active and not public._is_visitor(c.code)));
end $$;

create or replace function public.start_new_trimester(p_teacher_pass text, p_new text, p_label text,
                                                      p_code_prefix text, p_periods int default 6)
returns jsonb language plpgsql security definer set search_path = public as $$
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
  where p.trimester = t.trimester and not public._is_visitor(s.class_code);

  select count(*) filter (where not public._is_visitor(class_code)), count(*) filter (where public._is_visitor(class_code))
    into n_students, n_visitors from public.students where trimester = t.trimester;
  select count(*) into n_sprites from public.student_pets where trimester = t.trimester;
  v_counts := jsonb_build_object('students', n_students, 'visitors', n_visitors, 'sprites', n_sprites);

  insert into public.term_archive (trimester, label, code_prefix, started_at, counts, heroes, arcade, sprites)
  values (t.trimester, t.label, t.code_prefix, t.started_at, v_counts, v_heroes, v_arcade, v_sprites);

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

  -- 4) everyone from the old trimester becomes a visitor (same last name + PIN).
  --    Old students keep a per-period visitor code so two students with the same last name never collide.
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
end $$;

revoke all on function public.start_new_trimester(text, text, text, text, int) from public;
revoke all on function public.term_preview(text) from public;
grant execute on function public.current_term() to anon, authenticated;
grant execute on function public.past_terms() to anon, authenticated;
grant execute on function public.term_archive_get(text) to anon, authenticated;
grant execute on function public.visitor_login(text, text, text) to anon, authenticated;
grant execute on function public.term_preview(text) to anon, authenticated;
grant execute on function public.start_new_trimester(text, text, text, text, int) to anon, authenticated;
