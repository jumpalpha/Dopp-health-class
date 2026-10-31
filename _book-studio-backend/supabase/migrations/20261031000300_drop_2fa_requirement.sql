-- Owner request 2026-10-31: sign in with password only (no 2FA step).
-- Access now requires: signed in AND listed in bs_owners. See THREAT_MODEL.md.
create or replace function public.bs_is_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
     and exists (select 1 from public.bs_owners o where o.user_id = auth.uid());
$$;
