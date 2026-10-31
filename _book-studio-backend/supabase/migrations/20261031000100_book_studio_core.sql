-- =====================================================================
-- Circumpunct Book Studio — core private schema
-- Target: a DEDICATED Supabase project (NOT the dopp-health-class project,
-- which holds student data). Never run this against the class project.
--
-- Security model (see _book-studio-backend/docs/THREAT_MODEL.md):
--   * Only users listed in studio_owners can read or write anything.
--   * The session must have completed 2FA (JWT claim aal = 'aal2').
--   * anon has no table privileges at all; RLS denies everyone else.
--   * Masters, chapter versions and the audit log are append-only
--     (triggers block UPDATE/DELETE even for the owner).
--   * Current chapter text changes ONLY through approve_proposal() or
--     rollback_chapter(), which record a new immutable version.
--   * Privileged RPCs are rate-limited per user.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Owner allowlist + assurance check
-- ---------------------------------------------------------------------
create table public.studio_owners (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (select 1 from public.studio_owners o where o.user_id = auth.uid());
$$;

-- Lets the login shell ask "is this signed-in account an owner?" without
-- revealing anything else. Returns false for everyone who is not.
create or replace function public.whoami()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'owner_listed', exists (select 1 from public.studio_owners o where o.user_id = auth.uid()),
    'aal',          coalesce(auth.jwt() ->> 'aal', 'none')
  );
$$;

-- ---------------------------------------------------------------------
-- Rate limiting (fixed window, per user, per bucket)
-- ---------------------------------------------------------------------
create table public.rate_limit_rules (
  bucket       text primary key,
  max_calls    int      not null check (max_calls > 0),
  window_secs  int      not null check (window_secs > 0)
);

insert into public.rate_limit_rules (bucket, max_calls, window_secs) values
  ('approve',  60, 3600),
  ('rollback', 20, 3600),
  ('import',   10, 3600),
  ('export',   30, 3600),
  ('propose', 200, 3600);

create table public.rate_limit_hits (
  user_id      uuid not null,
  bucket       text not null references public.rate_limit_rules (bucket),
  window_start timestamptz not null,
  calls        int not null default 0,
  primary key (user_id, bucket, window_start)
);

create or replace function public.consume_rate_limit(p_bucket text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r      public.rate_limit_rules;
  w      timestamptz;
  n      int;
begin
  if not public.is_owner() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select * into r from public.rate_limit_rules where bucket = p_bucket;
  if not found then
    raise exception 'unknown rate-limit bucket %', p_bucket;
  end if;
  w := to_timestamp(floor(extract(epoch from now()) / r.window_secs) * r.window_secs);
  insert into public.rate_limit_hits as h (user_id, bucket, window_start, calls)
       values (auth.uid(), p_bucket, w, 1)
  on conflict (user_id, bucket, window_start) do update set calls = h.calls + 1
  returning calls into n;
  if n > r.max_calls then
    raise exception 'rate limit exceeded for %', p_bucket using errcode = 'P0429';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Audit log (append-only)
-- ---------------------------------------------------------------------
create table public.audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor      uuid,
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  detail     jsonb not null default '{}'::jsonb
);

