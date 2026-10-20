-- ============================================================
-- Arcade leaderboards + Visitor accounts. Safe to re-run.
--   * arcade_scores: each signed-in student's best score per Sprite game, per trimester
--   * First quest win in each game = +10 Verified XP (once per game per trimester)
--   * Visitors: open sign-up with class code 'VISITOR-<trimester>'. A visitor account is
--     removed automatically after 90 days without a visit.
-- Same pattern as the rest of the site: RLS on, no policies, website only calls the
-- SECURITY DEFINER functions below.
-- ============================================================

-- ---------- visitors ----------
alter table public.students add column if not exists last_seen timestamptz default now();

insert into public.class_codes (code, label, trimester, active)
select 'VISITOR-2026-T1', 'Visitors', '2026-T1', true
where not exists (select 1 from public.class_codes where code = 'VISITOR-2026-T1');

-- ---------- tables ----------
create table if not exists public.arcade_games (
  key       text primary key,
  title     text not null,
  max_score int  not null,          -- anything above this is rejected as not possible
  medals    int[] not null          -- [bronze, silver, gold, legend] score thresholds
);
alter table public.arcade_games enable row level security;

insert into public.arcade_games (key, title, max_score, medals) values
  ('sprite_flap',    'Sprite Flap',      600,    '{5,15,30,50}'),
  ('sprite_dash',    'Sprite Dash',     100000,  '{300,1000,2000,3500}'),
  ('sprite_run',     'Sprite Run',       40000,  '{300,1000,2000,3500}'),
  ('sprite_sling',   'Sprite Slingshot', 200000, '{5000,12000,22000,32000}'),
  ('germ_invaders',  'Germ Invaders',    90000,  '{800,2500,5000,9000}'),
  ('sprite_maze',    'Sprite Maze',      90000,  '{1000,2500,5000,9000}'),
  ('habit_breaker',  'Habit Breaker',    40000,  '{400,1000,2000,3500}'),
  ('sprite_snake',   'Sprite Snake',     5000,   '{50,150,300,500}'),
  ('snack_stack',    'Snack Stack',      90000,  '{500,1500,4000,8000}'),
  ('field_day',      'Field Day',        5000,   '{1800,3000,3900,4500}'),
  ('habit_showdown', 'Habit Showdown',   9000,   '{1500,3000,4500,5800}'),
  ('sprite_climb',   'Sprite Climb',     60000,  '{3000,6000,10000,15000}'),
  ('sprite_rider',   'Sprite Rider',     30000,  '{2500,5000,8500,12000}'),
  ('word_quest',     'Word Quest',       4000,   '{600,1400,2200,2900}'),
  ('snack_2048',     'Snack 2048',       200000, '{2000,6000,12000,22000}'),
  ('sprite_memory',  'Sprite Memory',    30000,  '{2000,5000,9000,13000}'),
  ('sprite_catch',   'Sprite Catch',     100000, '{400,1000,2200,4000}'),
  ('sprite_slice',   'Sprite Slice',     100000, '{250,800,1600,3000}'),
  ('vocab_slice',    'Vocab Slice',      100000, '{500,1200,2200,3500}'),
  ('sprite_dodge',   'Sprite Dodge',     50000,  '{300,700,1200,2000}'),
  ('sprite_hoops',   'Sprite Hoops',     3000,   '{300,700,1100,1600}'),
  ('cup_pong',       'Cup Pong',         15000,  '{500,1200,2000,3200}'),
  ('germ_sweeper',   'Germ Sweeper',     3000,   '{500,1000,1600,2000}'),
  ('tic_tac_toe',    'Tic-Tac-Toe',      1500,   '{400,700,1000,1200}'),
  ('blast_blocks',   'Blast Blocks',     2000000, '{1000,3000,6000,12000}'),
  ('how_smart',      'How Smart Am I?',  1700,   '{700,900,1100,1400}')
on conflict (key) do update set title = excluded.title, max_score = excluded.max_score, medals = excluded.medals;

create table if not exists public.arcade_scores (
  student_id uuid not null references public.students(id) on delete cascade,
  trimester  text not null,
  game       text not null references public.arcade_games(key),
  best       int  not null default 0,
  wins       int  not null default 0,
  plays      int  not null default 0,
  updated_at timestamptz not null default now(),
  primary key (student_id, trimester, game)
);
alter table public.arcade_scores enable row level security;
create index if not exists arcade_scores_board on public.arcade_scores (trimester, game, best desc);

-- ---------- private helpers ----------
create or replace function public._arcade_auth(p_student_id uuid, p_pin_hash text, p_trimester text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.students s
                 where s.id = p_student_id and s.pin_hash = p_pin_hash and s.trimester = p_trimester);
$$;

