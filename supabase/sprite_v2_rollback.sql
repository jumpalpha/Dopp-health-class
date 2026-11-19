-- ============================================================
-- ROLLBACK for sprite_v2.sql (Sprite upgrade, 2026-11-18)
-- Puts every sprite function and the shop back exactly as they were before the upgrade.
-- Uses the backup tables made on 2026-11-18:
--   bk_pet_functions_20261118 (function definitions), bk_pet_items_20261118 (shop),
--   bk_student_pets_20261118 (every sprite as it was; only restored if you uncomment step 3).
-- The new columns (growth_days, growth_date) are left in place; the old code ignores them.
-- Paste into Supabase > SQL Editor > Run.
-- ============================================================

-- 1. functions
do $$
declare f record;
begin
  for f in select def from public.bk_pet_functions_20261118 loop
    execute f.def;
  end loop;
end $$;

-- 2. shop items (drops the Care Kit items, restores old prices and unlocks)
delete from public.pet_items;
insert into public.pet_items select * from public.bk_pet_items_20261118;

-- 3. OPTIONAL: put every sprite's stats back to the 2026-11-18 snapshot (loses progress since then)
-- update public.student_pets p set
--   food = b.food, energy = b.energy, mood = b.mood, clean = b.clean, health = b.health,
--   alive = b.alive, died_at = b.died_at, deaths = b.deaths, revive_progress = b.revive_progress,
--   care_points = b.care_points, knowledge = b.knowledge, knowledge_total = b.knowledge_total,
--   owned = b.owned, equipped = b.equipped, day_counts = b.day_counts, day_date = b.day_date
-- from public.bk_student_pets_20261118 b where b.student_id = p.student_id;

-- To undo only the Extras rework (keep the rest of v2):
-- do $$ declare f record; begin for f in select def from public.bk_pet_functions_20261118b loop execute f.def; end loop; end $$;
