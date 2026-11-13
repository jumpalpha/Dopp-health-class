-- Classwork v5 (run after classwork_v4.sql). Safe to re-run.
-- The page no longer holds an answer key. When answers may be shown, the test result sends the answer hashes
-- for the missed fact questions and the page matches them to a choice. Reasoning answers are never sent.
create or replace function public.cw_test_submit(p_student_id uuid, p_pin_hash text, p_trimester text, p_unit int, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare reveal boolean; r public.cw_work; k jsonb; i int := 0; qid text; right_n int := 0; total int; score int; misses jsonb := '[]'; ans text; best int; cur jsonb;
begin
  if not public._cw_ok(p_student_id, p_pin_hash, p_trimester) then raise exception 'Classwork is not open yet'; end if;
  r := public._cw_row(p_student_id, p_trimester, p_unit);
  k := r.test_key; if k is null then raise exception 'Start the test first'; end if;
  total := jsonb_array_length(k->'ids');
  for qid in select x from jsonb_array_elements_text(k->'ids') x loop
    ans := p_answers->>i;
    if ans is not null and left(md5(lower(btrim(ans))), 12) = (select h from public.cw_bank where id = qid) then right_n := right_n + 1;
    else misses := misses || to_jsonb(qid); end if;
    i := i + 1;
  end loop;
  score := round(100.0 * right_n / greatest(total, 1))::int;
  if k->>'kind' = 'unit' then
    update public.cw_work set test_key = null, last_try = last_try || jsonb_build_object('U', now()), unit_best = greatest(unit_best, score), unit_tries = unit_tries + 1, updated_at = now()
     where student_id = p_student_id and trimester = p_trimester and unit = p_unit returning * into r;
    best := r.unit_best; reveal := best >= public._cw_rule('unit_pass') or r.unit_tries >= 3;
  else
    cur := coalesce(r.ch_test->(k->>'ch'), '{}');
    best := greatest(coalesce((cur->>'best')::int, 0), score);
    reveal := best >= 80 or coalesce((cur->>'tries')::int, 0) + 1 >= 3;
    update public.cw_work set test_key = null, updated_at = now(), last_try = last_try || jsonb_build_object('T' || (k->>'ch'), now()),
           ch_test = ch_test || jsonb_build_object(k->>'ch', jsonb_build_object('best', best, 'tries', coalesce((cur->>'tries')::int, 0) + 1))
     where student_id = p_student_id and trimester = p_trimester and unit = p_unit returning * into r;
  end if;
  return jsonb_build_object('kind', k->>'kind', 'chapter', k->'ch', 'score', score, 'right', right_n, 'total', total, 'best', best,
                            'passed', k->>'kind' <> 'unit' or best >= public._cw_rule('unit_pass'),
                            'misses', misses, 'reveal', reveal,
                            'keys', case when reveal then (select coalesce(jsonb_object_agg(id, h), '{}') from public.cw_bank where kind = 'recall' and id in (select jsonb_array_elements_text(misses))) else '{}' end,
                            'no_answer', (select coalesce(jsonb_agg(id), '[]') from public.cw_bank where kind = 'reason' and id in (select jsonb_array_elements_text(misses))), 'work', public._cw_view(r));
end $$;
