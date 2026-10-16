-- ============================================================
-- Teacher sprite management (Teacher Dashboard → Manage sprites). Safe to re-run. Additive only.
--   * List every sprite in the current trimester with its owner.
--   * Rename any sprite (does NOT use up the student's weekly rename).
--   * Delete a sprite: the student hatches a new one next visit.
--     Sprite care history (pet_care_days) is kept, so checklist credit isn't lost.
-- Teacher passphrase required for all three.
-- ============================================================

create or replace function public.sprite_admin_list(p_teacher_pass text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  select trimester into t from public.site_term limit 1;
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'id', p.student_id, 'name', p.name, 'color', p.color, 'alive', p.alive,
            'first', s.display_name, 'last', s.last_name, 'code', s.class_code, 'born', p.born_at)
          order by s.class_code, s.last_name, s.display_name), '[]'::jsonb)
          from public.student_pets p join public.students s on s.id = p.student_id
          where p.trimester = t);
end $$;

create or replace function public.sprite_admin_rename(p_teacher_pass text, p_student_id uuid, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  if char_length(n) < 1 or char_length(n) > 16 then raise exception 'Sprite names can be 1 to 16 characters'; end if;
  update public.student_pets set name = n, updated_at = now() where student_id = p_student_id;
  if not found then raise exception 'That sprite no longer exists'; end if;
  return jsonb_build_object('ok', true, 'name', n);
end $$;

create or replace function public.sprite_admin_delete(p_teacher_pass text, p_student_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  delete from public.student_pets where student_id = p_student_id;
  if not found then raise exception 'That sprite no longer exists'; end if;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.sprite_admin_list(text) to anon, authenticated;
grant execute on function public.sprite_admin_rename(text, uuid, text) to anon, authenticated;
grant execute on function public.sprite_admin_delete(text, uuid) to anon, authenticated;
