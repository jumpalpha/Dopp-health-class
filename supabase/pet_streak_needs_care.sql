-- pet_streak_needs_care: Sprite streaks only grow on days the student cares for the sprite.
-- Applied 2026-11-15 as Supabase migration "pet_streak_needs_care" (project gmeyamrlqfrabtslsweu).
--
-- Before: the immortal "Ancient of Days" sprites got +1 streak for every calendar day inside _pet_tick,
-- whether or not anyone logged habits. Regular sprites already only counted 3-habit days.
-- After: _pet_tick no longer touches the streak; pet_action adds the day once 3 different habits are
-- logged. Immortal sprites still never reset (a missed day doesn't drop them to 1); regular sprites keep
-- the old rule (yesterday counted -> +1, otherwise start over at 1).
-- Forward-only: no existing streak, best_streak or streak_date is changed by this migration.
-- The bedrock b_* functions (b_pets) are not used by the live pet page and were not changed.

-- ===================== FORWARD =====================
create or replace function public._pet_tick(p_student_id uuid)
 returns student_pets
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r public.student_pets;
  h int; steps int; i int;
  avg_need double precision; min_need double precision;
  today date := (now() at time zone 'America/Denver')::date;
begin
  select * into r from public.student_pets where student_id = p_student_id for update;
  if not found then return null; end if;

  -- Immortal sprite (teacher's "Ancient of Days"): always full health, never dies.
  -- Its streak never resets, but it only grows on care days (3 habits, see pet_action). 2026-11-15
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
    end if;
  end loop;
  r.last_tick := r.last_tick + make_interval(hours => h);
  if not r.alive and r.died_at is not null
     and not exists (select 1 from public.pet_deaths d
                     where d.student_id = r.student_id and d.died_at = r.died_at) then
    insert into public.pet_deaths (student_id, trimester, pet_name, color, stage, died_at)
    values (r.student_id, r.trimester, r.name, r.color,
            case when r.care_points = 0 then 'egg' else null end, r.died_at);
  end if;
  update public.student_pets set
    food = r.food, energy = r.energy, mood = r.mood, clean = r.clean,
    health = r.health, alive = r.alive, died_at = r.died_at, last_tick = r.last_tick
  where student_id = r.student_id;
  return r;
end $function$;

create or replace function public.pet_action(p_student_id uuid, p_pin_hash text, p_trimester text, p_action text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r public.student_pets;
  caps jsonb := '{"meal":2,"water":1,"sleep":1,"exercise":1,"relax":1,"hygiene":1,"quiz":15,"study":25,"treat":3,"play":3}';
  habits text[] := array['meal','water','sleep','exercise','relax','hygiene'];
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
      when 'meal'     then r.food := r.food + 35;
      when 'water'    then r.energy := r.energy + 10; r.health := r.health + 3;
      when 'sleep'    then r.energy := r.energy + 45;
      when 'exercise' then r.mood := r.mood + 20; r.energy := r.energy + 5; r.health := r.health + 4; r.clean := r.clean - 10;
      when 'relax'    then r.mood := r.mood + 30;
      when 'hygiene'  then r.clean := r.clean + 55;
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

  -- streak: a day counts once 3 different habits are logged (immortal sprites never reset, they just add the day)
  select count(*) into habit_kinds from unnest(habits) k where coalesce((r.day_counts->>k)::int, 0) > 0;
  if habit_kinds >= 3 and r.streak_date is distinct from today then
    r.streak := case when r.immortal or r.streak_date = today - 1 then r.streak + 1 else 1 end;
    r.streak_date := today;
    r.best_streak := greatest(r.best_streak, r.streak);
  end if;

  update public.student_pets set
    food = r.food, energy = r.energy, mood = r.mood, clean = r.clean, health = r.health,
    alive = r.alive, died_at = r.died_at, deaths = r.deaths, revive_progress = r.revive_progress,
    care_points = r.care_points, junk_total = r.junk_total, streak = r.streak,
    best_streak = r.best_streak, streak_date = r.streak_date, day_date = r.day_date,
    day_counts = r.day_counts, knowledge = r.knowledge, knowledge_total = r.knowledge_total,
    updated_at = now()
  where student_id = r.student_id;

  return public._pet_view(r, true) || jsonb_build_object('result', msg);
end $function$;


-- ===================== ROLLBACK (restores the definitions live before 2026-11-15) =====================
/*
create or replace function public._pet_tick(p_student_id uuid)
 returns student_pets
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r public.student_pets;
  h int; steps int; i int;
  avg_need double precision; min_need double precision;
  today date := (now() at time zone 'America/Denver')::date;
begin
  select * into r from public.student_pets where student_id = p_student_id for update;
  if not found then return null; end if;

  -- Immortal sprite (teacher's "Ancient of Days"): always full health, never dies,
  -- streak only grows (one day per calendar day, never resets).
  if r.immortal then
    r.food := 100; r.energy := 100; r.mood := 100; r.clean := 100; r.health := 100;
    r.alive := true; r.died_at := null; r.revive_progress := 0;
    if r.streak_date is null then r.streak := greatest(r.streak, 1);
    elsif r.streak_date < today then r.streak := r.streak + (today - r.streak_date);
    end if;
    r.streak_date := today;
    r.best_streak := greatest(r.best_streak, r.streak);
    r.last_tick := now();
    update public.student_pets set
      food = r.food, energy = r.energy, mood = r.mood, clean = r.clean, health = r.health,
      alive = r.alive, died_at = r.died_at, revive_progress = r.revive_progress,
      streak = r.streak, streak_date = r.streak_date, best_streak = r.best_streak, last_tick = r.last_tick
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
    end if;
  end loop;
  r.last_tick := r.last_tick + make_interval(hours => h);
  if not r.alive and r.died_at is not null
     and not exists (select 1 from public.pet_deaths d
                     where d.student_id = r.student_id and d.died_at = r.died_at) then
    insert into public.pet_deaths (student_id, trimester, pet_name, color, stage, died_at)
    values (r.student_id, r.trimester, r.name, r.color,
            case when r.care_points = 0 then 'egg' else null end, r.died_at);
  end if;
  update public.student_pets set
    food = r.food, energy = r.energy, mood = r.mood, clean = r.clean,
    health = r.health, alive = r.alive, died_at = r.died_at, last_tick = r.last_tick
  where student_id = r.student_id;
  return r;
end $function$;

create or replace function public.pet_action(p_student_id uuid, p_pin_hash text, p_trimester text, p_action text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r public.student_pets;
  caps jsonb := '{"meal":2,"water":1,"sleep":1,"exercise":1,"relax":1,"hygiene":1,"quiz":15,"study":25,"treat":3,"play":3}';
  habits text[] := array['meal','water','sleep','exercise','relax','hygiene'];
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
      when 'meal'     then r.food := r.food + 35;
      when 'water'    then r.energy := r.energy + 10; r.health := r.health + 3;
      when 'sleep'    then r.energy := r.energy + 45;
      when 'exercise' then r.mood := r.mood + 20; r.energy := r.energy + 5; r.health := r.health + 4; r.clean := r.clean - 10;
      when 'relax'    then r.mood := r.mood + 30;
      when 'hygiene'  then r.clean := r.clean + 55;
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

  select count(*) into habit_kinds from unnest(habits) k where coalesce((r.day_counts->>k)::int, 0) > 0;
  if habit_kinds >= 3 and r.streak_date is distinct from today then
    r.streak := case when r.streak_date = today - 1 then r.streak + 1 else 1 end;
    r.streak_date := today;
    r.best_streak := greatest(r.best_streak, r.streak);
  end if;

  update public.student_pets set
    food = r.food, energy = r.energy, mood = r.mood, clean = r.clean, health = r.health,
    alive = r.alive, died_at = r.died_at, deaths = r.deaths, revive_progress = r.revive_progress,
    care_points = r.care_points, junk_total = r.junk_total, streak = r.streak,
    best_streak = r.best_streak, streak_date = r.streak_date, day_date = r.day_date,
    day_counts = r.day_counts, knowledge = r.knowledge, knowledge_total = r.knowledge_total,
    updated_at = now()
  where student_id = r.student_id;

  return public._pet_view(r, true) || jsonb_build_object('result', msg);
end $function$;
*/
