-- ============================================================
-- Visitor tools for the Teacher Dashboard. Safe to re-run.
-- * visitor_list(): every visitor account in the current trimester, with last visit,
--   the day it will be removed (90 days after last visit), arcade games played and
--   whether they have a sprite. Teacher passphrase only.
-- * visitor_remove(): delete ONE visitor account (and its scores, XP and sprite).
--   Refuses anyone who is not a visitor, so a class student can never be removed here.
-- Needs _teacher_ok (term_rollover.sql) and _is_visitor (arcade_boards.sql).
-- ============================================================

create or replace function public.visitor_list(p_teacher_pass text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t text;
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'Wrong teacher passphrase'; end if;
  select trimester into t from public.site_term where id = 1;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id,
      'name', btrim(s.display_name) || ' ' || btrim(s.last_name),
      'joined', s.created_at,
      'last_seen', coalesce(s.last_seen, s.created_at),
      'expires', coalesce(s.last_seen, s.created_at) + interval '90 days',
      'plays', coalesce((select sum(a.plays) from public.arcade_scores a where a.student_id = s.id), 0),
      'sprite', exists (select 1 from public.student_pets p where p.student_id = s.id)
    ) order by coalesce(s.last_seen, s.created_at) desc)
    from public.students s
    where s.trimester = t and public._is_visitor(s.class_code)
  ), '[]'::jsonb);
end $$;

create or replace function public.visitor_remove(p_teacher_pass text, p_student_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'Wrong teacher passphrase'; end if;
  select class_code into c from public.students where id = p_student_id;
  if c is null then return false; end if;
  if not public._is_visitor(c) then raise exception 'Only visitor accounts can be removed here'; end if;
  delete from public.students where id = p_student_id;
  return true;
end $$;

revoke all on function public.visitor_list(text) from public;
revoke all on function public.visitor_remove(text, uuid) from public;
grant execute on function public.visitor_list(text) to anon, authenticated;
grant execute on function public.visitor_remove(text, uuid) to anon, authenticated;
