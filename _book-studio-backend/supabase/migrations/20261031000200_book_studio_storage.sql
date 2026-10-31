-- =====================================================================
-- Circumpunct Book Studio — private Storage buckets
--   manuscripts : uploaded .docx masters (owner only, 2FA required)
--   audio       : future server-generated chapter audio (owner only)
-- Both buckets are private (public = false): there are no public URLs.
-- Files are only reachable with the owner's session or a short-lived
-- signed URL created by that session.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('bs-manuscripts', 'bs-manuscripts', false, 26214400,
     array['application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('bs-audio', 'bs-audio', false, 209715200,
     array['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy studio_owner_select on storage.objects for select to authenticated
  using (bucket_id in ('bs-manuscripts', 'bs-audio') and public.bs_is_owner());

create policy studio_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('bs-manuscripts', 'bs-audio') and public.bs_is_owner());

-- No UPDATE policy: uploaded masters cannot be overwritten in place.
-- Deleting is allowed only for audio (regenerable); manuscript uploads are kept.
create policy studio_owner_delete_audio on storage.objects for delete to authenticated
  using (bucket_id = 'bs-audio' and public.bs_is_owner());
