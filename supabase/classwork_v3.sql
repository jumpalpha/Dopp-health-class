-- Classwork v3 patch (run after classwork_v2.sql). Safe to re-run.
-- Stories per chapter = 3, or fewer when a chapter has too few story-safe words (each story needs 2 new ones).
-- The "no story" swap is only offered when the chapter has a spare story-safe word.
create or replace function public._cw_okwords(p_unit int, p_ch int) returns int language sql stable as $$
  select count(*)::int from public.cw_terms where unit = p_unit and chapter = p_ch and story_ok;
$$;
create or replace function public._cw_need(p_unit int, p_ch int) returns int language sql stable as $$
  select least(3, public._cw_okwords(p_unit, p_ch) / 2);
$$;

create or replace function public._cw_avg2(p_unit int, p_ch jsonb) returns int language sql stable as $$
  select case when (select bool_and(coalesce((select count(*) from jsonb_array_elements(coalesce(p_ch->(c::text), '[]')) e
                                              where jsonb_typeof(e) = 'object'), 0) >= public._cw_need(p_unit, c))
                      from unnest(public._cw_chapters(p_unit)) c)
              then round((select avg((e->'score'->>'total')::numeric)
                            from unnest(public._cw_chapters(p_unit)) c, jsonb_array_elements(p_ch->(c::text)) e
                           where jsonb_typeof(e) = 'object'))::int end;
$$;

create or replace function public._cw_story_slot_ok(p_unit int, p_ch int, p_slot int) returns boolean language sql stable as $$
  select p_slot >= 0 and p_slot < public._cw_need(p_unit, p_ch);
$$;

create or replace function public.cw_story_save2(p_student_id uuid, p_pin_hash text, p_trimester text, p_unit int, p_ch int,
                                                 p_slot int, p_a int, p_b int, p_text text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.cw_work; ta public.cw_terms; tb public.cw_terms; sc jsonb; opened timestamptz; i int; arr jsonb;
begin
  if not public._cw_ok(p_student_id, p_pin_hash, p_trimester) then raise exception 'Classwork is not open yet'; end if;
  if not public._cw_story_slot_ok(p_unit, p_ch, p_slot) then raise exception 'bad story'; end if;
  r := public._cw_row(p_student_id, p_trimester, p_unit);
  if r.status = 'submitted' then raise exception 'Already submitted. Ask Mr. Dopp to return it if you need to change something.'; end if;
  if not public._cw_ch_open(p_unit, r.learn_best, p_ch) or not public._cw_learn_ok(p_unit, r.learn_best, p_ch) then
    raise exception 'Pass Learn (80%%) for this chapter first'; end if;
  if p_a = p_b then raise exception 'Pick two different words'; end if;
  select * into ta from public.cw_terms where unit = p_unit and n = p_a and chapter = p_ch;
  select * into tb from public.cw_terms where unit = p_unit and n = p_b and chapter = p_ch;
  if ta.term is null or tb.term is null then raise exception 'Pick two words from this chapter'; end if;
  if not ta.story_ok or not tb.story_ok then raise exception 'That word can''t be used for a story'; end if;
  if exists (select 1 from jsonb_array_elements(r.swapped) s where (s->>'n')::int in (p_a, p_b)) then
    raise exception 'You already swapped out that word'; end if;
  arr := coalesce(r.ch_stories->(p_ch::text), '[null,null,null]'::jsonb);
  for i in 0 .. 2 loop
    if i <> p_slot and jsonb_typeof(arr->i) = 'object'
       and ((arr->i->>'a')::int in (p_a, p_b) or (arr->i->>'b')::int in (p_a, p_b)) then
      raise exception 'Each story needs 2 new words (you used one already)';
    end if;
  end loop;
  if length(coalesce(p_text, '')) > 3000 then raise exception 'That story is too long'; end if;
  opened := (r.story_open->>(p_ch || ':' || p_slot))::timestamptz;
  if opened is null or now() - opened < make_interval(secs => public._cw_rule('min_seconds')) then
    raise exception 'Take a little more time on your story before saving it';
  end if;
  sc := public._cw_story_score(p_text, ta.term, tb.term);
  arr := jsonb_set(arr, array[p_slot::text], jsonb_build_object('a', p_a, 'b', p_b, 'text', btrim(p_text), 'score', sc, 'saved_at', now()));
  update public.cw_work set ch_stories = ch_stories || jsonb_build_object(p_ch::text, arr), updated_at = now()
   where student_id = p_student_id and trimester = p_trimester and unit = p_unit returning * into r;
  return jsonb_build_object('ok', true, 'score', sc, 'work', public._cw_view(r));
end $$;

create or replace function public.cw_swap2(p_student_id uuid, p_pin_hash text, p_trimester text, p_unit int, p_ch int, p_n int, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.cw_work; arr jsonb; i int;
begin
  if not public._cw_ok(p_student_id, p_pin_hash, p_trimester) then raise exception 'Classwork is not open yet'; end if;
  r := public._cw_row(p_student_id, p_trimester, p_unit);
  if r.status = 'submitted' then raise exception 'Already submitted'; end if;
  if not exists (select 1 from public.cw_terms where unit = p_unit and n = p_n and chapter = p_ch) then raise exception 'No such word'; end if;
  if exists (select 1 from jsonb_array_elements(r.swapped) s where (s->>'n')::int = p_n) then return jsonb_build_object('ok', true, 'work', public._cw_view(r)); end if;
  if public._cw_okwords(p_unit, p_ch) - 2 * public._cw_need(p_unit, p_ch) < 1 then
    raise exception 'This chapter has no spare words, so there is no word swap here'; end if;
  if (select count(*) from jsonb_array_elements(r.swapped) s where (s->>'ch')::int = p_ch) >= public._cw_rule('swaps') then
    raise exception 'You''ve used the word swap for this chapter'; end if;
  if (select count(*) from regexp_split_to_table(btrim(coalesce(p_reason, '')), '\s+') x where x ~ '[A-Za-z]') < 5 then
    raise exception 'Write at least 5 words about why you don''t have a story for this word';
  end if;
  arr := coalesce(r.ch_stories->(p_ch::text), '[]'::jsonb);
  for i in 0 .. 2 loop
    if jsonb_typeof(arr->i) = 'object' and ((arr->i->>'a')::int = p_n or (arr->i->>'b')::int = p_n) then
      raise exception 'That word is already in one of your stories';
    end if;
  end loop;
  update public.cw_work set swapped = swapped || jsonb_build_array(jsonb_build_object('n', p_n, 'ch', p_ch, 'reason', left(btrim(p_reason), 500), 'at', now())),
         updated_at = now()
   where student_id = p_student_id and trimester = p_trimester and unit = p_unit returning * into r;
  return jsonb_build_object('ok', true, 'work', public._cw_view(r));
end $$;
