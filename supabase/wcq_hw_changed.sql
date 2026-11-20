-- ============================================================
-- Weight Control Quest: height/weight changed flags for the teacher
-- dashboard (student changed locked height/weight = half points).
-- Separate from get_weight_control_quest_teacher_summary so that
-- function stays untouched. Same teacher passphrase check.
-- ============================================================

create or replace function public.get_wcq_hw_flags(p_trimester text, p_teacher_pass text)
returns table(student_name text, class_code text, hw_changed boolean, hw_first text, hw_now text)
language plpgsql security definer set search_path to 'public' as $$
#variable_conflict use_column
begin
  if not exists (select 1 from public.live_teacher_key k
                 where k.pass_hash = extensions.crypt(coalesce(p_teacher_pass, ''), k.pass_hash)) then
    raise exception 'Wrong teacher passphrase';
  end if;

  return query
  select
    s.display_name as student_name,
    s.class_code,
    coalesce(w.draft_data #>> '{body,hwChanged}', 'false') = 'true' as hw_changed,
    case when w.draft_data #> '{body,hwOrig}' is not null then
      (w.draft_data #>> '{body,hwOrig,ft}') || '′' || (w.draft_data #>> '{body,hwOrig,inch}') || '″ ' || (w.draft_data #>> '{body,hwOrig,lb}') || ' lb' end as hw_first,
    case when w.draft_data #> '{body,hwLock}' is not null then
      (w.draft_data #>> '{body,hwLock,ft}') || '′' || (w.draft_data #>> '{body,hwLock,inch}') || '″ ' || (w.draft_data #>> '{body,hwLock,lb}') || ' lb' end as hw_now
  from public.students s
  join public.weight_control_quest_progress w
    on w.student_id = s.id
   and w.trimester = s.trimester
  where s.trimester = p_trimester;
end $$;

grant execute on function public.get_wcq_hw_flags(text, text) to anon, authenticated;
