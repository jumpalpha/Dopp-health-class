-- Light track for chapters 17–28 (2026-11-18). Applied live. Rollback: re-run the defs in bk_light_track_20261118.
-- 1. _cl_bundle(): adds 'learn' = Classwork Learn best % per chapter (the Checklist's light-track item).
-- 2. _cw_ch_open(): chapters 17–28 open from the start in any order (1–16 still unlock in order).
-- Checklist (checklist.js): from 2026-T2, chapters 17–28 are required: read + Classwork Learn 80% + Mastery.
-- 2026-T1 is unchanged (light_required = false), so no T1 grades move.
create or replace function public._cw_ch_open(p_unit integer, p_lb jsonb, p_ch integer)
 returns boolean language sql stable set search_path to 'public', 'extensions'
as $b$
  select p_ch = any(public._cw_chapters(p_unit))
     and (p_ch >= 17 or coalesce(bool_and(public._cw_learn_ok(p_unit, p_lb, c)), true))
    from unnest(public._cw_chapters(p_unit)) c where c < p_ch;
$b$;
-- _cl_bundle: inserted before 'bonus':
--   'learn', (select coalesce(jsonb_object_agg(e.key, e.value), '{}') from public.cw_work w, jsonb_each(coalesce(w.learn_best, '{}'::jsonb)) e
--             where w.student_id = p_student and w.trimester = p_trimester),
