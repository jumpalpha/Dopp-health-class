-- ============================================================
-- Reset a student's PIN from the Teacher Dashboard. Safe to re-run.
-- PINs are only ever stored hashed, so nobody can look one up — the teacher
-- sets a new one instead and tells the student.
-- * pin_reset_search(): find students in the current trimester by last name
--   (any period, visitors included). Teacher passphrase only.
-- * pin_reset_set(): replace ONE student's PIN hash. The page hashes the new
--   PIN the same way the Quest page does, so the plain PIN never leaves the browser.
-- Needs _teacher_ok (term_rollover.sql) and _arcade_group (arcade_boards.sql).
-- ============================================================

create or replace function public.pin_reset_search(p_teacher_pass text, p_last_name text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t text; q text := lower(btrim(coalesce(p_last_name, '')));
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'Wrong teacher passphrase'; end if;
  if length(q) < 2 then return '[]'::jsonb; end if;
  select trimester into t from public.site_term where id = 1;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id,
      'name', btrim(coalesce(s.display_name, '')) || ' ' || btrim(s.last_name),
      'last_name', btrim(s.last_name),
      'period', public._arcade_group(s.class_code),
      'last_seen', coalesce(s.last_seen, s.created_at)
    ) order by public._arcade_group(s.class_code), s.last_name, s.display_name)
    from public.students s
    where s.trimester = t and lower(btrim(s.last_name)) like q || '%'
  ), '[]'::jsonb);
end $$;

create or replace function public.pin_reset_set(p_teacher_pass text, p_student_id uuid, p_pin_hash text)
returns boolean language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'Wrong teacher passphrase'; end if;
  if coalesce(p_pin_hash, '') !~ '^[0-9a-f]{64}$' then raise exception 'Bad PIN hash'; end if;
  select trimester into t from public.site_term where id = 1;
  update public.students set pin_hash = p_pin_hash where id = p_student_id and trimester = t;
  return found;
end $$;

revoke all on function public.pin_reset_search(text, text) from public;
revoke all on function public.pin_reset_set(text, uuid, text) from public;
grant execute on function public.pin_reset_search(text, text) to anon, authenticated;
grant execute on function public.pin_reset_set(text, uuid, text) to anon, authenticated;
