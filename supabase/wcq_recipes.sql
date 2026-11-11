-- ============================================================
-- Weight Control Quest — Island Recipe Book. Safe to re-run. Added 2026-11-11.
--
-- • The built-in recipe book lives in wcq_recipes.js. This file adds the part that grows:
--   wcq_recipes holds dishes Mr. Dopp approved from student suggestions; every student sees them.
-- • Students (signed in) suggest a dish that isn't in the book: dish name, which of their
--   pallet foods it would use, and a note. Same dish name suggested again just bumps a counter,
--   so the teacher sees which dishes are wanted most. Max 5 suggestions per student per day.
-- • Suggestions store no student name.
-- • Teacher (dashboard passphrase, _teacher_ok) turns a suggestion into a recipe or rejects it.
-- ============================================================

create table if not exists public.wcq_recipes (
  id          text primary key,
  name        text not null check (char_length(name) between 2 and 60),
  ings        jsonb not null,               -- [[ingredientKey, amount, altKey?, altAmount?], ...]
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.wcq_recipes enable row level security;   -- no policies: functions only

create table if not exists public.wcq_recipe_suggestions (
  id          uuid primary key default gen_random_uuid(),
  trimester   text not null,
  dish_name   text not null check (char_length(dish_name) between 2 and 60),
  norm_name   text not null,
  foods       jsonb not null default '[]'::jsonb,   -- pallet food names students said it would use
  notes       jsonb not null default '[]'::jsonb,
  n           int not null default 1,
  status      text not null default 'new' check (status in ('new', 'approved', 'rejected')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists wcq_sugg_status on public.wcq_recipe_suggestions (status, norm_name);
alter table public.wcq_recipe_suggestions enable row level security;

create table if not exists public.wcq_suggest_limits (
  student_id uuid not null references public.students(id) on delete cascade,
  day        date not null,
  n          int  not null default 0,
  primary key (student_id, day)
);
alter table public.wcq_suggest_limits enable row level security;

-- ---------- everyone: the approved recipes ----------
create or replace function public.wcq_recipes_list()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'ings', r.ings) order by r.name), '[]'::jsonb)
  from public.wcq_recipes r where r.active;
$$;

-- ---------- student: suggest a dish ----------
create or replace function public.wcq_suggest_dish(p_student_id uuid, p_pin_hash text, p_trimester text,
  p_name text, p_foods jsonb, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'America/Boise')::date; used int;
  v_name text := left(btrim(coalesce(p_name, '')), 60);
  v_norm text := lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'));
  v_note text := left(btrim(coalesce(p_note, '')), 300);
  v_foods jsonb := case when jsonb_typeof(p_foods) = 'array' then p_foods else '[]'::jsonb end;
  v_id uuid;
begin
  if not exists (select 1 from public.students s where s.id = p_student_id and s.pin_hash = p_pin_hash and s.trimester = p_trimester)
    then raise exception 'not signed in'; end if;
  if char_length(v_name) < 2 then raise exception 'Type the name of the dish'; end if;
  select n into used from public.wcq_suggest_limits where student_id = p_student_id and day = d;
  if coalesce(used, 0) >= 5 then raise exception 'You can suggest 5 dishes a day. Try again tomorrow!'; end if;
  insert into public.wcq_suggest_limits (student_id, day, n) values (p_student_id, d, 1)
    on conflict (student_id, day) do update set n = public.wcq_suggest_limits.n + 1;

  select id into v_id from public.wcq_recipe_suggestions where norm_name = v_norm and status = 'new' limit 1;
  if v_id is not null then
    update public.wcq_recipe_suggestions set
      n = n + 1, updated_at = now(),
      foods = (select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from (
                 select jsonb_array_elements(foods) x union select jsonb_array_elements(v_foods)) q),
      notes = case when v_note = '' then notes else (notes || to_jsonb(v_note)) end
    where id = v_id;
  else
    insert into public.wcq_recipe_suggestions (trimester, dish_name, norm_name, foods, notes)
      values (p_trimester, v_name, v_norm, v_foods, case when v_note = '' then '[]'::jsonb else jsonb_build_array(v_note) end);
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- teacher ----------
create or replace function public.wcq_teacher_suggestions(p_teacher_pass text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  return jsonb_build_object(
    'suggestions', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.dish_name, 'foods', s.foods,
        'notes', s.notes, 'n', s.n, 'trimester', s.trimester, 'updated_at', s.updated_at) order by s.n desc, s.updated_at desc)
      from public.wcq_recipe_suggestions s where s.status = 'new'), '[]'::jsonb),
    'recipes', public.wcq_recipes_list());
end $$;

-- Approve: creates (or replaces) a recipe. p_suggestion_id may be null (teacher adds a dish directly).
create or replace function public.wcq_teacher_approve(p_teacher_pass text, p_suggestion_id uuid, p_name text, p_ings jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_name text := left(btrim(coalesce(p_name, '')), 60);
  v_id text := 'u-' || trim(both '-' from regexp_replace(lower(btrim(coalesce(p_name, ''))), '[^a-z0-9]+', '-', 'g'));
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  if char_length(v_name) < 2 then raise exception 'Give the dish a name'; end if;
  if jsonb_typeof(p_ings) <> 'array' or jsonb_array_length(p_ings) < 1 then raise exception 'Add at least one ingredient'; end if;
  insert into public.wcq_recipes (id, name, ings) values (v_id, v_name, p_ings)
    on conflict (id) do update set name = excluded.name, ings = excluded.ings, active = true;
  if p_suggestion_id is not null then
    update public.wcq_recipe_suggestions set status = 'approved', updated_at = now() where id = p_suggestion_id;
  end if;
  return public.wcq_teacher_suggestions(p_teacher_pass);
end $$;

create or replace function public.wcq_teacher_reject(p_teacher_pass text, p_suggestion_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  update public.wcq_recipe_suggestions set status = 'rejected', updated_at = now() where id = p_suggestion_id;
  return public.wcq_teacher_suggestions(p_teacher_pass);
end $$;

create or replace function public.wcq_teacher_recipe_remove(p_teacher_pass text, p_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  update public.wcq_recipes set active = false where id = p_id;
  return public.wcq_teacher_suggestions(p_teacher_pass);
end $$;

grant execute on function public.wcq_recipes_list() to anon, authenticated;
grant execute on function public.wcq_suggest_dish(uuid, text, text, text, jsonb, text) to anon, authenticated;
grant execute on function public.wcq_teacher_suggestions(text) to anon, authenticated;
grant execute on function public.wcq_teacher_approve(text, uuid, text, jsonb) to anon, authenticated;
grant execute on function public.wcq_teacher_reject(text, uuid) to anon, authenticated;
grant execute on function public.wcq_teacher_recipe_remove(text, text) to anon, authenticated;
