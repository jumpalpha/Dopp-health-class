-- ============================================================
-- Lock the Weight Control Quest teacher summary behind the
-- teacher passphrase (same one used for live games).
-- Replaces the old version that only needed a trimester.
-- Returns the same columns as before.
-- ============================================================

drop function if exists public.get_weight_control_quest_teacher_summary(text);

create or replace function public.get_weight_control_quest_teacher_summary(
  p_trimester text, p_teacher_pass text)
returns table(student_name text, class_code text, trimester text,
              stage_completed integer, is_submitted boolean,
              submitted_at timestamptz, updated_at timestamptz, try_count integer)
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
    s.trimester,
    coalesce(w.stage_completed, 0) as stage_completed,
    coalesce(w.is_submitted, false) as is_submitted,
    w.submitted_at,
    w.updated_at,
    case
      when try_counts.try_count_text ~ '^[0-9]+$'
        then try_counts.try_count_text::int
      else null
    end as try_count
  from public.students s
  left join public.weight_control_quest_progress w
    on w.student_id = s.id
   and w.trimester = s.trimester
  cross join lateral (
    select coalesce(
      w.draft_data #>> '{tryCount}',
      w.draft_data #>> '{reality,tryCount}'
    ) as try_count_text
  ) try_counts
  where s.trimester = p_trimester
  order by s.class_code, s.display_name;
end $$;

-- Yes/no check used by the teacher dashboard unlock screen.
create or replace function public.verify_teacher_pass(p_teacher_pass text)
returns boolean
language sql security definer set search_path to 'public' as $$
  select exists (select 1 from public.live_teacher_key k
                 where k.pass_hash = extensions.crypt(coalesce(p_teacher_pass, ''), k.pass_hash));
$$;
