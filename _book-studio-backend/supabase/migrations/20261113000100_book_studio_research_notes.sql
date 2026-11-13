-- Research notes: owner-only notes that sit beside the manuscript (not part of it).
-- Used for research handoffs (e.g. the Sierpinski / "33" investigation) and kept in
-- sync weekly with Claude's project notes by a scheduled task.
-- Additive only: touches no existing table.

create table public.bs_research_notes (
  id          uuid primary key default gen_random_uuid(),
  manuscript_id uuid references public.bs_manuscripts (id),
  title       text not null check (length(title) between 1 and 300),
  body        text not null default '' check (length(body) <= 200000),
  status      text not null default 'open'
              check (status in ('open', 'verified', 'integrated', 'archived')),
  tags        text[] not null default '{}',
  source      text not null default 'owner' check (source in ('owner', 'claude', 'import')),
  sync_key    text unique,               -- stable id used by the weekly sync to match notes
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid()
);

alter table public.bs_research_notes enable row level security;

create policy owner_all on public.bs_research_notes for all to authenticated
  using (public.bs_is_owner())
  with check (public.bs_is_owner());

create or replace function public.bs_research_notes_touch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.bs_write_audit('research_delete', 'research_notes', old.id, jsonb_build_object('title', old.title));
    return old;
  end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    perform public.bs_write_audit('research_update', 'research_notes', new.id,
      jsonb_build_object('title', new.title, 'status', new.status));
  else
    perform public.bs_write_audit('research_create', 'research_notes', new.id,
      jsonb_build_object('title', new.title, 'source', new.source));
  end if;
  return new;
end;
$$;

create trigger research_notes_touch
  before insert or update or delete on public.bs_research_notes
  for each row execute function public.bs_research_notes_touch();

revoke all on public.bs_research_notes from anon, authenticated, public;
revoke all on function public.bs_research_notes_touch() from anon, authenticated, public;
grant select, insert, update, delete on public.bs_research_notes to authenticated;
