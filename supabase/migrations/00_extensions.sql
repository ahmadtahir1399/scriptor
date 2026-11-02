-- ============================================================================
-- 00_extensions.sql — extensions required by the rest of the schema.
-- ============================================================================
-- Supabase convention: extensions live in the `extensions` schema, not `public`,
-- so they never collide with application objects and never appear in the
-- generated TypeScript types.
-- ============================================================================

create schema if not exists extensions;

-- gen_random_uuid() for every primary key, and digest() for idempotency keys.
create extension if not exists pgcrypto with schema extensions;

-- Case-insensitive text, used for email columns so two accounts can never
-- differ only by capitalisation.
create extension if not exists citext with schema extensions;

-- Scheduler for reap_stale_jobs(). Without this a crashed worker wedges a job
-- in GENERATING forever and the analysis never completes.
--
-- pg_cron can only be installed into the `cron` schema and only by a superuser.
-- On a hosted Supabase project this succeeds; on a bare local Postgres it may
-- not, so the failure is trapped and reported as a notice rather than aborting
-- the whole migration run.
do $$
begin
  create extension if not exists pg_cron;
exception
  when insufficient_privilege or undefined_file then
    raise notice 'pg_cron unavailable — reap_stale_jobs() will need an external scheduler.';
end
$$;
