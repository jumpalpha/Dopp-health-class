-- ============================================================
-- Wellness Sprite: Knowledge points + Upgrade Shop (Oct 2026)
-- Paste into Supabase > SQL Editor > New query > Run. Safe to re-run.
--
-- * Every correct chapter answer earns 1 Knowledge (💡).
--   The first 15 a day also feed the sprite ("quiz"); after that students can
--   keep studying for up to 25 more Knowledge a day ("study").
-- * Knowledge buys upgrades (skins, shoes, clothes, hair, hats, muscles...).
--   Bigger upgrades also need a lifetime number of correct answers to unlock.
-- * Prices live in pet_items on the server, so the shop is fair.
-- ============================================================

alter table public.student_pets add column if not exists knowledge       int   not null default 0;
alter table public.student_pets add column if not exists knowledge_total int   not null default 0;
alter table public.student_pets add column if not exists owned           text[] not null default '{}';
alter table public.student_pets add column if not exists equipped        jsonb not null default '{}'::jsonb;

create table if not exists public.pet_items (
  key        text primary key,
  slot       text not null,
  name       text not null,
  cost       int  not null,          -- Knowledge spent
  unlock     int  not null default 0, -- lifetime correct answers needed
  sort       int  not null default 0
);
alter table public.pet_items enable row level security;

insert into public.pet_items (key, slot, name, cost, unlock, sort) values
  ('sneakers',  'shoes', 'Running Sneakers',  10,   0,  1),
  ('bottle',    'hand',  'Water Bottle',      12,   0,  2),
  ('spiky',     'hair',  'Spiky Hair',        12,   0,  3),
  ('tee',       'shirt', 'Wellness Tee',      15,   0,  4),
  ('headband',  'hat',   'Sweatband',         18,  10,  5),
  ('glasses',   'face',  'Smart Glasses',     20,  10,  6),
  ('spots',     'skin',  'Polka Spots Skin',  25,  15,  7),
  ('curls',     'hair',  'Big Curls',         28,  20,  8),
  ('spikes',    'shoes', 'Track Spikes',      30,  25,  9),
  ('cap',       'hat',   'Ball Cap',          30,  25, 10),
  ('jersey',    'shirt', 'Team Jersey',       35,  30, 11),
  ('shades',    'face',  'Cool Shades',       35,  35, 12),
  ('toned',     'arms',  'Toned Arms',        40,  40, 13),
  ('dumbbell',  'hand',  'Dumbbell',          40,  40, 14),
  ('stripes',   'skin',  'Tiger Stripes Skin',45,  50, 15),
  ('mohawk',    'hair',  'Mohawk',            45,  50, 16),
  ('sparkles',  'aura',  'Sparkle Aura',      60,  80, 17),
  ('medal',     'neck',  'Gold Medal',        80, 100, 18),
  ('rockets',   'shoes', 'Rocket Boots',      90, 120, 19),
  ('cape',      'back',  'Hero Cape',        100, 140, 20),
  ('galaxy',    'skin',  'Galaxy Skin',      110, 150, 21),
  ('buff',      'arms',  'Mega Muscles',     120, 180, 22),
  ('crown',     'hat',   'Crown of Wellness',200, 300, 23),
  ('chrome',    'skin',  'Golden Chrome Skin',250,400, 24)
on conflict (key) do update set slot = excluded.slot, name = excluded.name, cost = excluded.cost,
  unlock = excluded.unlock, sort = excluded.sort;

-- One-time head start: credit correct answers students already gave this trimester.
do $$
begin
  if not exists (select 1 from public.student_pets where knowledge_total > 0) then
    update public.student_pets p set knowledge = q.n, knowledge_total = q.n
      from (select student_id, trimester, sum(quiz)::int n from public.pet_care_days group by 1, 2) q
     where q.student_id = p.student_id and q.trimester = p.trimester;
  end if;
end $$;

