-- ============================================================
-- Arcade Levels + Class Wars. Safe to re-run. Run AFTER arcade_boards.sql.
--
--   Arcade Power (per student, per trimester, across every boarded game):
--     every medal tier earned = 10 power   (bronze 10, silver 20, gold 30, legend 40 per game)
--     every game won once     =  5 power
--   Arcade Level = floor(sqrt(power / 5)) + 1     → reach level L+1 at 5·L² power
--     Titles: 1-2 Rookie · 3-4 Squire · 5-7 Knight · 8-10 Hero · 11-13 Champion · 14+ Legend
--
--   Class Wars: periods ranked by AVERAGE power per enrolled student (fair to small classes,
--   and every student who plays helps their period). Classes with fewer than 5 students,
--   test codes and visitors are left out.
-- ============================================================

-- Vocab Slice was posting scores but its board row was never added.
insert into public.arcade_games (key, title, max_score, medals) values
  ('vocab_slice', 'Vocab Slice', 100000, '{500,1200,2200,3500}')
on conflict (key) do update set title = excluded.title, max_score = excluded.max_score, medals = excluded.medals;

-- ---------- helpers ----------
create or replace function public._arcade_power(p_student_id uuid, p_trimester text)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(10 * public._medal(a.best, g.medals) + 5 * least(a.wins, 1)), 0)::int
  from public.arcade_scores a join public.arcade_games g on g.key = a.game
  where a.student_id = p_student_id and a.trimester = p_trimester;
$$;

create or replace function public._arcade_level(p_power int)
returns int language sql immutable as $$ select floor(sqrt(greatest(coalesce(p_power, 0), 0) / 5.0))::int + 1; $$;

create or replace function public._arcade_title(p_level int)
returns text language sql immutable as $$
  select case when p_level >= 14 then 'Legend' when p_level >= 11 then 'Champion' when p_level >= 8 then 'Hero'
              when p_level >= 5 then 'Knight' when p_level >= 3 then 'Squire' else 'Rookie' end;
$$;

-- power needed to reach the next level
create or replace function public._arcade_next(p_level int)
returns int language sql immutable as $$ select 5 * p_level * p_level; $$;

revoke all on function public._arcade_power(uuid, text) from public, anon, authenticated;

-- ---------- submit: same as before, plus level info and a level-up flag ----------
create or replace function public.arcade_submit(p_student_id uuid, p_pin_hash text, p_trimester text,
                                                p_game text, p_score int, p_won boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g public.arcade_games; r public.arcade_scores; first_win boolean := false; rank_all int; rank_group int; me public.students;
        pow_before int; pow_after int; lvl int;
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
  pow_before := public._arcade_power(p_student_id, p_trimester);
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
  pow_after := public._arcade_power(p_student_id, p_trimester);
  lvl := public._arcade_level(pow_after);

  select count(*) + 1 into rank_all from public.arcade_scores a join public.students s on s.id = a.student_id
   where a.trimester = p_trimester and a.game = p_game and a.best > r.best
     and public._is_visitor(s.class_code) = public._is_visitor(me.class_code) and s.class_code !~* 'test';
  select count(*) + 1 into rank_group from public.arcade_scores a join public.students s on s.id = a.student_id
   where a.trimester = p_trimester and a.game = p_game and a.best > r.best and s.class_code = me.class_code;
  return jsonb_build_object('best', r.best, 'wins', r.wins, 'plays', r.plays, 'xp', case when first_win then 10 else 0 end,
                            'rank', rank_all, 'rank_group', rank_group, 'group', public._arcade_group(me.class_code),
                            'visitor', public._is_visitor(me.class_code),
                            'power', pow_after, 'power_gain', pow_after - pow_before, 'level', lvl,
                            'title', public._arcade_title(lvl), 'next_at', public._arcade_next(lvl),
                            'level_up', lvl > public._arcade_level(pow_before));
end $$;

-- ---------- champions: ranked by Arcade Power, with level + title ----------
create or replace function public.arcade_champions(p_trimester text, p_group text default 'all', p_limit int default 10)
returns jsonb language plpgsql security definer set search_path = public as $$
declare out jsonb;
begin
  perform public._visitor_cleanup();
  with per as (
    select s.id, public._arcade_name(s, max(p.name)) as name, public._arcade_group(s.class_code) as grp,
           sum(public._medal(a.best, g.medals))::int as medals, sum(least(a.wins, 1))::int as games_won,
           count(*)::int as games, sum(a.plays)::int as plays,
           sum(10 * public._medal(a.best, g.medals) + 5 * least(a.wins, 1))::int as power
    from public.arcade_scores a
    join public.arcade_games g on g.key = a.game
    join public.students s on s.id = a.student_id
    left join public.student_pets p on p.student_id = s.id
    where a.trimester = p_trimester and s.class_code !~* 'test'
      and case when p_group = 'visitors' then public._is_visitor(s.class_code)
               when p_group = 'all' then not public._is_visitor(s.class_code)
               else s.class_code = p_group end
    group by s.id
  ), ranked as (
    select per.*, row_number() over (order by power desc, games_won desc, plays desc) as rk from per
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'rank', rk, 'name', name, 'group', grp, 'medals', medals, 'games_won', games_won, 'games', games,
           'power', power, 'level', public._arcade_level(power), 'title', public._arcade_title(public._arcade_level(power)))
         order by rk), '[]'::jsonb) into out
  from ranked where rk <= greatest(1, least(p_limit, 50));
  return out;
