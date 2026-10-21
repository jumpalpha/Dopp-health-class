-- ============================================================
-- Teacher renames a student from the Teacher Dashboard. Safe to re-run. Additive only.
-- * pin_reset_search(): now also matches first names / nicknames and returns first + last
--   separately (the PIN reset card and the rename tool share it).
-- * teacher_rename_student(): change a student's first name (nickname) and/or last name.
--   The last name is how students sign in (class code + last name), so changing it changes
--   their login. Two students in the same class can't share a last name (unique index
--   students_class_name_trimester), so a clash is refused with a clear message.
--   Any pending student name request is closed as approved/replaced so it can't undo this.
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
      'first', btrim(coalesce(s.display_name, '')),
      'last_name', btrim(s.last_name),
      'code', s.class_code,
      'period', public._arcade_group(s.class_code),
      'last_seen', coalesce(s.last_seen, s.created_at)
    ) order by public._arcade_group(s.class_code), s.last_name, s.display_name)
    from public.students s
    where s.trimester = t
      and (lower(btrim(s.last_name)) like q || '%' or lower(btrim(coalesce(s.display_name, ''))) like q || '%')
  ), '[]'::jsonb);
end $$;

create or replace function public.teacher_rename_student(p_teacher_pass text, p_student_id uuid, p_first text, p_last text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t text; s public.students;
  f text := btrim(regexp_replace(coalesce(p_first, ''), '\s+', ' ', 'g'));
  l text := btrim(regexp_replace(coalesce(p_last, ''), '\s+', ' ', 'g'));
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'Wrong teacher passphrase'; end if;
  select trimester into t from public.site_term where id = 1;
  select * into s from public.students where id = p_student_id and trimester = t for update;
  if s.id is null then raise exception 'Could not find that student this trimester'; end if;
  if char_length(f) < 1 or char_length(f) > 20 then raise exception 'First name must be 1 to 20 characters'; end if;
  if char_length(l) < 1 or char_length(l) > 40 then raise exception 'Last name must be 1 to 40 characters'; end if;
  if f !~ '^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .''-]*$' then raise exception 'First name: letters only (spaces, hyphens and apostrophes are OK)'; end if;
  if l !~ '^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .''-]*$' then raise exception 'Last name: letters only (spaces, hyphens and apostrophes are OK)'; end if;
  if lower(l) <> lower(btrim(s.last_name)) and exists (
       select 1 from public.students o where o.class_code = s.class_code and o.trimester = s.trimester
          and lower(o.last_name) = lower(l) and o.id <> s.id) then
    raise exception 'Another student in this class already signs in with the last name "%". Use the duplicate-account merge, or add an initial (e.g. "% J").', l, l;
  end if;
  update public.students set display_name = f, last_name = l where id = s.id;
  update public.name_requests set status = 'denied', decided_at = now() where student_id = s.id and status = 'pending';
  return jsonb_build_object('ok', true, 'first', f, 'last', l,
    'login_changed', lower(l) <> lower(btrim(s.last_name)), 'old_first', s.display_name, 'old_last', s.last_name);
end $$;

revoke all on function public.pin_reset_search(text, text) from public;
revoke all on function public.teacher_rename_student(text, uuid, text, text) from public;
grant execute on function public.pin_reset_search(text, text) to anon, authenticated;
grant execute on function public.teacher_rename_student(text, uuid, text, text) to anon, authenticated;
