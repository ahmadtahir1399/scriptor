-- ============================================================================
-- 16_storage_realtime.sql — private buckets and the Realtime publication.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Buckets. Both PRIVATE — `public = false`.
--
-- No public URL is generated anywhere in this codebase. Access is exclusively
-- through short-lived signed URLs minted server-side. A thesis is unpublished
-- work that the student has spent a year on; a guessable permanent URL to it
-- would be a serious breach, and public buckets make that a one-line mistake.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'papers',
    'papers',
    false,
    52428800, -- 50 MB
    array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  ),
  (
    'requirements',
    'requirements',
    false,
    10485760, -- 10 MB
    array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  )
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- Storage policies.
--
-- Path convention:
--   papers        {user_id}/{paper_upload_id}/source.pdf
--   requirements  {user_id}/{requirement_file_id}/{filename}
--
-- The first path segment IS the owner. `storage.foldername(name)[1]` extracts
-- it, and comparing that to auth.uid() is the entire access rule — a user can
-- only ever read or write beneath their own prefix.
--
-- No UPDATE policy on `papers`: an uploaded file is immutable, matching the
-- write-once rule on paper_uploads. Replacing a draft means a new upload at a
-- new path.
-- ----------------------------------------------------------------------------

drop policy if exists "papers: insert own prefix"  on storage.objects;
drop policy if exists "papers: select own prefix"  on storage.objects;
drop policy if exists "papers: delete own prefix"  on storage.objects;
drop policy if exists "requirements: insert own prefix" on storage.objects;
drop policy if exists "requirements: select own prefix" on storage.objects;
drop policy if exists "requirements: update own prefix" on storage.objects;
drop policy if exists "requirements: delete own prefix" on storage.objects;

create policy "papers: insert own prefix"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'papers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "papers: select own prefix"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'papers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "papers: delete own prefix"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'papers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "requirements: insert own prefix"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'requirements'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "requirements: select own prefix"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'requirements'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "requirements: update own prefix"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'requirements'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'requirements'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "requirements: delete own prefix"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'requirements'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ----------------------------------------------------------------------------
-- Realtime.
--
-- Exactly three tables. P6's report page subscribes to these so it fills in
-- live as each check finishes, instead of the student staring at a spinner or
-- hammering refresh.
--
-- Nothing else is added: every table in the publication costs WAL decoding work
-- on every write, and `words` alone would flood the socket with 50,000 events
-- per upload.
--
-- Realtime still respects RLS, so a subscriber only receives rows their
-- policies allow. analysis_jobs has no user policy, so its events reach
-- service-role subscribers only — which is what the admin queue monitor uses.
-- ----------------------------------------------------------------------------
do $$
declare
  v_table text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  -- ALTER PUBLICATION ... ADD TABLE errors if the table is already a member,
  -- and a hosted Supabase project may already publish some of these. Guarding
  -- per table keeps `supabase db reset` re-runnable.
  foreach v_table in array array['paper_analyses', 'check_results', 'analysis_jobs']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end
$$;

-- REPLICA IDENTITY FULL so update events carry the previous row. Without it the
-- client receives only changed columns and cannot diff a status transition.
alter table public.paper_analyses replica identity full;
alter table public.check_results  replica identity full;
alter table public.analysis_jobs  replica identity full;
