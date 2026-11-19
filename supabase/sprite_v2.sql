-- ============================================================
-- Wellness Sprite v2 (2026-11-18). Safe to re-run. Rollback: sprite_v2_rollback.sql
--
-- 1. HABITS: 12 choices across the dimensions of health. A student can log up to 6 a day
--    (each once), so some always get left out. 3+ habits in a day = a CARE DAY.
-- 2. GROWTH: life stage comes from care days (not calendar age):
--      egg → baby on the first care, child at 8, teen at 18, ADULT at 30 care days.
--    Missed days just don't count. Existing sprites keep their current stage.
-- 3. FADING: when a sprite fades it loses 3 care days of growth, and while faded nothing
--    grows or counts (habits are blocked). −25 Quest XP per fade is applied in get_badge_data
--    (fades from 2026-11-19 on; earlier T1 fades aren't charged).
-- 4. KNOWLEDGE: max 20 a day (10 "snack" answers that also feed the sprite + 10 study).
--    New Care Kit (slot 'kit'): one-time boosts that cost Knowledge, each once a day.
--    Shop unlock requirements lowered ~40% so mid-tier gear is reachable.
-- ============================================================

alter table public.student_pets add column if not exists growth_days int  not null default 0;
alter table public.student_pets add column if not exists growth_date date;

-- one-time: existing sprites start at the care days they've really had, never below their current stage
do $$
begin
  if not exists (select 1 from public.student_pets where growth_days > 0) then
    update public.student_pets p set growth_days = greatest(
      coalesce((select count(*) from public.pet_care_days c
                where c.student_id = p.student_id and c.trimester = p.trimester and c.habits >= 3), 0),
      case
        when p.immortal then 30
        when p.care_points = 0 then 0
        when extract(epoch from now() - p.born_at) / 86400 >= 24 and p.care_points >= 80 then 30
        when extract(epoch from now() - p.born_at) / 86400 >= 10 and p.care_points >= 35 then 18
        when extract(epoch from now() - p.born_at) / 86400 >= 3  and p.care_points >= 10 then 8
        else 1 end)::int;
  end if;
end $$;

-- ---------- shared settings ----------
create or replace function public._pet_habits() returns text[] language sql immutable as $$
  select array['meal','water','sleep','exercise','hygiene','relax','kind','spirit','homework','goal','money','outside']
$$;
create or replace function public._pet_caps() returns jsonb language sql immutable as $$
  select '{"meal":1,"water":1,"sleep":1,"exercise":1,"hygiene":1,"relax":1,"kind":1,"spirit":1,"homework":1,"goal":1,"money":1,"outside":1,"quiz":10,"study":10,"treat":3,"play":3}'::jsonb
$$;
create or replace function public._pet_stage(p_growth int, p_care int, p_immortal boolean) returns text language sql immutable as $$
  select case
    when p_immortal then 'adult'
    when coalesce(p_growth, 0) = 0 and coalesce(p_care, 0) = 0 then 'egg'
    when p_growth >= 30 then 'adult'
    when p_growth >= 18 then 'teen'
    when p_growth >= 8  then 'child'
    else 'baby' end
$$;
revoke execute on function public._pet_habits() from public, anon, authenticated;
revoke execute on function public._pet_caps() from public, anon, authenticated;
revoke execute on function public._pet_stage(int, int, boolean) from public, anon, authenticated;

-- ---------- care log (checklist "care days") counts the new habits ----------
create or replace function public._pet_care_log()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare h int; q int;
begin
  begin
    if new.day_date is null then return new; end if;
    select count(*) into h from unnest(public._pet_habits()) k
     where coalesce((new.day_counts->>k)::int, 0) > 0;
    q := coalesce((new.day_counts->>'quiz')::int, 0);
    if h = 0 and q = 0 then return new; end if;
    insert into public.pet_care_days (student_id, trimester, day, habits, quiz)
    values (new.student_id, new.trimester, new.day_date, h, q)
    on conflict (student_id, trimester, day)
      do update set habits = greatest(pet_care_days.habits, excluded.habits),
                    quiz = greatest(pet_care_days.quiz, excluded.quiz), backfill = false;
  exception when others then null;
  end;
  return new;
end $function$;

-- ---------- tick: same hourly needs; fading now costs 3 growth days ----------
create or replace function public._pet_tick(p_student_id uuid)
 returns student_pets language plpgsql security definer set search_path to 'public'
as $function$
declare
  r public.student_pets;
  h int; steps int; i int;
  avg_need double precision; min_need double precision;
begin
  select * into r from public.student_pets where student_id = p_student_id for update;
  if not found then return null; end if;

  if r.immortal then
    r.food := 100; r.energy := 100; r.mood := 100; r.clean := 100; r.health := 100;
    r.alive := true; r.died_at := null; r.revive_progress := 0;
    r.last_tick := now();
    update public.student_pets set
      food = r.food, energy = r.energy, mood = r.mood, clean = r.clean, health = r.health,
      alive = r.alive, died_at = r.died_at, revive_progress = r.revive_progress, last_tick = r.last_tick
    where student_id = r.student_id;
    return r;
  end if;

  h := floor(extract(epoch from now() - r.last_tick) / 3600)::int;
  if h <= 0 then return r; end if;
  steps := least(h, 400);
  for i in 1..steps loop
    exit when not r.alive;
    r.food   := greatest(0, r.food   - 1.625);
    r.energy := greatest(0, r.energy - 1.375);
    r.mood   := greatest(0, r.mood   - 1.25);
    r.clean  := greatest(0, r.clean  - 1.0);
    avg_need := (r.food + r.energy + r.mood + r.clean) / 4;
    min_need := least(r.food, r.energy, r.mood, r.clean);
    if min_need <= 0 then r.health := r.health - 2.5;
    elsif avg_need < 30 then r.health := r.health - 1.25;
    elsif avg_need > 60 then r.health := least(100, r.health + 0.625);
    end if;
    if r.health <= 0 then
      r.health := 0; r.alive := false;
      r.died_at := r.last_tick + make_interval(hours => i);
      r.growth_days := greatest(0, r.growth_days - 3);          -- v2: fading costs 3 care days of growth
    end if;
  end loop;
  r.last_tick := r.last_tick + make_interval(hours => h);
  if not r.alive and r.died_at is not null
     and not exists (select 1 from public.pet_deaths d
                     where d.student_id = r.student_id and d.died_at = r.died_at) then
    insert into public.pet_deaths (student_id, trimester, pet_name, color, stage, died_at)
    values (r.student_id, r.trimester, r.name, r.color,
            public._pet_stage(r.growth_days + 3, r.care_points, false), r.died_at);
  end if;
  update public.student_pets set
    food = r.food, energy = r.energy, mood = r.mood, clean = r.clean,
    health = r.health, alive = r.alive, died_at = r.died_at, last_tick = r.last_tick,
    growth_days = r.growth_days
  where student_id = r.student_id;
  return r;
end $function$;

-- ---------- view ----------
create or replace function public._pet_view(r student_pets, p_full boolean)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  age_days double precision := extract(epoch from now() - r.born_at) / 86400;
  stage text; form text := null; mood_label text;
  today date := (now() at time zone 'America/Denver')::date;
  counts jsonb := case when r.day_date = today then r.day_counts else '{}'::jsonb end;
  picks int; v jsonb;
begin
  if r.immortal then
    r.food := 100; r.energy := 100; r.mood := 100; r.clean := 100; r.health := 100; r.alive := true;
  end if;
  stage := public._pet_stage(r.growth_days, r.care_points, r.immortal);
  if stage = 'adult' then
    form := case
      when r.immortal then 'radiant'
      when r.junk_total * 3 > r.care_points then 'sugar'
      when r.care_points / greatest(age_days, 1) >= 4 then 'radiant'
      when r.care_points / greatest(age_days, 1) >= 2 then 'steady'
      else 'scruffy' end;
  end if;
  mood_label := case
    when r.immortal then 'happy'
    when not r.alive then 'ghost'
    when r.health < 35 then 'sick'
    when r.food < 25 then 'hungry'
    when r.energy < 25 then 'tired'
    when r.clean < 25 then 'dirty'
    when r.mood < 25 then 'sad'
    when coalesce((counts->>'treat')::int, 0) >= 2 then 'sugar'
    else 'happy' end;
  select count(*) into picks from unnest(public._pet_habits()) k where coalesce((counts->>k)::int, 0) > 0;
  v := jsonb_build_object(
    'name', r.name, 'color', r.color, 'stage', stage, 'form', form,
    'mood_label', mood_label, 'alive', r.alive,
    'health', round(r.health::numeric), 'streak', r.streak,
    'age_days', floor(age_days)::int, 'growth_days', r.growth_days,
    'gear', coalesce(r.equipped, '{}'::jsonb), 'upgrades', coalesce(cardinality(r.owned), 0));
  if r.immortal then v := v || jsonb_build_object('title', 'Ancient of Days', 'immortal', true); end if;
  if p_full then
    v := v || jsonb_build_object(
      'food', round(r.food::numeric), 'energy', round(r.energy::numeric),
      'mood', round(r.mood::numeric), 'clean', round(r.clean::numeric),
      'best_streak', r.best_streak, 'care_points', r.care_points,
      'deaths', r.deaths, 'revive_progress', r.revive_progress, 'revive_needed', 10,
      'today', counts, 'caps', public._pet_caps(), 'habits', to_jsonb(public._pet_habits()),
      'picks_used', picks, 'picks_max', 6, 'care_day_min', 3,
      'cared_today', r.growth_date = today,
      'growth_goal', 30, 'stage_days', '{"baby":1,"child":8,"teen":18,"adult":30}'::jsonb,
      'knowledge', r.knowledge, 'knowledge_total', r.knowledge_total, 'owned', to_jsonb(r.owned),
      'version', 2);
  end if;
  return v;
end $function$;

-- ---------- actions ----------
create or replace function public.pet_action(p_student_id uuid, p_pin_hash text, p_trimester text, p_action text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  r public.student_pets;
  caps jsonb := public._pet_caps();
  habits text[] := public._pet_habits();
  today date := (now() at time zone 'America/Denver')::date;
  used int; habit_kinds int; msg text;
begin
  if not public._pet_auth(p_student_id, p_pin_hash, p_trimester) then
    raise exception 'Login expired';
  end if;
  if not (caps ? p_action) then raise exception 'Unknown action'; end if;
  r := public._pet_tick(p_student_id);
  if r.student_id is null then raise exception 'Hatch a sprite first'; end if;

  if r.day_date is distinct from today then r.day_counts := '{}'::jsonb; r.day_date := today; end if;
  used := coalesce((r.day_counts->>p_action)::int, 0);
  if used >= (caps->>p_action)::int and r.alive then
    raise exception 'Daily limit reached for that one. Come back tomorrow!';
  end if;
  if not r.alive and p_action <> 'quiz' then
    raise exception 'Your sprite needs reviving first. Answer chapter questions!';
  end if;
  -- v2: only 6 different habits a day; you can't do everything every day
  if p_action = any(habits) and r.alive then
    select count(*) into habit_kinds from unnest(habits) k where coalesce((r.day_counts->>k)::int, 0) > 0;
    if habit_kinds >= 6 then
      raise exception 'You''ve picked your 6 habits for today. Come back tomorrow!';
    end if;
  end if;

  if p_action in ('quiz', 'study') then
    r.knowledge := r.knowledge + 1; r.knowledge_total := r.knowledge_total + 1;
  end if;

  if not r.alive then
    r.revive_progress := r.revive_progress + 1;
    if r.revive_progress >= 10 then
      r.alive := true; r.health := 40; r.food := 50; r.energy := 50; r.mood := 50; r.clean := 50;
      r.deaths := r.deaths + 1; r.revive_progress := 0; r.died_at := null;
      update public.pet_deaths set revived_at = now()
       where student_id = r.student_id and revived_at is null;
      msg := 'revived';
    else msg := 'revive_progress'; end if;
  else
    case p_action
      when 'meal'     then r.food := r.food + 40;
      when 'water'    then r.energy := r.energy + 10; r.health := r.health + 4;
      when 'sleep'    then r.energy := r.energy + 45;
      when 'exercise' then r.mood := r.mood + 15; r.energy := r.energy + 5; r.health := r.health + 5; r.clean := r.clean - 10;
      when 'hygiene'  then r.clean := r.clean + 55;
      when 'relax'    then r.mood := r.mood + 30;
      when 'kind'     then r.mood := r.mood + 25; r.health := r.health + 2;
      when 'spirit'   then r.mood := r.mood + 20; r.energy := r.energy + 5; r.health := r.health + 3;
      when 'homework' then r.mood := r.mood + 15; r.energy := r.energy + 10;
      when 'goal'     then r.mood := r.mood + 15; r.energy := r.energy + 10; r.health := r.health + 2;
      when 'money'    then r.mood := r.mood + 15; r.health := r.health + 3;
      when 'outside'  then r.clean := r.clean + 15; r.energy := r.energy + 5; r.mood := r.mood + 10;
      when 'quiz'     then r.food := r.food + 8; r.mood := r.mood + 4;
      when 'study'    then null;
      when 'treat'    then r.mood := r.mood + 12; r.food := r.food + 10; r.health := r.health - 5; r.energy := r.energy - 8;
                           r.junk_total := r.junk_total + 1;
      when 'play'     then r.mood := r.mood + 12; r.energy := r.energy - 6; r.clean := r.clean - 6;
    end case;
    if p_action = any(habits) or p_action = 'quiz' then r.care_points := r.care_points + 1; end if;
    msg := 'ok';
  end if;

  r.food := least(100, greatest(0, r.food)); r.energy := least(100, greatest(0, r.energy));
  r.mood := least(100, greatest(0, r.mood)); r.clean := least(100, greatest(0, r.clean));
  r.health := least(100, greatest(0, r.health));
  if r.alive and r.health <= 0 then r.health := 1; end if;

  r.day_counts := jsonb_set(r.day_counts, array[p_action], to_jsonb(used + 1));

  -- care day: 3 different habits → streak + 1 growth day (once a day, only while alive)
  select count(*) into habit_kinds from unnest(habits) k where coalesce((r.day_counts->>k)::int, 0) > 0;
  if habit_kinds >= 3 and r.alive then
    if r.streak_date is distinct from today then
      r.streak := case when r.immortal or r.streak_date = today - 1 then r.streak + 1 else 1 end;
      r.streak_date := today;
      r.best_streak := greatest(r.best_streak, r.streak);
    end if;
    if r.growth_date is distinct from today then
      r.growth_days := r.growth_days + 1; r.growth_date := today;
      if msg = 'ok' then msg := 'care_day'; end if;
    end if;
  end if;

  update public.student_pets set
    food = r.food, energy = r.energy, mood = r.mood, clean = r.clean, health = r.health,
    alive = r.alive, died_at = r.died_at, deaths = r.deaths, revive_progress = r.revive_progress,
    care_points = r.care_points, junk_total = r.junk_total, streak = r.streak,
    best_streak = r.best_streak, streak_date = r.streak_date, day_date = r.day_date,
    day_counts = r.day_counts, knowledge = r.knowledge, knowledge_total = r.knowledge_total,
    growth_days = r.growth_days, growth_date = r.growth_date,
    updated_at = now()
  where student_id = r.student_id;

  return public._pet_view(r, true) || jsonb_build_object('result', msg);
end $function$;

-- ---------- Care Kit (consumables) + cheaper unlocks ----------
insert into public.pet_items (key, slot, name, cost, unlock, sort) values
  ('k_snack',    'kit', 'Healthy Snack Box', 10, 0, 101),
  ('k_vitamins', 'kit', 'Vitamins',          10, 0, 102),
  ('k_bath',     'kit', 'Bubble Bath',       10, 0, 103),
  ('k_medicine', 'kit', 'Medicine',          20, 0, 104)
on conflict (key) do update set slot = excluded.slot, name = excluded.name, cost = excluded.cost, unlock = excluded.unlock, sort = excluded.sort;
-- lower gear unlocks to ~60% of the original (re-run safe: computed from the backup)
update public.pet_items i set unlock = round(b.unlock * 0.6)::int
  from public.bk_pet_items_20261118 b where b.key = i.key and i.slot <> 'kit';

create or replace function public.pet_shop_buy(p_student_id uuid, p_pin_hash text, p_trimester text, p_item text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare r public.student_pets; it public.pet_items; used int;
  today date := (now() at time zone 'America/Denver')::date;
begin
  if not public._pet_auth(p_student_id, p_pin_hash, p_trimester) then raise exception 'Login expired'; end if;
  select * into it from public.pet_items where key = p_item;
  if it.key is null then raise exception 'That upgrade doesn''t exist'; end if;

  if it.slot = 'kit' then   -- one-time boost, once a day each, sprite must be alive
    r := public._pet_tick(p_student_id);
    if r.student_id is null then raise exception 'Hatch a sprite first'; end if;
    if not r.alive then raise exception 'Revive your sprite first. Answer chapter questions!'; end if;
    if r.day_date is distinct from today then r.day_counts := '{}'::jsonb; r.day_date := today; end if;
    used := coalesce((r.day_counts->>it.key)::int, 0);
    if used >= 1 then raise exception 'One % a day. Come back tomorrow!', it.name; end if;
    if it.key = 'k_medicine' and r.health >= 60 then raise exception 'Medicine is for a sick sprite (health under 60).'; end if;
    if r.knowledge < it.cost then raise exception 'You need % more Knowledge for that', it.cost - r.knowledge; end if;
    case it.key
      when 'k_snack'    then r.food := r.food + 30;
      when 'k_vitamins' then r.energy := r.energy + 15; r.health := r.health + 5;
      when 'k_bath'     then r.clean := r.clean + 35; r.mood := r.mood + 10;
      when 'k_medicine' then r.health := r.health + 25;
      else null;
    end case;
    r.food := least(100, r.food); r.energy := least(100, r.energy); r.mood := least(100, r.mood);
    r.clean := least(100, r.clean); r.health := least(100, r.health);
    r.knowledge := r.knowledge - it.cost;
    r.day_counts := jsonb_set(r.day_counts, array[it.key], to_jsonb(used + 1));
    update public.student_pets set food = r.food, energy = r.energy, mood = r.mood, clean = r.clean, health = r.health,
      knowledge = r.knowledge, day_counts = r.day_counts, day_date = r.day_date, updated_at = now()
     where student_id = r.student_id;
    return public._pet_view(r, true) || jsonb_build_object('result', 'used');
  end if;

  select * into r from public.student_pets where student_id = p_student_id for update;
  if r.student_id is null then raise exception 'Hatch a sprite first'; end if;
  if it.key = any(r.owned) then raise exception 'You already own that'; end if;
  if r.knowledge_total < it.unlock then
    raise exception 'Locked: answer % more questions correctly to unlock it', it.unlock - r.knowledge_total;
  end if;
  if r.knowledge < it.cost then
    raise exception 'You need % more Knowledge for that', it.cost - r.knowledge;
  end if;
  update public.student_pets set knowledge = knowledge - it.cost, owned = array_append(owned, it.key),
         equipped = jsonb_set(coalesce(equipped, '{}'::jsonb), array[it.slot], to_jsonb(it.key)), updated_at = now()
   where student_id = p_student_id returning * into r;
  return public._pet_view(r, true) || jsonb_build_object('result', 'bought');
end $function$;

-- ---------- −25 Quest XP per fade (fades on or after 2026-11-19) ----------
create or replace function public.get_badge_data(p_trimester text, p_student_id uuid default null::uuid)
 returns table(id uuid, task_keys text[], day_dates date[], extra jsonb)
 language sql stable security definer set search_path to 'public'
as $function$
  with champs as (
    select a.student_id, count(*) n
    from arcade_scores a
    join arcade_games g on g.key = a.game
    join students s2 on s2.id = a.student_id
    where a.trimester = p_trimester and a.best > 0 and a.best <= g.max_score
      and s2.class_code !~* 'test' and s2.class_code !~* '^visitor'
      and a.best = (select max(b.best) from arcade_scores b join students s3 on s3.id = b.student_id
                    where b.trimester = p_trimester and b.game = a.game and b.best <= g.max_score
                      and s3.class_code !~* 'test' and s3.class_code !~* '^visitor')
    group by a.student_id
  )
  select s.id,
    coalesce((select array_agg(distinct qp.task_key) from quest_progress qp where qp.student_id = s.id), array[]::text[]),
    coalesce((select array_agg(distinct ad.day_date order by ad.day_date) from active_days ad
              where ad.student_id = s.id and public._real_day(ad.student_id, ad.day_date)), array[]::date[]),
    jsonb_build_object(
      'arcadeGames', (select count(distinct game) from arcade_scores a where a.student_id = s.id and a.trimester = p_trimester and coalesce(a.plays,0) > 0),
      'arcadeTops',  coalesce((select n from champs c where c.student_id = s.id), 0),
      'trailFinishes', (select count(*) from trail_runs t where t.student_id = s.id and t.trimester = p_trimester and t.status = 'done'),
      'upgrades', coalesce((select cardinality(p.owned) from student_pets p where p.student_id = s.id and p.trimester = p_trimester), 0),
      'mastered', (select count(distinct m.chapter) from mastery_attempts m where m.student_id = s.id and m.trimester = p_trimester and m.passed),
      'masteredCore', (select count(distinct m.chapter) from mastery_attempts m where m.student_id = s.id and m.trimester = p_trimester and m.passed and m.chapter between 1 and 16),
      'surveyVotes', (select count(*) from survey_votes v where v.student_id = s.id),
      'financeDone', exists(select 1 from finance_quest f where f.student_id = s.id and f.trimester = p_trimester and f.submitted_at is not null),
      'petFades', (select count(*) from pet_deaths d where d.student_id = s.id and d.trimester = p_trimester and d.died_at >= timestamptz '2026-11-19 00:00 America/Denver')
    )
  from students s
  where s.trimester = p_trimester and (p_student_id is null or s.id = p_student_id);
$function$;

-- ---------- 2026-11-18 (later): Extras rework, applied live ----------
-- Play and Treat once a day with bigger trade-offs; four honest "real-life slips" (no reward):
--   slip_sugar  +5 mood +10 food −10 health −10 energy (counts toward Sugar-Crashed)
--   slip_screen −10 energy −10 mood · slip_late −20 energy −5 health · slip_skip −15 food −5 energy
-- Slips are not habits: they never use a pick and never make a care day.
-- Applied by patching _pet_caps(), pet_action() and _pet_view() (sugar mood = any sugar today).
-- Pre-change copies: bk_pet_functions_20261118b.
