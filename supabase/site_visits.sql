-- All-time site visit counter (started 2026-10-13). pwa.js calls site_visit_hit()
-- once per browser tab session on any page; the home page shows the total.
create table if not exists public.site_visits (
  id int primary key default 1 check (id = 1),
  total bigint not null default 0,
  started_at timestamptz not null default now()
);
alter table public.site_visits enable row level security;
insert into public.site_visits (id) values (1) on conflict (id) do nothing;
create or replace function public.site_visit_hit()
returns bigint language sql security definer set search_path = public as $$
  update public.site_visits set total = total + 1 where id = 1 returning total;
$$;
create or replace function public.site_visit_count()
returns bigint language sql stable security definer set search_path = public as $$
  select total from public.site_visits where id = 1;
$$;
revoke all on function public.site_visit_hit() from public;
revoke all on function public.site_visit_count() from public;
grant execute on function public.site_visit_hit() to anon, authenticated;
grant execute on function public.site_visit_count() to anon, authenticated;
