-- ============================================================
-- Name changes. Safe to re-run. Additive only.
--   * Students ask to change their first name / nickname on the Quest page.
--     The change happens only after the teacher approves it on the Teacher Dashboard.
--     (Last name is never changed here: it's part of how students sign in.)
--   * Students can rename their Wellness Sprite themselves, at most once every 7 days.
-- Same pattern as the rest of the site: RLS on, no policies, SECURITY DEFINER functions.
-- ============================================================

create table if not exists public.name_requests (
  id          bigserial primary key,
  student_id  uuid not null references public.students(id) on delete cascade,
  trimester   text not null,
  old_name    text not null,
  new_name    text not null check (char_length(new_name) between 1 and 20),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);
alter table public.name_requests enable row level security;
create unique index if not exists name_requests_one_pending on public.name_requests (student_id) where status = 'pending';

alter table public.student_pets add column if not exists renamed_at timestamptz;

-- ---------- student: ask for a new name (replaces any request still waiting) ----------
create or replace function public.name_request(p_student_id uuid, p_pin_hash text, p_trimester text, p_new_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.students; n text := btrim(regexp_replace(coalesce(p_new_name, ''), '\s+', ' ', 'g'));
begin
  select * into s from public.students where id = p_student_id and pin_hash = p_pin_hash and trimester = p_trimester;
  if s.id is null then raise exception 'Login expired — sign in again'; end if;
  if char_length(n) < 1 or char_length(n) > 20 then raise exception 'Names can be 1 to 20 characters'; end if;
  if n !~ '^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .''-]*$' then raise exception 'Use letters only (spaces, hyphens and apostrophes are OK)'; end if;
  if n = s.display_name then raise exception 'That is already your name'; end if;
  delete from public.name_requests where student_id = s.id and status = 'pending';
  insert into public.name_requests (student_id, trimester, old_name, new_name) values (s.id, p_trimester, s.display_name, n);
  return jsonb_build_object('ok', true, 'status', 'pending', 'new_name', n);
end $$;

-- ---------- student: what happened to my latest request? ----------
create or replace function public.name_request_status(p_student_id uuid, p_pin_hash text, p_trimester text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.students where id = p_student_id and pin_hash = p_pin_hash and trimester = p_trimester) then
    raise exception 'Login expired — sign in again';
  end if;
  return (select jsonb_build_object('status', status, 'new_name', new_name, 'at', coalesce(decided_at, created_at))
            from public.name_requests where student_id = p_student_id order by created_at desc limit 1);
end $$;

-- ---------- student: cancel a waiting request ----------
create or replace function public.name_request_cancel(p_student_id uuid, p_pin_hash text, p_trimester text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.students where id = p_student_id and pin_hash = p_pin_hash and trimester = p_trimester) then
    raise exception 'Login expired — sign in again';
  end if;
  delete from public.name_requests where student_id = p_student_id and status = 'pending';
  return jsonb_build_object('ok', true);
end $$;

-- ---------- teacher: list waiting requests (and the last 20 decisions) ----------
create or replace function public.name_requests_list(p_teacher_pass text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  return jsonb_build_object(
    'pending', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'old', r.old_name, 'new', r.new_name, 'last', s.last_name,
                                  'code', s.class_code, 'at', r.created_at) order by r.created_at), '[]')
                  from public.name_requests r join public.students s on s.id = r.student_id where r.status = 'pending'),
    'recent', (select coalesce(jsonb_agg(x order by x->>'at' desc), '[]') from (
                 select jsonb_build_object('old', r.old_name, 'new', r.new_name, 'last', s.last_name, 'status', r.status, 'at', r.decided_at) x
                   from public.name_requests r join public.students s on s.id = r.student_id
                  where r.status <> 'pending' order by r.decided_at desc limit 20) t));
end $$;

-- ---------- teacher: approve or deny ----------
create or replace function public.name_request_decide(p_teacher_pass text, p_id bigint, p_approve boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.name_requests;
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  select * into r from public.name_requests where id = p_id and status = 'pending' for update;
  if r.id is null then raise exception 'That request was already handled'; end if;
  if p_approve then
    update public.students set display_name = r.new_name where id = r.student_id;
  end if;
  update public.name_requests set status = case when p_approve then 'approved' else 'denied' end, decided_at = now() where id = r.id;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- student: rename sprite, once every 7 days ----------
create or replace function public.pet_rename(p_student_id uuid, p_pin_hash text, p_trimester text, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.student_pets; n text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
begin
  if not public._pet_auth(p_student_id, p_pin_hash, p_trimester) then raise exception 'Login expired'; end if;
  select * into r from public.student_pets where student_id = p_student_id for update;
  if r.student_id is null then raise exception 'Hatch a sprite first'; end if;
  if char_length(n) < 1 or char_length(n) > 16 then raise exception 'Sprite names can be 1 to 16 characters'; end if;
  if n = r.name then raise exception 'That is already your sprite''s name'; end if;
  if r.renamed_at is not null and r.renamed_at > now() - interval '7 days' then
    raise exception 'You can rename your sprite again on %', to_char((r.renamed_at + interval '7 days') at time zone 'America/Denver', 'Dy Mon DD');
  end if;
  update public.student_pets set name = n, renamed_at = now(), updated_at = now() where student_id = p_student_id returning * into r;
  return public._pet_view(r, true) || jsonb_build_object('renamed_at', r.renamed_at);
end $$;

-- when can I rename next? (null = now)
create or replace function public.pet_rename_next(p_student_id uuid, p_pin_hash text, p_trimester text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare t timestamptz;
begin
  if not public._pet_auth(p_student_id, p_pin_hash, p_trimester) then raise exception 'Login expired'; end if;
  select renamed_at + interval '7 days' into t from public.student_pets where student_id = p_student_id;
  return case when t is null or t <= now() then null else t end;
end $$;

grant execute on function public.name_request(uuid, text, text, text) to anon, authenticated;
grant execute on function public.name_request_status(uuid, text, text) to anon, authenticated;
grant execute on function public.name_request_cancel(uuid, text, text) to anon, authenticated;
grant execute on function public.name_requests_list(text) to anon, authenticated;
grant execute on function public.name_request_decide(text, bigint, boolean) to anon, authenticated;
grant execute on function public.pet_rename(uuid, text, text, text) to anon, authenticated;
grant execute on function public.pet_rename_next(uuid, text, text) to anon, authenticated;
