-- ============================================================
-- Weight Control Quest — the recipe book learns from students. Safe to re-run. Added 2026-11-11.
--
-- 1. Learned foods: when a pallet food isn't in the recipe book, the student picks its type
--    (meat, grain, fruit, vegetable, dairy, nut/fat, sweet). Every pick is a vote; the type with
--    the most votes is what every class sees from then on. Stores no student names.
-- 2. Student dishes: a student builds a dish from their pallet foods (servings of each).
--    The maker can use it right away (it's saved in their own quest data). Once 2 different
--    students have made a dish with the same name, every student whose pallet has those foods gets it.
-- 3. The teacher dashboard can see both lists and remove anything.
-- ============================================================

create table if not exists public.wcq_learned_foods (
  norm_name  text primary key,
  name       text not null,
  votes      jsonb not null default '{}'::jsonb,     -- {"fruit": 3, "veg": 1}
  category   text not null,
  active     boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.wcq_learned_foods enable row level security;

create table if not exists public.wcq_student_dishes (
  norm_name  text primary key,
  name       text not null,
  ings       jsonb not null,                         -- [[ingredientKey or "x:<food>", servings], ...]
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.wcq_student_dishes enable row level security;

create table if not exists public.wcq_dish_makers (
  norm_name  text not null references public.wcq_student_dishes(norm_name) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  made_at    timestamptz not null default now(),
  primary key (norm_name, student_id)
);
alter table public.wcq_dish_makers enable row level security;

create or replace function public._wcq_norm(p text) returns text language sql immutable as $$
  select btrim(regexp_replace(regexp_replace(lower(coalesce(p, '')), '[^a-z0-9 ]+', ' ', 'g'), '\s+', ' ', 'g'));
$$;
create or replace function public._wcq_clean(p text) returns boolean language sql immutable as $$
  select public._wcq_norm(p) !~ '(^| )(fuck\w*|shit\w*|bitch\w*|ass|asshole|damn|dick\w*|cock\w*|pussy|sex\w*|porn\w*|nigg\w*|fag\w*|retard\w*|crap|piss\w*|weed|drugs?|cocaine|meth|beer|vodka|wine|poop|pee|butt|boob\w*|penis|vagina|kill\w*|die)( |$)';
$$;

-- ---------- everyone: what the class has taught the book ----------
create or replace function public.wcq_learned()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'foods', coalesce((select jsonb_agg(jsonb_build_object('n', f.norm_name, 'name', f.name, 'cat', f.category))
                       from public.wcq_learned_foods f where f.active), '[]'::jsonb),
    'dishes', coalesce((select jsonb_agg(jsonb_build_object('id', 's-' || replace(d.norm_name, ' ', '-'), 'name', d.name, 'ings', d.ings, 'makers', m.c))
                        from public.wcq_student_dishes d
                        join (select norm_name, count(*) c from public.wcq_dish_makers group by norm_name) m on m.norm_name = d.norm_name
                        where d.active and m.c >= 2), '[]'::jsonb));
$$;

-- ---------- student: teach a food's type ----------
create or replace function public.wcq_learn_food(p_student_id uuid, p_pin_hash text, p_trimester text, p_name text, p_category text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_norm text := public._wcq_norm(p_name); v_votes jsonb; v_cat text;
begin
  if not exists (select 1 from public.students s where s.id = p_student_id and s.pin_hash = p_pin_hash and s.trimester = p_trimester)
    then raise exception 'not signed in'; end if;
  if p_category not in ('meat', 'grain', 'fruit', 'veg', 'dairy', 'fat', 'sweet') then raise exception 'bad type'; end if;
  if char_length(v_norm) < 2 or char_length(v_norm) > 40 or not public._wcq_clean(p_name) then return jsonb_build_object('ok', false); end if;
  insert into public.wcq_learned_foods (norm_name, name, votes, category)
    values (v_norm, left(btrim(p_name), 40), jsonb_build_object(p_category, 1), p_category)
    on conflict (norm_name) do update set
      votes = public.wcq_learned_foods.votes || jsonb_build_object(p_category, coalesce((public.wcq_learned_foods.votes ->> p_category)::int, 0) + 1),
      updated_at = now();
  select votes into v_votes from public.wcq_learned_foods where norm_name = v_norm;
  select key into v_cat from jsonb_each_text(v_votes) order by value::int desc, key limit 1;
  update public.wcq_learned_foods set category = v_cat where norm_name = v_norm;
  return jsonb_build_object('ok', true, 'cat', v_cat);
end $$;

-- ---------- student: make a dish ----------
create or replace function public.wcq_make_dish(p_student_id uuid, p_pin_hash text, p_trimester text, p_name text, p_ings jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_norm text := public._wcq_norm(p_name); v_n int;
begin
  if not exists (select 1 from public.students s where s.id = p_student_id and s.pin_hash = p_pin_hash and s.trimester = p_trimester)
    then raise exception 'not signed in'; end if;
  if char_length(v_norm) < 3 or char_length(v_norm) > 50 then raise exception 'Give your dish a name (3–50 letters)'; end if;
  if not public._wcq_clean(p_name) then raise exception 'Please pick a different name for your dish'; end if;
  if jsonb_typeof(p_ings) <> 'array' or jsonb_array_length(p_ings) < 1 or jsonb_array_length(p_ings) > 8 then raise exception 'Pick 1 to 8 foods'; end if;
  if (select count(*) from public.wcq_dish_makers where student_id = p_student_id) >= 20 then raise exception 'You have made 20 dishes already!'; end if;
  insert into public.wcq_student_dishes (norm_name, name, ings) values (v_norm, left(btrim(p_name), 50), p_ings)
    on conflict (norm_name) do nothing;
  insert into public.wcq_dish_makers (norm_name, student_id) values (v_norm, p_student_id) on conflict do nothing;
  select count(*) into v_n from public.wcq_dish_makers where norm_name = v_norm;
  return jsonb_build_object('ok', true, 'makers', v_n, 'shared', v_n >= 2);
end $$;

-- ---------- teacher ----------
create or replace function public.wcq_teacher_learning(p_teacher_pass text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  return jsonb_build_object(
    'foods', coalesce((select jsonb_agg(jsonb_build_object('n', f.norm_name, 'name', f.name, 'cat', f.category, 'votes', f.votes) order by f.updated_at desc)
                       from public.wcq_learned_foods f where f.active), '[]'::jsonb),
    'dishes', coalesce((select jsonb_agg(jsonb_build_object('n', d.norm_name, 'name', d.name, 'ings', d.ings,
                          'makers', (select count(*) from public.wcq_dish_makers m where m.norm_name = d.norm_name)) order by d.updated_at desc)
                        from public.wcq_student_dishes d where d.active), '[]'::jsonb));
end $$;

create or replace function public.wcq_teacher_remove(p_teacher_pass text, p_kind text, p_norm text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  if p_kind = 'food' then update public.wcq_learned_foods set active = false, updated_at = now() where norm_name = p_norm;
  elsif p_kind = 'dish' then update public.wcq_student_dishes set active = false, updated_at = now() where norm_name = p_norm;
  else raise exception 'bad kind'; end if;
  return public.wcq_teacher_learning(p_teacher_pass);
end $$;

revoke all on function public._wcq_norm(text) from public, anon, authenticated;
revoke all on function public._wcq_clean(text) from public, anon, authenticated;
grant execute on function public.wcq_learned() to anon, authenticated;
grant execute on function public.wcq_learn_food(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.wcq_make_dish(uuid, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.wcq_teacher_learning(text) to anon, authenticated;
grant execute on function public.wcq_teacher_remove(text, text, text) to anon, authenticated;
