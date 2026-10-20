-- STATUS: class_roster + teacher_dup_candidates + student_merge_log APPLIED 2026-10-20; merge functions pasted by teacher in SQL Editor.
-- Student login roster + duplicate-account merge tool (2026-10-20)
-- Paste-safe: re-running replaces the functions; the log table is created once.

-- ---------- login: class list for "tap your name" ----------
create or replace function public.class_roster(p_class_code text, p_trimester text)
returns table(id uuid, display_name text, avatar text, initial text)
language sql stable security definer set search_path = public as $$
  select s.id, btrim(s.display_name), coalesce(s.avatar, '⚔'), upper(left(btrim(s.last_name), 1))
  from public.students s
  where s.class_code = upper(btrim(p_class_code)) and s.trimester = p_trimester
    and exists (select 1 from public.class_codes c where c.code = s.class_code and c.trimester = p_trimester and c.active)
  order by lower(btrim(s.display_name)), upper(left(btrim(s.last_name), 1));
$$;
grant execute on function public.class_roster(text, text) to anon, authenticated;

-- ---------- merge log (what was merged, with a snapshot of the removed account) ----------
create table if not exists public.student_merge_log (
  id bigserial primary key,
  merged_at timestamptz not null default now(),
  keep_id uuid not null,
  drop_id uuid not null,
  drop_row jsonb not null,
  keep_row_before jsonb not null,
  moved jsonb not null default '{}'::jsonb
);
alter table public.student_merge_log enable row level security;   -- no public access

