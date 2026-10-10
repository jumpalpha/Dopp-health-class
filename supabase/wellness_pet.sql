-- ============================================================
-- Wellness Sprite (class virtual pet)
-- Paste into Supabase > SQL Editor > New query > Run.
-- Safe to re-run. Adds one table + functions; touches nothing else.
-- All game rules run here on the server so the leaderboard is fair.
--
-- Decay (per hour): food 1.3, energy 1.1, mood 1.0, clean 0.8
-- Health: -1/hr when average need < 30, -2/hr when any need is 0,
--         +0.5/hr when average need > 60.
-- A fully healthy sprite left 100% alone dies after ~121 hours (5 days).
-- Dead sprites revive after 10 correct chapter questions.
-- ============================================================

create table if not exists public.student_pets (
  student_id      uuid primary key references public.students(id) on delete cascade,
  trimester       text not null,
  name            text not null check (char_length(name) between 1 and 16),
  color           text not null check (color in ('gold','emerald','sky','crimson','violet')),
  born_at         timestamptz not null default now(),
  food            double precision not null default 100,
  energy          double precision not null default 100,
  mood            double precision not null default 100,
  clean           double precision not null default 100,
  health          double precision not null default 100,
  alive           boolean not null default true,
  died_at         timestamptz,
  deaths          int not null default 0,
  revive_progress int not null default 0,
  care_points     int not null default 0,
  junk_total      int not null default 0,
  streak          int not null default 0,
  best_streak     int not null default 0,
  streak_date     date,
  day_date        date,
  day_counts      jsonb not null default '{}'::jsonb,
  last_tick       timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.student_pets enable row level security;
create index if not exists student_pets_trimester on public.student_pets (trimester);

-- ---------- private helpers (not callable from the website) ----------

create or replace function public._pet_auth(p_student_id uuid, p_pin_hash text, p_trimester text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.students s
                 where s.id = p_student_id and s.pin_hash = p_pin_hash and s.trimester = p_trimester);
$$;

-- Apply time passing (whole hours) and save. Returns the updated row.
create or replace function public._pet_tick(p_student_id uuid)
returns public.student_pets language plpgsql security definer set search_path = public as $$
declare
  r public.student_pets;
  h int; steps int; i int;
  avg_need double precision; min_need double precision;
begin
  select * into r from public.student_pets where student_id = p_student_id for update;
  if not found then return null; end if;
  h := floor(extract(epoch from now() - r.last_tick) / 3600)::int;
  if h <= 0 then return r; end if;
  steps := least(h, 400);
  for i in 1..steps loop
    exit when not r.alive;
    r.food   := greatest(0, r.food   - 1.3);
    r.energy := greatest(0, r.energy - 1.1);
    r.mood   := greatest(0, r.mood   - 1.0);
    r.clean  := greatest(0, r.clean  - 0.8);
    avg_need := (r.food + r.energy + r.mood + r.clean) / 4;
    min_need := least(r.food, r.energy, r.mood, r.clean);
    if min_need <= 0 then r.health := r.health - 2;
    elsif avg_need < 30 then r.health := r.health - 1;
    elsif avg_need > 60 then r.health := least(100, r.health + 0.5);
    end if;
    if r.health <= 0 then
      r.health := 0; r.alive := false;
      r.died_at := r.last_tick + make_interval(hours => i);
    end if;
  end loop;
  r.last_tick := r.last_tick + make_interval(hours => h);
  update public.student_pets set
    food = r.food, energy = r.energy, mood = r.mood, clean = r.clean,
    health = r.health, alive = r.alive, died_at = r.died_at, last_tick = r.last_tick
  where student_id = r.student_id;
  return r;
end $$;

-- Public-safe summary of a pet (no private habit details).
create or replace function public._pet_view(r public.student_pets, p_full boolean)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  age_days double precision := extract(epoch from now() - r.born_at) / 86400;
  stage text; form text := null; mood_label text;
  today date := (now() at time zone 'America/Denver')::date;
  counts jsonb := case when r.day_date = today then r.day_counts else '{}'::jsonb end;
  v jsonb;
begin
  stage := case
    when r.care_points = 0 then 'egg'
    when age_days >= 24 and r.care_points >= 80 then 'adult'
    when age_days >= 10 and r.care_points >= 35 then 'teen'
    when age_days >= 3  and r.care_points >= 10 then 'child'
    else 'baby' end;
  if stage = 'adult' then
    form := case
      when r.junk_total * 3 > r.care_points then 'sugar'
      when r.care_points / greatest(age_days, 1) >= 4 then 'radiant'
      when r.care_points / greatest(age_days, 1) >= 2 then 'steady'
      else 'scruffy' end;
  end if;
  mood_label := case
    when not r.alive then 'ghost'
    when r.health < 35 then 'sick'
    when r.food < 25 then 'hungry'
    when r.energy < 25 then 'tired'
    when r.clean < 25 then 'dirty'
    when r.mood < 25 then 'sad'
    when coalesce((counts->>'treat')::int, 0) >= 2 then 'sugar'
    else 'happy' end;
  v := jsonb_build_object(
    'name', r.name, 'color', r.color, 'stage', stage, 'form', form,
    'mood_label', mood_label, 'alive', r.alive,
    'health', round(r.health::numeric), 'streak', r.streak,
    'age_days', floor(age_days)::int);
  if p_full then
    v := v || jsonb_build_object(
      'food', round(r.food::numeric), 'energy', round(r.energy::numeric),
      'mood', round(r.mood::numeric), 'clean', round(r.clean::numeric),
      'best_streak', r.best_streak, 'care_points', r.care_points,
      'deaths', r.deaths, 'revive_progress', r.revive_progress, 'revive_needed', 10,
      'today', counts,
      'caps', '{"meal":2,"water":1,"sleep":1,"exercise":1,"relax":1,"hygiene":1,"quiz":10,"treat":3,"play":3}'::jsonb,
      'next_stage_points', case stage when 'egg' then 1 when 'baby' then 10 when 'child' then 35 when 'teen' then 80 else null end,
      'next_stage_days',   case stage when 'baby' then 3 when 'child' then 10 when 'teen' then 24 else null end);
  end if;
  return v;
end $$;

revoke execute on function public._pet_auth(uuid, text, text) from public, anon, authenticated;
revoke execute on function public._pet_tick(uuid) from public, anon, authenticated;
revoke execute on function public._pet_view(public.student_pets, boolean) from public, anon, authenticated;

-- ---------- student functions ----------

create or replace function public.pet_get(p_student_id uuid, p_pin_hash text, p_trimester text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.student_pets;
begin
  if not public._pet_auth(p_student_id, p_pin_hash, p_trimester) then
    raise exception 'Login expired';
  end if;
  r := public._pet_tick(p_student_id);
  if r.student_id is null then return null; end if;
  return public._pet_view(r, true);
end $$;

create or replace function public.pet_create(p_student_id uuid, p_pin_hash text, p_trimester text,
                                             p_name text, p_color text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.student_pets; v_name text := left(btrim(coalesce(p_name, '')), 16);
begin
  if not public._pet_auth(p_student_id, p_pin_hash, p_trimester) then
    raise exception 'Login expired';
  end if;
  if v_name = '' then raise exception 'Give your sprite a name'; end if;
  if exists (select 1 from public.student_pets where student_id = p_student_id) then
    raise exception 'You already have a sprite';
  end if;
  insert into public.student_pets (student_id, trimester, name, color)
  values (p_student_id, p_trimester, v_name, p_color)
  returning * into r;
  return public._pet_view(r, true);
end $$;

-- Actions: meal water sleep exercise relax hygiene (real-life habits, honor system),
--          quiz (one correct chapter answer), treat (junk food), play.
create or replace function public.pet_action(p_student_id uuid, p_pin_hash text, p_trimester text,
                                             p_action text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.student_pets;
  caps jsonb := '{"meal":2,"water":1,"sleep":1,"exercise":1,"relax":1,"hygiene":1,"quiz":10,"treat":3,"play":3}';
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
  if used >= (caps->>p_action)::int and r.alive then  -- revive answers are not capped
    raise exception 'Daily limit reached for that one. Come back tomorrow!';
  end if;
  if not r.alive and p_action <> 'quiz' then
    raise exception 'Your sprite needs reviving first. Answer chapter questions!';
  end if;

  if not r.alive then
    r.revive_progress := r.revive_progress + 1;
    if r.revive_progress >= 10 then
      r.alive := true; r.health := 40; r.food := 50; r.energy := 50; r.mood := 50; r.clean := 50;
      r.deaths := r.deaths + 1; r.revive_progress := 0; r.died_at := null;
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
  if r.alive and r.health <= 0 then r.health := 1; end if;  -- treats alone never kill

  r.day_counts := jsonb_set(r.day_counts, array[p_action], to_jsonb(used + 1));

  -- streak: a day counts once 3 different habits are logged
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
    day_counts = r.day_counts, updated_at = now()
  where student_id = r.student_id;

  return public._pet_view(r, true) || jsonb_build_object('result', msg);
end $$;

-- ---------- public gallery ----------
-- Everyone's sprite (owner display name, sprite name, look, health, streak).
create or replace function public.pet_gallery(p_trimester text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sid uuid; out jsonb;
begin
  for sid in select p.student_id from public.student_pets p where p.trimester = p_trimester loop
    perform public._pet_tick(sid);
  end loop;
  select coalesce(jsonb_agg(public._pet_view(p, false)
           || jsonb_build_object('owner', coalesce(nullif(btrim(s.display_name), ''), 'Student'))
         order by p.alive desc, p.health desc, p.streak desc, p.care_points desc), '[]'::jsonb)
    into out
  from public.student_pets p join public.students s on s.id = p.student_id
  where p.trimester = p_trimester;
  return out;
end $$;
