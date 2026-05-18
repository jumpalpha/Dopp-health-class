-- Weight Control Quest Supabase setup
-- Run in Supabase Dashboard -> SQL Editor -> New query.
-- This file creates cloud saving for weight-control-quest.html.
-- It does not use or expose any service-role keys.

create table if not exists public.weight_control_quest_progress (
  student_id      uuid not null references public.students(id) on delete cascade,
  trimester       text not null,
  draft_data      jsonb not null default '{}'::jsonb,
  stage_completed int not null default 0,
  is_submitted    boolean not null default false,
  submitted_at    timestamptz,
  updated_at      timestamptz not null default now(),
  primary key (student_id, trimester)
);

alter table public.weight_control_quest_progress enable row level security;

revoke all on table public.weight_control_quest_progress from anon;
revoke all on table public.weight_control_quest_progress from authenticated;

-- Keep direct table access closed. Students should read/write through the
-- PIN-verified RPC functions below.

create or replace function public.get_weight_control_quest_progress(
  p_student_id uuid,
  p_pin_hash text,
  p_trimester text
)
returns table (
  student_id uuid,
  trimester text,
  draft_data jsonb,
  stage_completed int,
  is_submitted boolean,
  submitted_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $function$
  select
    w.student_id,
    w.trimester,
    w.draft_data,
    w.stage_completed,
    w.is_submitted,
    w.submitted_at,
    w.updated_at
  from public.weight_control_quest_progress w
  where w.student_id = p_student_id
    and w.trimester = p_trimester
    and exists (
      select 1
      from public.students s
      where s.id = p_student_id
        and s.pin_hash = p_pin_hash
        and s.trimester = p_trimester
    );
$function$;

create or replace function public.save_weight_control_quest_progress(
  p_student_id uuid,
  p_pin_hash text,
  p_trimester text,
  p_draft_data jsonb,
  p_stage_completed int,
  p_is_submitted boolean
)
returns table (
  student_id uuid,
  trimester text,
  draft_data jsonb,
  stage_completed int,
  is_submitted boolean,
  submitted_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $function$
  insert into public.weight_control_quest_progress (
    student_id,
    trimester,
    draft_data,
    stage_completed,
    is_submitted,
    submitted_at,
    updated_at
  )
  select
    p_student_id,
    p_trimester,
    coalesce(p_draft_data, '{}'::jsonb),
    greatest(0, least(coalesce(p_stage_completed, 0), 5)),
    coalesce(p_is_submitted, false),
    case when coalesce(p_is_submitted, false) then now() else null end,
    now()
  where exists (
    select 1
    from public.students s
    where s.id = p_student_id
      and s.pin_hash = p_pin_hash
      and s.trimester = p_trimester
  )
  on conflict (student_id, trimester) do update set
    draft_data = excluded.draft_data,
    stage_completed = excluded.stage_completed,
    is_submitted = excluded.is_submitted,
    submitted_at = case
      when excluded.is_submitted = true
        then coalesce(public.weight_control_quest_progress.submitted_at, now())
      else public.weight_control_quest_progress.submitted_at
    end,
    updated_at = now()
  returning
    weight_control_quest_progress.student_id,
    weight_control_quest_progress.trimester,
    weight_control_quest_progress.draft_data,
    weight_control_quest_progress.stage_completed,
    weight_control_quest_progress.is_submitted,
    weight_control_quest_progress.submitted_at,
    weight_control_quest_progress.updated_at;
$function$;

grant execute on function public.get_weight_control_quest_progress(uuid, text, text) to anon, authenticated;
grant execute on function public.save_weight_control_quest_progress(uuid, text, text, jsonb, int, boolean) to anon, authenticated;

create or replace function public.get_weight_control_quest_teacher_summary(
  p_trimester text
)
returns table (
  student_name text,
  class_code text,
  trimester text,
  stage_completed int,
  is_submitted boolean,
  submitted_at timestamptz,
  updated_at timestamptz,
  try_count int
)
language sql
security definer
set search_path = public
as $function$
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
$function$;

revoke execute on function public.get_weight_control_quest_teacher_summary(text) from public;
grant execute on function public.get_weight_control_quest_teacher_summary(text) to anon, authenticated;