-- ---------- teacher: likely duplicate pairs ----------
-- Same class, and the same first/display name, or one account's "last name" is the other's first name.
create or replace function public.teacher_dup_candidates(p_teacher_pass text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t text;
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'Wrong teacher passphrase'; end if;
  select trimester into t from public.site_term where id = 1;
  return coalesce((
    with s as (
      select st.*, coalesce((select sum(x.xp) from public.xp_events x where x.student_id = st.id and x.trimester = t), 0) as xp,
             (select count(*) from public.active_days d where d.student_id = st.id) as days,
             (select count(*) from public.arcade_scores a where a.student_id = st.id and a.trimester = t) as games,
             (select p.name from public.student_pets p where p.student_id = st.id) as pet
      from public.students st where st.trimester = t and st.class_code !~* 'test'
    ), j as (
      select s1 as a, s2 as b from s s1 join s s2
        on s1.class_code = s2.class_code and s1.id < s2.id
       and (lower(btrim(s1.display_name)) = lower(btrim(s2.display_name))
            or lower(btrim(s1.last_name)) = lower(btrim(s2.display_name))
            or lower(btrim(s2.last_name)) = lower(btrim(s1.display_name)))
    )
    select jsonb_agg(jsonb_build_object(
      'period', public._arcade_group((a).class_code),
      'accounts', jsonb_build_array(
        jsonb_build_object('id', (a).id, 'display', (a).display_name, 'last', (a).last_name, 'created', (a).created_at, 'seen', coalesce((a).last_seen, (a).created_at), 'xp', (a).xp, 'days', (a).days, 'games', (a).games, 'pet', (a).pet,
                           'first_as_last', lower(btrim((a).last_name)) = lower(btrim((a).display_name))),
        jsonb_build_object('id', (b).id, 'display', (b).display_name, 'last', (b).last_name, 'created', (b).created_at, 'seen', coalesce((b).last_seen, (b).created_at), 'xp', (b).xp, 'days', (b).days, 'games', (b).games, 'pet', (b).pet,
                           'first_as_last', lower(btrim((b).last_name)) = lower(btrim((b).display_name))))
    ) order by public._arcade_group((a).class_code), lower((a).display_name))
    from j
  ), '[]'::jsonb);
end $$;
grant execute on function public.teacher_dup_candidates(text) to anon, authenticated;

-- ---------- teacher: merge p_drop INTO p_keep ----------
-- Everything the dropped account earned moves to the kept account, then the dropped account is deleted.
-- The kept account takes the PIN, nickname and avatar of whichever account was used most recently
-- (so the student's current PIN keeps working). Last name: p_last_name if given, else the kept one's.
create or replace function public._merge_students(p_keep uuid, p_drop uuid, p_last_name text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare k public.students; d public.students; recent public.students; mv jsonb := '{}'::jsonb; cnt int;
        kp public.student_pets; dp public.student_pets;
begin
  if p_keep is null or p_drop is null or p_keep = p_drop then raise exception 'Pick two different accounts'; end if;
  select * into k from public.students where id = p_keep for update;
  select * into d from public.students where id = p_drop for update;
  if k.id is null or d.id is null then raise exception 'Account not found'; end if;
  if k.trimester <> d.trimester then raise exception 'Accounts are in different trimesters'; end if;

  -- active days (streak)
  insert into public.active_days (student_id, day_date) select p_keep, day_date from public.active_days where student_id = p_drop on conflict do nothing;
  get diagnostics cnt = row_count; mv := mv || jsonb_build_object('active_days', cnt);
  delete from public.active_days where student_id = p_drop;

  -- arcade: best score wins, plays and wins add up
  insert into public.arcade_scores (student_id, trimester, game, best, wins, plays, updated_at)
    select p_keep, trimester, game, best, wins, plays, updated_at from public.arcade_scores where student_id = p_drop
  on conflict (student_id, trimester, game) do update
    set best = greatest(arcade_scores.best, excluded.best), wins = arcade_scores.wins + excluded.wins,
        plays = arcade_scores.plays + excluded.plays, updated_at = greatest(arcade_scores.updated_at, excluded.updated_at);
  get diagnostics cnt = row_count; mv := mv || jsonb_build_object('arcade_scores', cnt);
  delete from public.arcade_scores where student_id = p_drop;

  -- checklist evidence
  insert into public.checklist_events (student_id, trimester, kind, chapter, item, n, meta, first_at, last_at)
    select p_keep, trimester, kind, chapter, item, n, meta, first_at, last_at from public.checklist_events where student_id = p_drop
  on conflict (student_id, trimester, kind, chapter, item) do update
    set n = checklist_events.n + excluded.n, first_at = least(checklist_events.first_at, excluded.first_at),
        last_at = greatest(checklist_events.last_at, excluded.last_at);
  get diagnostics cnt = row_count; mv := mv || jsonb_build_object('checklist_events', cnt);
  delete from public.checklist_events where student_id = p_drop;

  insert into public.checklist_manual (student_id, trimester, key, checked, updated_at)
    select p_keep, trimester, key, checked, updated_at from public.checklist_manual where student_id = p_drop
  on conflict (student_id, trimester, key) do update
    set checked = checklist_manual.checked or excluded.checked, updated_at = greatest(checklist_manual.updated_at, excluded.updated_at);
  delete from public.checklist_manual where student_id = p_drop;

  insert into public.checklist_verify (student_id, trimester, item, status, note, updated_at)
    select p_keep, trimester, item, status, note, updated_at from public.checklist_verify where student_id = p_drop
  on conflict (student_id, trimester, item) do nothing;
  delete from public.checklist_verify where student_id = p_drop;

  -- sprite care days: keep the higher value for each day
  insert into public.pet_care_days (student_id, trimester, day, habits, quiz, backfill)
    select p_keep, trimester, day, habits, quiz, backfill from public.pet_care_days where student_id = p_drop
  on conflict (student_id, trimester, day) do update
    set habits = greatest(pet_care_days.habits, excluded.habits), quiz = greatest(pet_care_days.quiz, excluded.quiz),
        backfill = pet_care_days.backfill and excluded.backfill;
  delete from public.pet_care_days where student_id = p_drop;

  -- quests: earliest completion wins
  insert into public.quest_progress (student_id, task_key, completed_at)
    select p_keep, task_key, completed_at from public.quest_progress where student_id = p_drop
  on conflict (student_id, task_key) do update set completed_at = least(quest_progress.completed_at, excluded.completed_at);
  get diagnostics cnt = row_count; mv := mv || jsonb_build_object('quest_progress', cnt);
  delete from public.quest_progress where student_id = p_drop;

  -- project data / weight-control quest: keep the more finished / more recent one
  insert into public.student_project_data (student_id, trimester, project_key, data, updated_at)
    select p_keep, trimester, project_key, data, updated_at from public.student_project_data where student_id = p_drop
  on conflict (student_id, trimester, project_key) do update
    set data = case when excluded.updated_at > student_project_data.updated_at then excluded.data else student_project_data.data end,
        updated_at = greatest(student_project_data.updated_at, excluded.updated_at);
  delete from public.student_project_data where student_id = p_drop;

  insert into public.weight_control_quest_progress (student_id, trimester, draft_data, stage_completed, is_submitted, submitted_at, updated_at)
    select p_keep, trimester, draft_data, stage_completed, is_submitted, submitted_at, updated_at from public.weight_control_quest_progress where student_id = p_drop
  on conflict (student_id, trimester) do update
    set draft_data = case when (excluded.is_submitted and not weight_control_quest_progress.is_submitted)
                            or (excluded.is_submitted = weight_control_quest_progress.is_submitted and excluded.stage_completed > weight_control_quest_progress.stage_completed)
                          then excluded.draft_data else weight_control_quest_progress.draft_data end,
        stage_completed = greatest(weight_control_quest_progress.stage_completed, excluded.stage_completed),
        is_submitted = weight_control_quest_progress.is_submitted or excluded.is_submitted,
        submitted_at = coalesce(weight_control_quest_progress.submitted_at, excluded.submitted_at),
        updated_at = greatest(weight_control_quest_progress.updated_at, excluded.updated_at);
  delete from public.weight_control_quest_progress where student_id = p_drop;

  -- surveys: keep the kept account's answer if both answered
  insert into public.survey_answers (survey_id, student_id, trimester, choice, answered_at)
    select survey_id, p_keep, trimester, choice, answered_at from public.survey_answers where student_id = p_drop
  on conflict (survey_id, student_id) do nothing;
  delete from public.survey_answers where student_id = p_drop;

  -- walking trail: keep the higher miles for a day (avoid double counting); team: keep the kept one's
  insert into public.trail_daily (student_id, day, miles) select p_keep, day, miles from public.trail_daily where student_id = p_drop
  on conflict (student_id, day) do update set miles = greatest(trail_daily.miles, excluded.miles);
  delete from public.trail_daily where student_id = p_drop;
  insert into public.trail_members (student_id, trimester, team_id, joined_at)
    select p_keep, trimester, team_id, joined_at from public.trail_members where student_id = p_drop
  on conflict (student_id, trimester) do nothing;
  delete from public.trail_members where student_id = p_drop;
  update public.trail_runs set student_id = p_keep where student_id = p_drop;
  update public.trail_gifts set from_id = p_keep where from_id = p_drop;
  update public.trail_gifts set to_id = p_keep where to_id = p_drop;

  -- XP: one event per ref (first-time rewards are not doubled)
  insert into public.xp_events (student_id, trimester, source, ref, xp, created_at)
    select p_keep, trimester, source, ref, xp, created_at from public.xp_events where student_id = p_drop
  on conflict (student_id, ref) do nothing;
  get diagnostics cnt = row_count; mv := mv || jsonb_build_object('xp_events', cnt);
  delete from public.xp_events where student_id = p_drop;

  -- simple moves
  update public.mastery_attempts set student_id = p_keep where student_id = p_drop;
  get diagnostics cnt = row_count; mv := mv || jsonb_build_object('mastery_attempts', cnt);
  update public.pet_deaths set student_id = p_keep where student_id = p_drop;
  update public.name_requests set student_id = p_keep where student_id = p_drop;
  update public.live_players set student_id = p_keep where student_id = p_drop;
  update public.duel_games set p1_student = p_keep where p1_student = p_drop;
  update public.duel_games set p2_student = p_keep where p2_student = p_drop;

  -- Wellness Sprite: keep the one with more care; owned gear is combined
  select * into kp from public.student_pets where student_id = p_keep;
  select * into dp from public.student_pets where student_id = p_drop;
  if dp.student_id is not null then
    if kp.student_id is null then
      update public.student_pets set student_id = p_keep where student_id = p_drop;
      mv := mv || jsonb_build_object('sprite', 'moved');
    else
      if coalesce(dp.care_points, 0) + coalesce(dp.knowledge_total, 0) > coalesce(kp.care_points, 0) + coalesce(kp.knowledge_total, 0) then
        delete from public.student_pets where student_id = p_keep;
        update public.student_pets set student_id = p_keep where student_id = p_drop;
        update public.student_pets set owned = (select array_agg(distinct x) from unnest(coalesce(dp.owned, '{}') || coalesce(kp.owned, '{}')) x)
         where student_id = p_keep;
        mv := mv || jsonb_build_object('sprite', 'kept ' || coalesce(dp.name, '?'));
      else
        update public.student_pets set owned = (select array_agg(distinct x) from unnest(coalesce(kp.owned, '{}') || coalesce(dp.owned, '{}')) x)
         where student_id = p_keep;
        delete from public.student_pets where student_id = p_drop;
        mv := mv || jsonb_build_object('sprite', 'kept ' || coalesce(kp.name, '?'));
      end if;
    end if;
  end if;

  -- account details: PIN, nickname, avatar from the most recently used account
  recent := case when coalesce(d.last_seen, d.created_at) > coalesce(k.last_seen, k.created_at) then d else k end;
  insert into public.student_merge_log (keep_id, drop_id, drop_row, keep_row_before, moved)
    values (p_keep, p_drop, to_jsonb(d), to_jsonb(k), mv);
  delete from public.students where id = p_drop;      -- cascades anything left over
  update public.students set
      pin_hash = recent.pin_hash, display_name = recent.display_name, avatar = recent.avatar,
      last_name = coalesce(nullif(btrim(p_last_name), ''), k.last_name),
      created_at = least(k.created_at, d.created_at),
      last_seen = greatest(coalesce(k.last_seen, k.created_at), coalesce(d.last_seen, d.created_at))
    where id = p_keep;
  return jsonb_build_object('ok', true, 'kept', p_keep, 'name', recent.display_name,
                            'last_name', coalesce(nullif(btrim(p_last_name), ''), k.last_name), 'moved', mv);
end $$;
revoke all on function public._merge_students(uuid, uuid, text) from public, anon, authenticated;

create or replace function public.teacher_merge_students(p_teacher_pass text, p_keep uuid, p_drop uuid, p_last_name text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'Wrong teacher passphrase'; end if;
  return public._merge_students(p_keep, p_drop, p_last_name);
end $$;
grant execute on function public.teacher_merge_students(text, uuid, uuid, text) to anon, authenticated;
