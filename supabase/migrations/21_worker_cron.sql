-- ============================================================================
-- 21_worker_cron.sql — the worker tick moves from Vercel Cron to pg_cron.
-- ============================================================================
-- Vercel's Hobby plan allows at most ONE cron run per day, so `vercel.json`
-- cannot carry the every-minute tick this queue needs — the deployment is
-- rejected outright. pg_cron has no such cap and ships on every Supabase plan
-- including free, so the schedule moves into the database.
--
-- Nothing about the worker changes. This is still `POST /api/worker` with the
-- `x-worker-secret` header: byte for byte what Vercel Cron was sending and what
-- `kick()` still sends. Only the caller is different, which is why the route
-- needed no edit.
--
-- ---------------------------------------------------------------------------
-- ONE-TIME SETUP — the schedule below is INERT until these two secrets exist.
-- ---------------------------------------------------------------------------
-- Run in the Supabase SQL editor, once per project. Deliberately NOT in this
-- migration: the second value is the key to a service-role endpoint and must
-- never enter git, and `cron.job.command` is readable by anyone holding the
-- postgres role. Vault keeps it encrypted at rest and out of both.
--
--   select vault.create_secret('https://your-app.vercel.app', 'worker_url');
--   select vault.create_secret('<WORKER_SECRET>',             'worker_secret');
--
-- To rotate later (create_secret errors on a duplicate name):
--
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'worker_secret'),
--     '<new value>'
--   );
--
-- `worker_url` is an ORIGIN — no trailing slash, no path; the job appends
-- `/api/worker`. It must match NEXT_PUBLIC_SITE_URL, and `worker_secret` must
-- match WORKER_SECRET in the Vercel environment. A mismatch does not raise
-- anything here: the route answers 401 with an empty body, by design, and the
-- queue simply stops draining. Use the verification queries at the foot of this
-- file after setup rather than assuming it worked.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- pg_net.
-- ----------------------------------------------------------------------------
-- 00_extensions.sql created pg_cron but never pg_net, while 19_retention_cron
-- called net.http_post() on the assumption that it existed. On a project where
-- pg_net was never enabled by hand, that daily job has been failing every night
-- since — silently, into cron.job_run_details, which nothing reads.
--
-- pg_net is not relocatable: it always installs into its own `net` schema, so
-- there is no `with schema extensions` here even though that is the convention
-- everywhere else in this directory.
do $$
begin
  create extension if not exists pg_net;
exception
  when insufficient_privilege or undefined_file then
    raise notice 'pg_net unavailable — the worker tick needs an external scheduler.';
end
$$;

-- ----------------------------------------------------------------------------
-- Retire the daily retention job from 19_retention_cron.sql.
-- ----------------------------------------------------------------------------
-- It posted to the same endpoint for the same reason, and the minute tick below
-- already runs the retention purge on every pass (see app/api/worker/route.ts).
-- Keeping both would mean two schedules racing to POST the same URL. Its own
-- header block called it "a belt-and-braces fallback for deployments without
-- the Vercel cron" — this IS that deployment, so the fallback becomes the
-- primary and the daily duplicate goes away.
do $$
begin
  perform cron.unschedule('scriptor-retention-purge');
exception
  -- Never scheduled, or pg_cron absent. Either way there is nothing to remove.
  when others then
    raise notice 'scriptor-retention-purge was not scheduled; nothing to unschedule.';
end
$$;

-- ----------------------------------------------------------------------------
-- The tick.
-- ----------------------------------------------------------------------------
-- cron.schedule() upserts on job name, so re-running this migration re-points
-- an existing entry rather than stacking a second one.
do $$
begin
  perform cron.schedule(
    'scriptor-worker-tick',
    '* * * * *',
    $cron$
      /*
       * One row or none. When either secret is missing the WHERE eliminates the
       * row and no request is made — a clean no-op instead of the NULL-url
       * error that `current_setting('app.worker_url', true)` produced in
       * 19_retention_cron, where an unset GUC yields NULL and NULL || text is
       * NULL. An unconfigured project should look idle, not broken.
       */
      with cfg as (
        select
          max(decrypted_secret) filter (where name = 'worker_url')    as url,
          max(decrypted_secret) filter (where name = 'worker_secret') as secret
        from vault.decrypted_secrets
        where name in ('worker_url', 'worker_secret')
      )
      select net.http_post(
        url     := cfg.url || '/api/worker',
        headers := jsonb_build_object(
          'content-type',    'application/json',
          'x-worker-secret', cfg.secret
        ),
        body    := '{}'::jsonb,
        /*
         * Long on purpose, and matched to the route's maxDuration rather than
         * to how long we care to wait.
         *
         * pg_net aborts the connection when this elapses, and lib/jobs/kick.ts
         * records what that costs: aborting the request cancels the route's
         * signal mid-drain, so a short timeout does not merely stop waiting —
         * it kills the work in flight. runJobs() drains for up to 240s
         * (DRAIN_BUDGET_MS), so anything under that truncates a real drain and
         * leaves the jobs for reap_stale_jobs() to recover fifteen minutes
         * later.
         *
         * Ticks therefore overlap when a drain runs long, which is safe and was
         * already true of cron-plus-kick: claim_analysis_jobs() uses FOR UPDATE
         * SKIP LOCKED, so a concurrent tick claims nothing and returns at once.
         */
        timeout_milliseconds := 290000
      )
      from cfg
      where cfg.url is not null and cfg.secret is not null;
    $cron$
  );
exception
  when undefined_table or undefined_function or invalid_schema_name then
    raise notice 'pg_cron not available — POST /api/worker from an external scheduler.';
end
$$;

-- ----------------------------------------------------------------------------
-- Keep net._http_response from growing without bound.
-- ----------------------------------------------------------------------------
-- pg_net records every response it collects. At one tick a minute that is ~1440
-- rows a day, forever, on a free-tier disk. Depending on the pg_net version
-- Supabase may already prune this; the delete is idempotent and costs nothing
-- when there is nothing to remove, so running both is harmless.
do $$
begin
  perform cron.schedule(
    'scriptor-prune-http-responses',
    '23 4 * * *',
    $cron$
      delete from net._http_response where created < now() - interval '2 days';
    $cron$
  );
exception
  when others then
    raise notice 'Could not schedule pg_net response pruning; skipping.';
end
$$;

-- ============================================================================
-- VERIFICATION — run these after creating the two vault secrets.
-- ============================================================================
-- 1. Both schedules exist and are active:
--
--      select jobname, schedule, active from cron.job order by jobname;
--
--    Expect scriptor-worker-tick (* * * * *), reap-stale-analysis-jobs
--    (*/5 * * * *) and scriptor-prune-http-responses. NOT scriptor-retention-
--    purge — this migration removed it.
--
-- 2. The last few ticks succeeded *as SQL*. This says the statement ran, not
--    that the HTTP call was accepted:
--
--      select status, return_message, start_time
--      from cron.job_run_details
--      where jobname = 'scriptor-worker-tick'
--      order by start_time desc limit 5;
--
-- 3. What the worker actually answered. THIS is the check that matters — a 401
--    here is a WORKER_SECRET mismatch, and a timeout with status_code null on
--    every row means the URL is wrong or the app is not reachable:
--
--      select status_code, error_msg, created
--      from net._http_response
--      order by created desc limit 5;
--
--    A healthy tick is 200 with {"claimed":0,...} in the body.
-- ============================================================================