-- ---------- view: adds gear (public) and knowledge/owned (owner only) ----------
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
    'age_days', floor(age_days)::int, 'gear', coalesce(r.equipped, '{}'::jsonb));
  if p_full then
    v := v || jsonb_build_object(
      'food', round(r.food::numeric), 'energy', round(r.energy::numeric),
      'mood', round(r.mood::numeric), 'clean', round(r.clean::numeric),
      'best_streak', r.best_streak, 'care_points', r.care_points,
      'deaths', r.deaths, 'revive_progress', r.revive_progress, 'revive_needed', 10,
      'today', counts,
      'caps', '{"meal":2,"water":1,"sleep":1,"exercise":1,"relax":1,"hygiene":1,"quiz":15,"study":25,"treat":3,"play":3}'::jsonb,
      'knowledge', r.knowledge, 'knowledge_total', r.knowledge_total, 'owned', to_jsonb(r.owned),
      'next_stage_points', case stage when 'egg' then 1 when 'baby' then 10 when 'child' then 35 when 'teen' then 80 else null end,
      'next_stage_days',   case stage when 'baby' then 3 when 'child' then 10 when 'teen' then 24 else null end);
  end if;
  return v;
end $$;
revoke execute on function public._pet_view(public.student_pets, boolean) from public, anon, authenticated;

-- ---------- actions: quiz and study now earn Knowledge ----------
create or replace function public.pet_action(p_student_id uuid, p_pin_hash text, p_trimester text,
                                             p_action text)
returns jsonb language plpgsql security definer set search_path = public as $$
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
  if used >= (caps->>p_action)::int and r.alive then  -- revive answers are not capped
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
    day_counts = r.day_counts, knowledge = r.knowledge, knowledge_total = r.knowledge_total,
    updated_at = now()
  where student_id = r.student_id;

  return public._pet_view(r, true) || jsonb_build_object('result', msg);
end $$;

-- ---------- shop ----------
create or replace function public.pet_shop_items()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('key', key, 'slot', slot, 'name', name, 'cost', cost, 'unlock', unlock) order by sort), '[]'::jsonb)
  from public.pet_items;
$$;

create or replace function public.pet_shop_buy(p_student_id uuid, p_pin_hash text, p_trimester text, p_item text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.student_pets; it public.pet_items;
begin
  if not public._pet_auth(p_student_id, p_pin_hash, p_trimester) then raise exception 'Login expired'; end if;
  select * into it from public.pet_items where key = p_item;
  if it.key is null then raise exception 'That upgrade doesn''t exist'; end if;
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
end $$;

-- p_item = null takes off whatever is in that slot.
create or replace function public.pet_equip(p_student_id uuid, p_pin_hash text, p_trimester text, p_slot text, p_item text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.student_pets; it public.pet_items;
begin
  if not public._pet_auth(p_student_id, p_pin_hash, p_trimester) then raise exception 'Login expired'; end if;
  select * into r from public.student_pets where student_id = p_student_id for update;
  if r.student_id is null then raise exception 'Hatch a sprite first'; end if;
  if p_item is null then
    update public.student_pets set equipped = coalesce(equipped, '{}'::jsonb) - p_slot, updated_at = now()
     where student_id = p_student_id returning * into r;
  else
    select * into it from public.pet_items where key = p_item;
    if it.key is null or it.slot <> p_slot then raise exception 'That doesn''t go there'; end if;
    if not (it.key = any(r.owned)) then raise exception 'Buy it first'; end if;
    update public.student_pets set equipped = jsonb_set(coalesce(equipped, '{}'::jsonb), array[p_slot], to_jsonb(p_item)), updated_at = now()
     where student_id = p_student_id returning * into r;
  end if;
  return public._pet_view(r, true);
end $$;

grant execute on function public.pet_shop_items() to anon, authenticated;
grant execute on function public.pet_shop_buy(uuid, text, text, text) to anon, authenticated;
grant execute on function public.pet_equip(uuid, text, text, text, text) to anon, authenticated;