create or replace function public._is_visitor(p_code text)
returns boolean language sql immutable as $$ select coalesce(p_code, '') ilike 'VISITOR%'; $$;

-- public label: "Sprite (First L.)"
create or replace function public._arcade_name(s public.students, sprite text)
returns text language sql stable as $$
  select case when nullif(btrim(sprite), '') is not null
              then btrim(sprite) || ' (' || btrim(s.display_name) || ' ' || upper(left(btrim(s.last_name), 1)) || '.)'
              else btrim(s.display_name) || ' ' || upper(left(btrim(s.last_name), 1)) || '.' end;
$$;

create or replace function public._arcade_group(p_code text)
returns text language sql immutable as $$
  select case when public._is_visitor(p_code) then 'Visitor'
              when p_code ~* 'P[0-9]+$' then 'Period ' || substring(p_code from '(?i)P([0-9]+)$')
              else coalesce(p_code, '') end;
$$;

create or replace function public._medal(p_best int, p_medals int[])
returns int language sql immutable as $$
  select coalesce((select count(*)::int from unnest(p_medals) m where p_best >= m), 0);
$$;

-- remove visitor accounts with no visit in 90 days (cascades to their scores, sprite, XP)
create or replace function public._visitor_cleanup()
returns void language sql security definer set search_path = public as $$
  delete from public.students
  where public._is_visitor(class_code) and coalesce(last_seen, created_at, now()) < now() - interval '90 days';
$$;

revoke all on function public._arcade_auth(uuid, text, text) from public, anon, authenticated;
revoke all on function public._visitor_cleanup() from public, anon, authenticated;

-- ---------- website functions ----------

-- Record a finished game. Keeps the best score; first win per game per trimester = +10 XP.
create or replace function public.arcade_submit(p_student_id uuid, p_pin_hash text, p_trimester text,
                                                p_game text, p_score int, p_won boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g public.arcade_games; r public.arcade_scores; first_win boolean := false; rank_all int; rank_group int; me public.students;
begin
  if not public._arcade_auth(p_student_id, p_pin_hash, p_trimester) then raise exception 'not signed in'; end if;
  select * into g from public.arcade_games where key = p_game;
  if g.key is null then raise exception 'unknown game'; end if;
  if p_score is null or p_score < 0 or p_score > g.max_score then raise exception 'score out of range'; end if;
  select * into me from public.students where id = p_student_id;
  update public.students set last_seen = now() where id = p_student_id;

  select * into r from public.arcade_scores where student_id = p_student_id and trimester = p_trimester and game = p_game for update;
  if r.student_id is not null and r.updated_at > now() - interval '3 seconds' then
    raise exception 'too fast';                       -- one result every few seconds per game
  end if;
  if r.student_id is null then
    insert into public.arcade_scores (student_id, trimester, game, best, wins, plays)
    values (p_student_id, p_trimester, p_game, p_score, case when p_won then 1 else 0 end, 1)
    returning * into r;
    first_win := coalesce(p_won, false);
  else
    first_win := coalesce(p_won, false) and r.wins = 0;
    update public.arcade_scores
       set best = greatest(best, p_score), wins = wins + case when p_won then 1 else 0 end,
           plays = plays + 1, updated_at = now()
     where student_id = p_student_id and trimester = p_trimester and game = p_game
    returning * into r;
  end if;
  if first_win then
    insert into public.xp_events (student_id, trimester, source, ref, xp)
    values (p_student_id, p_trimester, 'arcade', 'arcade:' || p_game, 10)
    on conflict (student_id, ref) do nothing;
  end if;

  select count(*) + 1 into rank_all from public.arcade_scores a join public.students s on s.id = a.student_id
   where a.trimester = p_trimester and a.game = p_game and a.best > r.best
     and public._is_visitor(s.class_code) = public._is_visitor(me.class_code) and s.class_code !~* 'test';
  select count(*) + 1 into rank_group from public.arcade_scores a join public.students s on s.id = a.student_id
   where a.trimester = p_trimester and a.game = p_game and a.best > r.best and s.class_code = me.class_code;
  return jsonb_build_object('best', r.best, 'wins', r.wins, 'plays', r.plays, 'xp', case when first_win then 10 else 0 end,
                            'rank', rank_all, 'rank_group', rank_group, 'group', public._arcade_group(me.class_code),
                            'visitor', public._is_visitor(me.class_code));
end $$;

-- Top scores for one game. p_group: 'all' (current classes), 'visitors', or a class code like '2627T1P4'.
create or replace function public.arcade_board(p_trimester text, p_game text, p_group text default 'all', p_limit int default 10)
returns jsonb language plpgsql security definer set search_path = public as $$
declare out jsonb; g public.arcade_games;
begin
  perform public._visitor_cleanup();
  select * into g from public.arcade_games where key = p_game;
  if g.key is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(x order by x->>'rank_sort'), '[]'::jsonb) into out from (
    select jsonb_build_object(
             'rank', row_number() over (order by a.best desc, a.updated_at),
             'rank_sort', lpad((row_number() over (order by a.best desc, a.updated_at))::text, 4, '0'),
             'name', public._arcade_name(s, p.name), 'group', public._arcade_group(s.class_code),
             'best', a.best, 'wins', a.wins, 'medal', public._medal(a.best, g.medals)) as x
    from public.arcade_scores a
    join public.students s on s.id = a.student_id
    left join public.student_pets p on p.student_id = s.id
    where a.trimester = p_trimester and a.game = p_game and a.best > 0
      and s.class_code !~* 'test'
      and case when p_group = 'visitors' then public._is_visitor(s.class_code)
               when p_group = 'all' then not public._is_visitor(s.class_code)
               else s.class_code = p_group end
    order by a.best desc, a.updated_at
    limit greatest(1, least(p_limit, 50))
  ) t;
  return out;
