-- ============================================================================
-- 19_retention_cron.sql — account-level analysis defaults + the retention sweep.
-- ============================================================================
-- Numbered 19 because 17 (page dimensions) and 18 (analysis cost) already exist.
--
-- Two jobs:
--   1. Add the account-level defaults the Settings page controls. These did not
--      exist on `profiles` (which deliberately holds no role and little else), so
--      they are added here — the one schema change P12 needs.
--   2. Best-effort-schedule the retention purge. The purge itself runs in app
--      code (it must delete STORAGE objects, which SQL cannot), inside the
--      existing worker route — reusing the worker + its Vercel cron rather than
--      inventing a second scheduler. The pg_cron entry below is a belt-and-braces
--      fallback for deployments without the Vercel cron; it is wrapped so a
--      missing pg_cron / pg_net never fails this migration or the app.
-- ============================================================================

alter table public.profiles
  add column if not exists apply_custom_checks_by_default boolean not null default true,
  add column if not exists default_auto_delete            boolean not null default true;

comment on column public.profiles.apply_custom_checks_by_default is
  'Pre-selects the student''s custom requirements on new uploads.';
comment on column public.profiles.default_auto_delete is
  'Account default for the 90-day source-document purge on new uploads.';

-- Widen the owner-update column grant to include the two new preference columns.
-- The existing "profiles: update own" RLS policy already scopes writes to the
-- owner; this only extends WHICH columns an owner may set. id, email and roles
-- remain unwritable — email change is a separate verified flow, roles live in
-- user_roles with no user write policy at all.
grant update (
  full_name,
  avatar_url,
  locale,
  institution_id,
  apply_custom_checks_by_default,
  default_auto_delete
) on public.profiles to authenticated;

-- Best-effort schedule. Wrapped exactly like reap_stale_jobs() in 12_jobs.sql:
-- if pg_cron or pg_net is unavailable (as on a local stack) the app worker still
-- runs the purge on its own cadence, so this failing changes nothing.
do $$
begin
  perform cron.schedule(
    'scriptor-retention-purge',
    '17 3 * * *', -- daily at 03:17; the worker also sweeps continuously
    $cron$
      select net.http_post(
        url     := current_setting('app.worker_url', true) || '/api/worker',
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'x-worker-secret', current_setting('app.worker_secret', true)
        ),
        body    := '{}'::jsonb
      );
    $cron$
  );
exception
  when others then
    raise notice 'pg_cron/pg_net unavailable — retention purge runs via the app worker instead.';
end;
$$;
