-- ============================================================
-- Demo account seed: creates "Jason" (class TEST) and
-- gives him a realistic ~65% trimester by copying the progress
-- records of one anonymous real student. Copied: reading, vocab,
-- mastery, arcade, trail, sprite, care days, XP, checklist ticks.
-- NOT copied (personal work): Cost of Your Future answers/images,
-- teacher notes, live-game sessions, Ask Mr. Dopp, name requests.
-- Run after demo_account.sql and permanent_students.sql. Safe to re-run (it rebuilds Jason).
-- ============================================================
set local app.demo_admin = 'on';

do $$
declare
  src constant uuid := '6a5db80b-301e-420a-8bdf-159aca16393d';   -- source student (identity not copied)
  tri constant text := '2026-T1';
  jid uuid;
begin
  select id into jid from public.students where is_demo and class_code = 'TEST' and lower(last_name) = 'demo' and trimester = tri;
  if jid is not null then
    delete from public.checklist_events where student_id = jid;
    delete from public.checklist_manual where student_id = jid;
    delete from public.checklist_verify where student_id = jid;
    delete from public.mastery_attempts where student_id = jid;
    delete from public.arcade_scores where student_id = jid;
    delete from public.trail_daily where student_id = jid;
    delete from public.trail_runs where student_id = jid;
    delete from public.student_pets where student_id = jid;
    delete from public.pet_care_days where student_id = jid;
    delete from public.xp_events where student_id = jid;
    delete from public.quest_progress where student_id = jid;
    delete from public.active_days where student_id = jid;
    delete from public.weight_control_quest_progress where student_id = jid;
    delete from public.student_project_data where student_id = jid;
  else
    insert into public.students (class_code, last_name, display_name, pin_hash, avatar, trimester, is_demo)
    values ('TEST', 'Demo', 'Jason',
            encode(extensions.digest('__DEMO_PIN__' || 'https://gmeyamrlqfrabtslsweu.supabase.co', 'sha256'), 'hex'),
            '🛡', tri, true)
    returning id into jid;
  end if;
  update public.students set permanent = true where id = jid;   -- never expires (permanent_students.sql)

  insert into public.checklist_events (student_id, trimester, kind, chapter, item, n, meta, first_at, last_at)
    select jid, trimester, kind, chapter, item, n, meta, first_at, last_at from public.checklist_events where student_id = src and trimester = tri;
  insert into public.checklist_manual (student_id, trimester, key, checked, updated_at)
    select jid, trimester, key, checked, updated_at from public.checklist_manual where student_id = src and trimester = tri;
  insert into public.checklist_verify (student_id, trimester, item, status, note, updated_at)
    select jid, trimester, item, status, null, updated_at from public.checklist_verify where student_id = src and trimester = tri;
  insert into public.mastery_attempts (student_id, trimester, chapter, questions, current, correct, started_at, finished_at, passed)
    select jid, trimester, chapter, questions, current, correct, started_at, finished_at, passed from public.mastery_attempts where student_id = src and trimester = tri;
  insert into public.arcade_scores (student_id, trimester, game, best, wins, plays, updated_at)
    select jid, trimester, game, best, wins, plays, updated_at from public.arcade_scores where student_id = src and trimester = tri;
  insert into public.trail_daily (student_id, day, miles)
    select jid, day, miles from public.trail_daily where student_id = src;
  insert into public.trail_runs (student_id, trimester, run_no, status, miles, state, score, started_at, updated_at, finished_at)
    select jid, trimester, run_no, status, miles, state, score, started_at, updated_at, finished_at from public.trail_runs where student_id = src and trimester = tri;
  insert into public.student_pets (student_id, trimester, name, color, born_at, food, energy, mood, clean, health, alive, died_at, deaths,
                                   revive_progress, care_points, junk_total, streak, best_streak, streak_date, day_date, day_counts,
                                   last_tick, updated_at, renamed_at, knowledge, knowledge_total, owned, equipped, immortal)
    select jid, trimester, 'Sparky', color, born_at, food, energy, mood, clean, health, alive, died_at, deaths,
           revive_progress, care_points, junk_total, streak, best_streak, streak_date, day_date, day_counts,
           last_tick, updated_at, null, knowledge, knowledge_total, owned, equipped, true
      from public.student_pets where student_id = src and trimester = tri;
  insert into public.pet_care_days (student_id, trimester, day, habits, quiz, backfill)
    select jid, trimester, day, habits, quiz, backfill from public.pet_care_days where student_id = src and trimester = tri;
  insert into public.xp_events (student_id, trimester, source, ref, xp, created_at)
    select jid, trimester, source, ref, xp, created_at from public.xp_events where student_id = src and trimester = tri;
  insert into public.quest_progress (student_id, task_key, completed_at)
    select jid, task_key, completed_at from public.quest_progress where student_id = src;
  insert into public.active_days (student_id, day_date)
    select jid, day_date from public.active_days where student_id = src;
  insert into public.weight_control_quest_progress (student_id, trimester, draft_data, stage_completed, is_submitted, submitted_at, updated_at)
    select jid, trimester, '{}'::jsonb, stage_completed, is_submitted, submitted_at, updated_at from public.weight_control_quest_progress where student_id = src and trimester = tri;
  insert into public.student_project_data (student_id, trimester, project_key, data, updated_at)
    select jid, trimester, project_key, data, updated_at from public.student_project_data
     where student_id = src and trimester = tri and project_key = 'quick_checks';
end $$;