end $$;

-- Overall arcade champions: total medals across all games, then quest wins, then plays.
create or replace function public.arcade_champions(p_trimester text, p_group text default 'all', p_limit int default 10)
returns jsonb language plpgsql security definer set search_path = public as $$
declare out jsonb;
begin
  perform public._visitor_cleanup();
  select coalesce(jsonb_agg(x order by x->>'rank_sort'), '[]'::jsonb) into out from (
    select jsonb_build_object(
             'rank', row_number() over (order by sum(public._medal(a.best, g.medals)) desc, sum(least(a.wins, 1)) desc, sum(a.plays) desc),
             'rank_sort', lpad((row_number() over (order by sum(public._medal(a.best, g.medals)) desc, sum(least(a.wins, 1)) desc, sum(a.plays) desc))::text, 4, '0'),
             'name', public._arcade_name(s, max(p.name)), 'group', public._arcade_group(s.class_code),
             'medals', sum(public._medal(a.best, g.medals)), 'games_won', sum(least(a.wins, 1)), 'games', count(*)) as x
    from public.arcade_scores a
    join public.arcade_games g on g.key = a.game
    join public.students s on s.id = a.student_id
    left join public.student_pets p on p.student_id = s.id
    where a.trimester = p_trimester and s.class_code !~* 'test'
      and case when p_group = 'visitors' then public._is_visitor(s.class_code)
               when p_group = 'all' then not public._is_visitor(s.class_code)
               else s.class_code = p_group end
    group by s.id
    order by sum(public._medal(a.best, g.medals)) desc, sum(least(a.wins, 1)) desc, sum(a.plays) desc
    limit greatest(1, least(p_limit, 50))
  ) t;
  return out;
end $$;

-- A signed-in player's own records (so My Stats works on any device).
create or replace function public.arcade_mine(p_student_id uuid, p_pin_hash text, p_trimester text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me public.students;
begin
  if not public._arcade_auth(p_student_id, p_pin_hash, p_trimester) then return null; end if;
  select * into me from public.students where id = p_student_id;
  update public.students set last_seen = now() where id = p_student_id;
  return jsonb_build_object(
    'name', btrim(me.display_name), 'group', public._arcade_group(me.class_code), 'class_code', me.class_code,
    'visitor', public._is_visitor(me.class_code),
    'scores', coalesce((select jsonb_object_agg(a.game, jsonb_build_object('best', a.best, 'wins', a.wins, 'plays', a.plays))
                        from public.arcade_scores a where a.student_id = p_student_id and a.trimester = p_trimester), '{}'::jsonb));
end $$;

-- Visitors call this when they open the Visitor page or play, to keep the account active.
create or replace function public.visitor_touch(p_student_id uuid, p_pin_hash text, p_trimester text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me public.students;
begin
  perform public._visitor_cleanup();
  if not public._arcade_auth(p_student_id, p_pin_hash, p_trimester) then return null; end if;
  update public.students set last_seen = now() where id = p_student_id returning * into me;
  return jsonb_build_object('name', btrim(me.display_name), 'visitor', public._is_visitor(me.class_code),
                            'expires', (now() + interval '90 days')::date);
end $$;

grant execute on function public.arcade_submit(uuid, text, text, text, int, boolean) to anon, authenticated;
grant execute on function public.arcade_board(text, text, text, int) to anon, authenticated;
grant execute on function public.arcade_champions(text, text, int) to anon, authenticated;
grant execute on function public.arcade_mine(uuid, text, text) to anon, authenticated;
grant execute on function public.visitor_touch(uuid, text, text) to anon, authenticated;