end $$;

-- ---------- class wars ----------
create or replace function public.arcade_class_wars(p_trimester text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare out jsonb;
begin
  with roster as (
    select s.id, s.class_code from public.students s
    where s.trimester = p_trimester and s.class_code !~* 'test' and not public._is_visitor(s.class_code)
  ), pw as (
    select r.class_code, r.id,
           coalesce(sum(10 * public._medal(a.best, g.medals) + 5 * least(a.wins, 1)), 0)::int as power,
           coalesce(sum(public._medal(a.best, g.medals)), 0)::int as medals,
           count(a.game)::int as games
    from roster r
    left join public.arcade_scores a on a.student_id = r.id and a.trimester = p_trimester
    left join public.arcade_games g on g.key = a.game
    group by r.class_code, r.id
  ), cls as (
    select class_code, count(*)::int as students, count(*) filter (where games > 0)::int as players,
           sum(power)::int as power, sum(medals)::int as medals,
           round(sum(power)::numeric / count(*), 1) as avg_power,
           max(power)::int as top_power
    from pw group by class_code having count(*) >= 5
  ), ranked as (
    select cls.*, row_number() over (order by avg_power desc, power desc) as rk from cls
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'rank', rk, 'class_code', class_code, 'group', public._arcade_group(class_code),
           'students', students, 'players', players, 'power', power, 'medals', medals,
           'avg_power', avg_power, 'avg_level', public._arcade_level(round(avg_power)::int),
           'top_level', public._arcade_level(top_power))
         order by rk), '[]'::jsonb) into out
  from ranked;
  return out;
end $$;

-- ---------- my records: add power + level ----------
create or replace function public.arcade_mine(p_student_id uuid, p_pin_hash text, p_trimester text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me public.students; pow int; lvl int;
begin
  if not public._arcade_auth(p_student_id, p_pin_hash, p_trimester) then return null; end if;
  select * into me from public.students where id = p_student_id;
  update public.students set last_seen = now() where id = p_student_id;
  pow := public._arcade_power(p_student_id, p_trimester);
  lvl := public._arcade_level(pow);
  return jsonb_build_object(
    'name', btrim(me.display_name), 'group', public._arcade_group(me.class_code), 'class_code', me.class_code,
    'visitor', public._is_visitor(me.class_code),
    'power', pow, 'level', lvl, 'title', public._arcade_title(lvl),
    'level_at', public._arcade_next(lvl - 1), 'next_at', public._arcade_next(lvl),
    'scores', coalesce((select jsonb_object_agg(a.game, jsonb_build_object('best', a.best, 'wins', a.wins, 'plays', a.plays))
                        from public.arcade_scores a where a.student_id = p_student_id and a.trimester = p_trimester), '{}'::jsonb));
end $$;

grant execute on function public.arcade_submit(uuid, text, text, text, int, boolean) to anon, authenticated;
grant execute on function public.arcade_champions(text, text, int) to anon, authenticated;
grant execute on function public.arcade_class_wars(text) to anon, authenticated;
grant execute on function public.arcade_mine(uuid, text, text) to anon, authenticated;
