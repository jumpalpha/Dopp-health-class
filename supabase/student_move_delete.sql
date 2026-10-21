-- ============================================================
-- Move a student to another class period, or delete a student, from the Teacher Dashboard.
-- Safe to re-run. Needs _teacher_ok (term_rollover.sql) and _is_visitor / _arcade_group (arcade_boards.sql).
-- * teacher_class_list():   the current trimester's class periods (no visitor code), for the Move menu.
-- * teacher_move_student():  change ONE student's class code. Progress, XP, sprite, PIN all stay;
--                            leaderboards and Class Wars count them in the new period right away.
--                            The student signs in with the NEW class code from now on.
--                            Refused if someone in the new class already uses that last name.
-- * teacher_delete_student(): permanently delete ONE student and everything of theirs
--                            (XP, scores, sprite, checklist, trail, answers). The teacher must type the
--                            student's last name as a safety check. Cannot be undone.
-- Visitors are not handled here (they have their own Visitors card).
-- ============================================================

create or replace function public.teacher_class_list(p_teacher_pass text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t text;
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'Wrong teacher passphrase'; end if;
  select trimester into t from public.site_term where id = 1;
  return coalesce((
    select jsonb_agg(jsonb_build_object('code', c.code, 'label', coalesce(nullif(btrim(c.label), ''), c.code)) order by c.code)
    from public.class_codes c
    where c.trimester = t and c.active and not public._is_visitor(c.code)
  ), '[]'::jsonb);
end $$;

create or replace function public.teacher_move_student(p_teacher_pass text, p_student_id uuid, p_class_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t text; s public.students; c public.class_codes;
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'Wrong teacher passphrase'; end if;
  select trimester into t from public.site_term where id = 1;
  select * into s from public.students where id = p_student_id and trimester = t for update;
  if s.id is null then raise exception 'Could not find that student this trimester'; end if;
  if public._is_visitor(s.class_code) then raise exception 'Visitors can''t be moved into a class'; end if;
  select * into c from public.class_codes where code = p_class_code and trimester = t and active;
  if c.code is null or public._is_visitor(c.code) then raise exception 'Pick one of this trimester''s class periods'; end if;
  if c.code = s.class_code then raise exception 'They are already in that class'; end if;
  if exists (select 1 from public.students o where o.class_code = c.code and o.trimester = t
               and lower(o.last_name) = lower(s.last_name) and o.id <> s.id) then
    raise exception 'Someone in % already signs in with the last name "%". Rename one of them first (e.g. add an initial).',
      coalesce(nullif(btrim(c.label), ''), c.code), s.last_name;
  end if;
  update public.students set class_code = c.code where id = s.id;
  return jsonb_build_object('ok', true, 'from', s.class_code, 'to', c.code,
    'to_label', coalesce(nullif(btrim(c.label), ''), c.code), 'name', btrim(s.display_name) || ' ' || btrim(s.last_name));
end $$;

create or replace function public.teacher_delete_student(p_teacher_pass text, p_student_id uuid, p_confirm_last text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t text; s public.students;
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'Wrong teacher passphrase'; end if;
  select trimester into t from public.site_term where id = 1;
  select * into s from public.students where id = p_student_id and trimester = t;
  if s.id is null then raise exception 'Could not find that student this trimester'; end if;
  if lower(btrim(coalesce(p_confirm_last, ''))) <> lower(btrim(s.last_name)) then
    raise exception 'Type the student''s last name exactly to confirm';
  end if;
  delete from public.students where id = s.id;   -- cascades to every table keyed by student_id
  return jsonb_build_object('ok', true, 'name', btrim(s.display_name) || ' ' || btrim(s.last_name));
end $$;

revoke all on function public.teacher_class_list(text) from public;
revoke all on function public.teacher_move_student(text, uuid, text) from public;
revoke all on function public.teacher_delete_student(text, uuid, text) from public;
grant execute on function public.teacher_class_list(text) to anon, authenticated;
grant execute on function public.teacher_move_student(text, uuid, text) to anon, authenticated;
grant execute on function public.teacher_delete_student(text, uuid, text) to anon, authenticated;