create or replace function public.write_audit(p_action text, p_entity text, p_id uuid, p_detail jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values (auth.uid(), p_action, p_entity, p_id, coalesce(p_detail, '{}'::jsonb));
$$;

-- ---------------------------------------------------------------------
-- Manuscript, immutable dated masters
-- ---------------------------------------------------------------------
create table public.manuscripts (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  created_at timestamptz not null default now()
);

create table public.masters (
  id              uuid primary key default gen_random_uuid(),
  manuscript_id   uuid not null references public.manuscripts (id),
  label           text not null,
  master_date     date not null,
  source_filename text,
  storage_path    text,
  sha256          text,
  word_count      int,
  created_at      timestamptz not null default now(),
  created_by      uuid default auth.uid()
);

create table public.master_chapters (
  master_id  uuid not null references public.masters (id),
  chapter_no int  not null check (chapter_no between 0 and 999),
  title      text not null,
  body       text not null,
  primary key (master_id, chapter_no)
);

-- ---------------------------------------------------------------------
-- Current chapters + immutable version history
-- ---------------------------------------------------------------------
create table public.chapters (
  id                 uuid primary key default gen_random_uuid(),
  manuscript_id      uuid not null references public.manuscripts (id),
  chapter_no         int  not null check (chapter_no between 0 and 999),
  title              text not null,
  body               text not null,
  current_version_id uuid,
  updated_at         timestamptz not null default now(),
  unique (manuscript_id, chapter_no)
);

create table public.chapter_versions (
  id          uuid primary key default gen_random_uuid(),
  chapter_id  uuid not null references public.chapters (id),
  version_no  int  not null,
  title       text not null,
  body        text not null,
  source      text not null check (source in ('master', 'approved_proposal', 'rollback')),
  proposal_id uuid,
  master_id   uuid references public.masters (id),
  note        text,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  unique (chapter_id, version_no)
);

alter table public.chapters
  add constraint chapters_current_version_fk
  foreign key (current_version_id) references public.chapter_versions (id) deferrable initially deferred;

-- ---------------------------------------------------------------------
-- Proposed changes (from the owner, Claude, or a future ChatGPT integration)
-- ---------------------------------------------------------------------
create table public.proposals (
  id              uuid primary key default gen_random_uuid(),
  chapter_id      uuid not null references public.chapters (id),
  base_version_id uuid not null references public.chapter_versions (id),
  proposed_title  text not null,
  proposed_body   text not null,
  rationale       text,
  author_label    text not null default 'owner' check (author_label in ('owner', 'claude', 'chatgpt', 'import')),
  status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at      timestamptz not null default now(),
  created_by      uuid default auth.uid(),
  decided_at      timestamptz,
  decided_by      uuid
);

alter table public.chapter_versions
  add constraint chapter_versions_proposal_fk
  foreign key (proposal_id) references public.proposals (id);

-- ---------------------------------------------------------------------
-- Editorial comments, reading progress, bookmarks
-- ---------------------------------------------------------------------
create table public.annotations (
  id           uuid primary key default gen_random_uuid(),
  chapter_id   uuid not null references public.chapters (id),
  version_id   uuid not null references public.chapter_versions (id),
  start_offset int  not null check (start_offset >= 0),
  end_offset   int  not null check (end_offset > start_offset),
  quote        text not null check (length(quote) <= 5000),
  comment      text not null check (length(comment) between 1 and 20000),
  resolved     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid not null default auth.uid()
);

create table public.reading_state (
  user_id    uuid primary key default auth.uid(),
  chapter_id uuid references public.chapters (id),
  scroll_pct real not null default 0 check (scroll_pct between 0 and 1),
  updated_at timestamptz not null default now()
);

create table public.bookmarks (
  id         uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters (id),
  char_offset int not null default 0 check (char_offset >= 0),
  label      text check (length(label) <= 200),
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid()
);

-- ---------------------------------------------------------------------
-- Append-only enforcement
-- ---------------------------------------------------------------------
create or replace function public.forbid_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% on % is not allowed: this record is immutable', tg_op, tg_table_name
    using errcode = '42501';
end;
$$;

create trigger masters_immutable          before update or delete on public.masters          for each row execute function public.forbid_change();
create trigger master_chapters_immutable  before update or delete on public.master_chapters  for each row execute function public.forbid_change();
create trigger chapter_versions_immutable before update or delete on public.chapter_versions for each row execute function public.forbid_change();
create trigger audit_log_immutable        before update or delete on public.audit_log        for each row execute function public.forbid_change();

-- Annotations: keep updated_at honest and log comment edits.
create or replace function public.annotations_touch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    new.created_by := old.created_by;
    new.chapter_id := old.chapter_id;
    new.version_id := old.version_id;
    perform public.write_audit('annotation_update', 'annotations', new.id,
      jsonb_build_object('old_comment', old.comment, 'new_comment', new.comment, 'resolved', new.resolved));
    return new;
  elsif tg_op = 'DELETE' then
    perform public.write_audit('annotation_delete', 'annotations', old.id,
      jsonb_build_object('quote', old.quote, 'comment', old.comment));
    return old;
  end if;
  return new;
end;
$$;

create trigger annotations_touch before update or delete on public.annotations
  for each row execute function public.annotations_touch();

-- ---------------------------------------------------------------------
-- Privileged operations (the only way text changes)
-- ---------------------------------------------------------------------
create or replace function public.require_owner()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_owner() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.next_version_no(p_chapter uuid)
returns int
language sql
security definer
set search_path = ''
as $$
  select coalesce(max(version_no), 0) + 1 from public.chapter_versions where chapter_id = p_chapter;
$$;

create or replace function public.approve_proposal(p_proposal uuid, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  p   public.proposals;
  c   public.chapters;
  vid uuid;
begin
  perform public.require_owner();
  perform public.consume_rate_limit('approve');

  select * into p from public.proposals where id = p_proposal for update;
  if not found then raise exception 'proposal not found'; end if;
  if p.status <> 'pending' then raise exception 'proposal is already %', p.status; end if;

  select * into c from public.chapters where id = p.chapter_id for update;
  if c.current_version_id is distinct from p.base_version_id then
    raise exception 'conflict: chapter changed since this proposal was written; re-base it first'
      using errcode = '40001';
  end if;

  insert into public.chapter_versions (chapter_id, version_no, title, body, source, proposal_id, note)
  values (c.id, public.next_version_no(c.id), p.proposed_title, p.proposed_body, 'approved_proposal', p.id, p_note)
  returning id into vid;

  update public.chapters
     set title = p.proposed_title, body = p.proposed_body, current_version_id = vid, updated_at = now()
   where id = c.id;

  update public.proposals
     set status = 'approved', decided_at = now(), decided_by = auth.uid()
   where id = p.id;

  perform public.write_audit('approve_proposal', 'chapters', c.id,
    jsonb_build_object('proposal', p.id, 'from_version', c.current_version_id, 'to_version', vid, 'author', p.author_label));
  return vid;
end;
$$;

create or replace function public.reject_proposal(p_proposal uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare p public.proposals;
begin
  perform public.require_owner();
  select * into p from public.proposals where id = p_proposal for update;
  if not found then raise exception 'proposal not found'; end if;
  if p.status <> 'pending' then raise exception 'proposal is already %', p.status; end if;
  update public.proposals set status = 'rejected', decided_at = now(), decided_by = auth.uid() where id = p.id;
  perform public.write_audit('reject_proposal', 'proposals', p.id, jsonb_build_object('note', p_note));
end;
$$;

-- Rollback never deletes history: it copies an older version forward as a new version.
create or replace function public.rollback_chapter(p_chapter uuid, p_to_version uuid, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c   public.chapters;
  v   public.chapter_versions;
  vid uuid;
begin
  perform public.require_owner();
  perform public.consume_rate_limit('rollback');
  select * into c from public.chapters where id = p_chapter for update;
  if not found then raise exception 'chapter not found'; end if;
  select * into v from public.chapter_versions where id = p_to_version and chapter_id = p_chapter;
  if not found then raise exception 'version does not belong to this chapter'; end if;

  insert into public.chapter_versions (chapter_id, version_no, title, body, source, note)
  values (c.id, public.next_version_no(c.id), v.title, v.body, 'rollback',
          coalesce(p_note, 'Rolled back to version ' || v.version_no))
  returning id into vid;

  update public.chapters set title = v.title, body = v.body, current_version_id = vid, updated_at = now()
   where id = c.id;

  perform public.write_audit('rollback', 'chapters', c.id,
    jsonb_build_object('from_version', c.current_version_id, 'restored', v.id, 'new_version', vid));
  return vid;
end;
$$;

-- Called by the import-docx edge function WITH THE OWNER'S OWN JWT (no service key).
-- Always records a new immutable master. First import seeds the chapters;
-- later imports create pending proposals for every changed chapter instead
-- of overwriting current text.
create or replace function public.import_master(
  p_title           text,
  p_label           text,
  p_master_date     date,
  p_source_filename text,
  p_storage_path    text,
  p_sha256          text,
  p_chapters        jsonb   -- [{ "chapter_no": 1, "title": "...", "body": "..." }, ...]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m_id      uuid;
  ms_id     uuid;
  ch        jsonb;
  c         public.chapters;
  vid       uuid;
  words     int := 0;
  seeded    int := 0;
  proposed  int := 0;
  unchanged int := 0;
begin
  perform public.require_owner();
  perform public.consume_rate_limit('import');

  if jsonb_typeof(p_chapters) <> 'array' or jsonb_array_length(p_chapters) = 0 then
    raise exception 'no chapters found in import';
  end if;
  if jsonb_array_length(p_chapters) > 200 then
    raise exception 'too many chapters (%); check the heading detection', jsonb_array_length(p_chapters);
  end if;

  select id into ms_id from public.manuscripts order by created_at limit 1;
  if ms_id is null then
    insert into public.manuscripts (title) values (p_title) returning id into ms_id;
  end if;

  select coalesce(sum(array_length(regexp_split_to_array(trim(x ->> 'body'), '\s+'), 1)), 0)
    into words from jsonb_array_elements(p_chapters) x;

  insert into public.masters (manuscript_id, label, master_date, source_filename, storage_path, sha256, word_count)
  values (ms_id, p_label, p_master_date, p_source_filename, p_storage_path, p_sha256, words)
  returning id into m_id;

  for ch in select * from jsonb_array_elements(p_chapters) loop
    insert into public.master_chapters (master_id, chapter_no, title, body)
    values (m_id, (ch ->> 'chapter_no')::int, ch ->> 'title', ch ->> 'body');

    select * into c from public.chapters
     where manuscript_id = ms_id and chapter_no = (ch ->> 'chapter_no')::int for update;

    if not found then
      insert into public.chapters (manuscript_id, chapter_no, title, body)
      values (ms_id, (ch ->> 'chapter_no')::int, ch ->> 'title', ch ->> 'body')
      returning * into c;
      insert into public.chapter_versions (chapter_id, version_no, title, body, source, master_id, note)
      values (c.id, 1, c.title, c.body, 'master', m_id, 'Seeded from master ' || p_label)
      returning id into vid;
      update public.chapters set current_version_id = vid where id = c.id;
      seeded := seeded + 1;
    elsif c.body is distinct from (ch ->> 'body') or c.title is distinct from (ch ->> 'title') then
      insert into public.proposals (chapter_id, base_version_id, proposed_title, proposed_body, rationale, author_label)
      values (c.id, c.current_version_id, ch ->> 'title', ch ->> 'body', 'Imported from ' || coalesce(p_source_filename, p_label), 'import');
      proposed := proposed + 1;
    else
      unchanged := unchanged + 1;
    end if;
  end loop;

  perform public.write_audit('import_master', 'masters', m_id,
    jsonb_build_object('label', p_label, 'file', p_source_filename, 'words', words,
                       'seeded', seeded, 'proposed', proposed, 'unchanged', unchanged));
  return jsonb_build_object('master_id', m_id, 'words', words, 'seeded', seeded, 'proposed', proposed, 'unchanged', unchanged);
end;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security: owner (with 2FA) only. Everyone else gets nothing.
-- ---------------------------------------------------------------------
alter table public.studio_owners    enable row level security;
alter table public.rate_limit_rules enable row level security;
alter table public.rate_limit_hits  enable row level security;
alter table public.audit_log        enable row level security;
alter table public.manuscripts      enable row level security;
alter table public.masters          enable row level security;
alter table public.master_chapters  enable row level security;
alter table public.chapters         enable row level security;
alter table public.chapter_versions enable row level security;
alter table public.proposals        enable row level security;
alter table public.annotations      enable row level security;
alter table public.reading_state    enable row level security;
alter table public.bookmarks        enable row level security;

-- Read access
create policy owner_read on public.manuscripts      for select to authenticated using (public.is_owner());
create policy owner_read on public.masters          for select to authenticated using (public.is_owner());
create policy owner_read on public.master_chapters  for select to authenticated using (public.is_owner());
create policy owner_read on public.chapters         for select to authenticated using (public.is_owner());
create policy owner_read on public.chapter_versions for select to authenticated using (public.is_owner());
create policy owner_read on public.proposals        for select to authenticated using (public.is_owner());
create policy owner_read on public.audit_log        for select to authenticated using (public.is_owner());

-- Proposals: owner may insert pending proposals against the CURRENT version only.
create policy owner_propose on public.proposals for insert to authenticated
  with check (
    public.is_owner()
    and status = 'pending'
    and decided_at is null and decided_by is null
    and created_by = auth.uid()
    and base_version_id = (select ch.current_version_id from public.chapters ch where ch.id = chapter_id)
  );

-- Annotations, reading state, bookmarks: owner full CRUD on own rows.
create policy owner_all on public.annotations for all to authenticated
  using (public.is_owner() and created_by = auth.uid())
  with check (public.is_owner() and created_by = auth.uid());
create policy owner_all on public.reading_state for all to authenticated
  using (public.is_owner() and user_id = auth.uid())
  with check (public.is_owner() and user_id = auth.uid());
create policy owner_all on public.bookmarks for all to authenticated
  using (public.is_owner() and created_by = auth.uid())
  with check (public.is_owner() and created_by = auth.uid());

-- studio_owners, rate_limit_* : no policies => no client access at all.

-- ---------------------------------------------------------------------
-- Privileges: anon gets NOTHING. authenticated gets only what RLS then filters.
-- ---------------------------------------------------------------------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

grant select on public.manuscripts, public.masters, public.master_chapters,
                public.chapters, public.chapter_versions, public.proposals,
                public.audit_log
  to authenticated;
grant insert on public.proposals to authenticated;
grant select, insert, update, delete on public.annotations, public.reading_state, public.bookmarks to authenticated;

grant execute on function public.is_owner()                                    to authenticated;
grant execute on function public.whoami()                                      to authenticated;
grant execute on function public.consume_rate_limit(text)                      to authenticated;
grant execute on function public.approve_proposal(uuid, text)                  to authenticated;
grant execute on function public.reject_proposal(uuid, text)                   to authenticated;
grant execute on function public.rollback_chapter(uuid, uuid, text)            to authenticated;
grant execute on function public.import_master(text, text, date, text, text, text, jsonb) to authenticated;

-- Proposals count against a rate limit too.
create or replace function public.proposals_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.consume_rate_limit('propose');
  perform public.write_audit('propose', 'proposals', new.id,
    jsonb_build_object('chapter', new.chapter_id, 'author', new.author_label));
  return new;
end;
$$;

create trigger proposals_rate_limit after insert on public.proposals
  for each row when (new.author_label <> 'import')
  execute function public.proposals_rate_limit();
