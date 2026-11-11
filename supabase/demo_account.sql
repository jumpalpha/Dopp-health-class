-- ============================================================
-- Demo account ("Pilot", class TEST) — 2026-11-10
--
-- A read-only showcase account. Safety is enforced HERE, in the
-- database, not in the page code (the site's code is public):
--
--  1. students.is_demo marks the account.
--  2. demo_call() is the ONLY way the demo pages talk to the
--     database. It runs the requested function inside a
--     sub-transaction that is ALWAYS rolled back, so nothing the
--     demo does can be saved — student side or teacher side.
--  3. Teacher functions are reached with a one-time key that only
--     exists inside that rolled-back sub-transaction. The real
--     teacher passphrase is never used or revealed. Risky teacher
--     tools (PIN reset, sub codes, new trimester, live hosting)
--     are refused outright.
--  4. Every result is name-masked: real students show as
--     "Student 12 #12". PIN/pass hashes are blanked.
--  5. Backstop triggers silently drop any write to a demo
--     student's rows, even if someone calls the normal functions
--     directly with Pilot's PIN.
--  6. Pilot is hidden from the Sprite Gallery, Fallen Sprites and
--     Hall of Heroes data (arcade/trail boards already hide TEST).
--
-- Maintenance: to change Pilot's data on purpose, run
--   set local app.demo_admin = 'on';
-- in the same transaction first.
-- ============================================================

alter table public.students add column if not exists is_demo boolean not null default false;

-- ---------- 5. backstop: drop writes for demo students ----------
create or replace function public._demo_block_write()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare r jsonb; c text; v text;
begin
  if coalesce(current_setting('app.demo_admin', true), '') = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  r := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  foreach c in array tg_argv loop
    v := r->>c;
    if v is not null and exists (select 1 from public.students s where s.id = v::uuid and s.is_demo) then
      return null;                       -- silently skip this row
    end if;
  end loop;
  if tg_op = 'UPDATE' then               -- also block moving a row away from a demo student
    r := to_jsonb(old);
    foreach c in array tg_argv loop
      v := r->>c;
      if v is not null and exists (select 1 from public.students s where s.id = v::uuid and s.is_demo) then
        return null;
      end if;
    end loop;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create or replace function public._demo_block_student()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(current_setting('app.demo_admin', true), '') = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if old.is_demo then return null; end if;          -- demo student row can't be changed or deleted
  if tg_op = 'UPDATE' and new.is_demo then return null; end if;  -- nobody can turn an account into a demo
  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists demo_block on public.students;
create trigger demo_block before update or delete on public.students
  for each row execute function public._demo_block_student();

create or replace function public._demo_block_new_student()
returns trigger language plpgsql as $$
begin
  if new.is_demo and coalesce(current_setting('app.demo_admin', true), '') <> 'on' then
    new.is_demo := false;
  end if;
  return new;
end $$;
drop trigger if exists demo_block_new on public.students;
create trigger demo_block_new before insert on public.students
  for each row execute function public._demo_block_new_student();

do $$
declare t record;
begin
  for t in
    select c.table_name, array_agg(c.column_name::text order by c.column_name) cols
      from information_schema.columns c
      join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
     where c.table_schema = 'public' and tb.table_type = 'BASE TABLE' and c.data_type = 'uuid'
       and c.column_name in ('student_id', 'p1_student', 'p2_student', 'to_id', 'from_id', 'keep_id', 'drop_id')
       and c.table_name not like '%backup%'
     group by c.table_name
  loop
    execute format('drop trigger if exists demo_block on public.%I', t.table_name);
    execute format('create trigger demo_block before insert or update or delete on public.%I
                    for each row execute function public._demo_block_write(%s)',
                   t.table_name, (select string_agg(quote_literal(x), ', ') from unnest(t.cols) x));
  end loop;
end $$;

-- ---------- 4. name masking ----------
create or replace function public._demo_mask(p jsonb)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  txt text; m jsonb; firsts jsonb; s text; w text; out_s text; changed boolean;
begin
  if p is null then return null; end if;
  txt := p::text;
  -- blank secrets
  txt := regexp_replace(txt, '"(pin_hash|pass_hash|pin|p_pin_hash|teacher_pass)": "[^"]*"', '"\1": null', 'g');

  -- alias map: lower(name) -> alias
  with st as (
    select s.display_name d, s.last_name l,
           row_number() over (order by s.class_code, lower(s.last_name), lower(s.display_name), s.id) n
      from public.students s where not s.is_demo
  ), pairs as (
    select lower(btrim(d)) k, 'Student ' || n v, 1 pr from st where length(btrim(coalesce(d, ''))) >= 2
    union all select lower(btrim(l)), '#' || n, 2 from st where length(btrim(coalesce(l, ''))) >= 2
    union all select lower(btrim(d) || ' ' || btrim(l)), 'Student ' || n || ' #' || n, 0 from st
    union all select lower(btrim(l) || ', ' || btrim(d)), '#' || n || ', Student ' || n, 0 from st
    union all select lower(btrim(d) || ' ' || left(btrim(l), 1) || '.'), 'Student ' || n, 0 from st
    union all select lower(btrim(d) || ' ' || left(btrim(l), 1)), 'Student ' || n, 0 from st
  )
  select jsonb_object_agg(k, v) into m from (select distinct on (k) k, v from pairs order by k, pr) z;
  m := coalesce(m, '{}'::jsonb);

  -- every distinct string value in the result
  for s in select distinct x #>> '{}' from jsonb_path_query(txt::jsonb, 'strict $.** ? (@.type() == "string")') x loop
    out_s := null;
    if m ? lower(btrim(s)) then
      out_s := m->>lower(btrim(s));
    elsif s ~ '\s' and length(s) <= 2000 then
      -- free text: swap capitalised words that are student names
      changed := false; out_s := '';
      for w in select (regexp_matches(s, '([A-Za-z''-]+|[^A-Za-z''-]+)', 'g'))[1] loop
        if w ~ '^[A-Z]' and length(w) >= 3 and m ? lower(w) then
          out_s := out_s || (m->>lower(w)); changed := true;
        else
          out_s := out_s || w;
        end if;
      end loop;
      if not changed then out_s := null; end if;
    end if;
    if out_s is not null and out_s <> s then
      txt := replace(txt, to_jsonb(s)::text, to_jsonb(out_s)::text);
    end if;
  end loop;
  return txt::jsonb;
end $$;
revoke all on function public._demo_mask(jsonb) from public, anon, authenticated;

-- ---------- 2/3. the demo gateway ----------
create or replace function public.demo_is(p_sid uuid, p_pin text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.students s where s.id = p_sid and s.pin_hash = p_pin and s.is_demo);
$$;
grant execute on function public.demo_is(uuid, text) to anon, authenticated;

create or replace function public.demo_call(p_sid uuid, p_pin text, p_fn text, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare
  f record; v_args jsonb := coalesce(p_args, '{}'::jsonb); v_keys text[];
  in_names text[]; in_types oid[]; i int; nm text; typ text; parts text[] := '{}';
  v_call text; v_sql text; v_res jsonb; v_teacher boolean := false; v_tok text;
  v_found boolean := false; v_err boolean := false; v_msg text; v_state text; v_det text; v_hint text;
  tbl_cols text[];
  -- The ONLY teacher tools the demo may open (2026-11-10 lock-down). Each returns numbers, dates and
  -- names (masked) only: no student writing, images, health answers, visitor lists or notes.
  -- Ask Mr. Dopp, Cost of Your Future, Weight Control Quest, name requests, sprite admin, duplicates,
  -- visitors and every roster-changing tool are refused. The two *_set tools are "pretend saves"
  -- (rolled back like everything else) so the Save buttons show the demo note.
  teacher_ok constant text[] := array[
    'verify_teacher_pass', 'teacher_class_list', 'term_preview',
    'cl_teacher_config_get', 'cl_teacher_roster', 'cl_teacher_evidence', 'cl_teacher_config_set',
    'briefing_teacher_get', 'briefing_teacher_set',
    'pet_teacher_summary', 'trail_teacher_teams'];
begin
  if not exists (select 1 from public.students s where s.id = p_sid and s.pin_hash = p_pin and s.is_demo) then
    raise exception 'Demo session expired. Sign in again as the demo account.';
  end if;
  if p_fn is null or p_fn !~ '^[a-z][a-z0-9_]*$' or p_fn like 'demo%' or p_fn like 'pin_reset%'
     or p_fn like '%sub_code%' or p_fn like 'host_%' or p_fn in ('start_new_trimester', 'create_live_session',
       'create_student_profile', 'reset_student_progress', 'teacher_summary_lock') then
    raise exception 'That feature is turned off in the demo.';
  end if;
  if jsonb_typeof(v_args) <> 'object' then raise exception 'bad request'; end if;
  select coalesce(array_agg(k), '{}') into v_keys from jsonb_object_keys(v_args) k;

  -- pick the overload whose inputs match the arguments sent
  for f in
    select p.oid, p.proname, p.proretset, p.prorettype, p.pronargs, p.pronargdefaults,
           p.proargnames, p.proargmodes, p.proallargtypes, p.proargtypes::oid[] intypes
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = p_fn and p.prokind = 'f'
       and has_function_privilege('anon', p.oid, 'EXECUTE')
     order by p.pronargs desc
  loop
    in_names := '{}'; tbl_cols := '{}';
    if f.proargmodes is null then
      in_names := coalesce(f.proargnames[1:f.pronargs], '{}');
    else
      for i in 1..array_length(f.proargmodes, 1) loop
        if f.proargmodes[i] in ('i', 'b', 'v') then in_names := in_names || f.proargnames[i];
        elsif f.proargmodes[i] = 't' then tbl_cols := tbl_cols || f.proargnames[i]; end if;
      end loop;
    end if;
    -- every key must be a parameter, and every parameter without a default must be sent
    if v_keys <@ in_names
       and in_names[1:(f.pronargs - f.pronargdefaults)] <@ (v_keys || array['p_teacher_pass']) then
      v_found := true; exit;
    end if;
  end loop;
  if not v_found then raise exception 'That feature is not available in the demo (%).', p_fn; end if;

  if 'p_teacher_pass' = any(in_names) or 'p_pass' = any(in_names) then
    if not (p_fn = any(teacher_ok)) then raise exception 'That teacher tool is turned off in the demo.'; end if;
    if 'p_pass' = any(in_names) then raise exception 'That teacher tool is turned off in the demo.'; end if;
    v_teacher := true;
    v_tok := 'demo-' || gen_random_uuid()::text;
    v_args := v_args || jsonb_build_object('p_teacher_pass', v_tok);
  end if;

  in_types := f.intypes;
  for i in 1..coalesce(array_length(in_names, 1), 0) loop
    nm := in_names[i];
    if not (v_args ? nm) then continue; end if;
    typ := format_type(in_types[i], null);
    parts := parts || case
      when typ = 'jsonb' then format('%I => ($1->%L)', nm, nm)
      when typ = 'json'  then format('%I => ($1->%L)::json', nm, nm)
      when typ like '%[]' then format('%I => (select array_agg(x) from jsonb_array_elements_text($1->%L) x)::%s', nm, nm, typ)
      else format('%I => ($1->>%L)::%s', nm, nm, typ) end;
  end loop;
  v_call := format('public.%I(%s)', p_fn, array_to_string(parts, ', '));

  if f.prorettype = 'void'::regtype then
    v_sql := format('select null::jsonb from %s', v_call);
  elsif f.proretset and coalesce(array_length(tbl_cols, 1), 0) = 1 then
    v_sql := format('select coalesce(jsonb_agg(jsonb_build_object(%L, t)), ''[]''::jsonb) from %s t', tbl_cols[1], v_call);
  elsif f.proretset then
    v_sql := format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from %s t', v_call);
  else
    v_sql := format('select to_jsonb(t) from %s t', v_call);
  end if;

  -- run it, then ALWAYS roll the sub-transaction back
  begin
    if v_teacher then
      update public.live_teacher_key set pass_hash = extensions.crypt(v_tok, extensions.gen_salt('bf', 4)) where id = 1;
    end if;
    execute v_sql into v_res using v_args;
    raise exception using errcode = 'DEMO1', message = 'demo rollback';
  exception
    when sqlstate 'DEMO1' then null;
    when others then
      get stacked diagnostics v_msg = message_text, v_state = returned_sqlstate, v_det = pg_exception_detail, v_hint = pg_exception_hint;
      v_err := true;
  end;
  if v_err then
    raise exception using errcode = v_state, message = v_msg, detail = coalesce(v_det, ''), hint = coalesce(v_hint, '');
  end if;

  return public._demo_mask(v_res);
end $$;
revoke all on function public.demo_call(uuid, text, text, jsonb) from public;
grant execute on function public.demo_call(uuid, text, text, jsonb) to anon, authenticated;

-- ---------- 6. hide demo students from public galleries ----------
create or replace function public.pet_gallery(p_trimester text)
 returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare sid uuid; out jsonb;
begin
  for sid in select p.student_id from public.student_pets p where p.trimester = p_trimester loop
    perform public._pet_tick(sid);
  end loop;
  select coalesce(jsonb_agg(public._pet_view(p, false)
           || jsonb_build_object('owner', coalesce(nullif(btrim(s.display_name), ''), 'Student'), 'sid', s.id)
         order by p.alive desc, p.health desc, p.streak desc, p.care_points desc), '[]'::jsonb)
    into out
  from public.student_pets p join public.students s on s.id = p.student_id
  where p.trimester = p_trimester and not s.is_demo;
  return out;
end $function$;

create or replace function public.pet_fallen(p_trimester text, p_days integer default 14)
 returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare sid uuid; out jsonb;
begin
  for sid in select p.student_id from public.student_pets p where p.trimester = p_trimester and p.alive loop
    perform public._pet_tick(sid);
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', d.pet_name, 'color', d.color,
           'owner', coalesce(nullif(btrim(s.display_name), ''), 'Student'),
           'died_at', d.died_at, 'revived', d.revived_at is not null)
         order by d.died_at desc), '[]'::jsonb)
    into out
  from (select * from public.pet_deaths
         where trimester = p_trimester
           and died_at > now() - make_interval(days => least(greatest(coalesce(p_days, 14), 1), 60))
         order by died_at desc limit 30) d
  join public.students s on s.id = d.student_id
  where not s.is_demo;
  return out;
end $function$;

create or replace function public.get_leaderboard_data(p_trimester text)
 returns table(id uuid, display_name text, avatar text, class_code text, task_count bigint, day_dates date[])
 language sql security definer set search_path to 'public' as $function$
  select s.id, s.display_name, s.avatar, s.class_code,
    count(distinct qp.task_key)::bigint as task_count,
    coalesce(array_agg(distinct ad.day_date order by ad.day_date)
      filter (where ad.day_date is not null and public._real_day(ad.student_id, ad.day_date)), array[]::date[]) as day_dates
  from students s
  left join quest_progress qp on qp.student_id = s.id
  left join active_days ad on ad.student_id = s.id
  where s.trimester = p_trimester and not s.is_demo
  group by s.id, s.display_name, s.avatar, s.class_code
  order by task_count desc, display_name asc;
$function$;
