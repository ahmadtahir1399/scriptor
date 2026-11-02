-- ============================================================================
-- 12_jobs.sql — the Postgres-backed work queue and LLM cost ledger.
-- ============================================================================
-- P4 is built entirely on this file. Two workers must never be able to claim
-- the same job, a crashed worker must never wedge one forever, and enqueuing
-- the same logical job twice must be free. Those three properties come from
-- FOR UPDATE SKIP LOCKED, reap_stale_jobs(), and the unique idempotency_key
-- respectively.
-- ============================================================================

create table public.analysis_jobs (
  id                  uuid primary key default gen_random_uuid(),
  paper_analysis_id   uuid not null references public.paper_analyses (id) on delete cascade,
  paper_upload_id     uuid not null references public.paper_uploads (id) on delete cascade,
  user_id             uuid not null references auth.users (id) on delete cascade,

  kind                public.job_kind not null,
  status              public.job_status not null default 'NONE',
  payload             jsonb not null default '{}'::jsonb,

  -- Higher runs first. Compatibility and parse gate everything else, so they
  -- are enqueued at a higher priority than the checks that depend on them.
  priority            integer not null default 0,

  attempts            integer not null default 0 check (attempts >= 0),
  max_attempts        integer not null default 3 check (max_attempts > 0),

  -- Backoff and scheduling. A job is invisible to the claimer until now().
  run_after           timestamptz not null default now(),

  claimed_at          timestamptz,
  claimed_by          text,
  completed_at        timestamptz,
  last_error          text,

  -- Enqueueing the same logical job twice is a no-op, which is what makes the
  -- orchestrator safe to retry wholesale after a partial failure.
  idempotency_key     text not null unique,

  -- Marks a job whose failure must not fail the parent analysis. Optional
  -- features (defense, todos, AI detection) set this.
  is_optional         boolean not null default false,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index analysis_jobs_analysis_idx on public.analysis_jobs (paper_analysis_id);
create index analysis_jobs_upload_idx on public.analysis_jobs (paper_upload_id);
create index analysis_jobs_user_id_idx on public.analysis_jobs (user_id);

-- THE claim index. Must match claim_analysis_jobs()' WHERE and ORDER BY
-- exactly, or every poll degrades into a sequential scan of the queue.
create index analysis_jobs_claimable_idx
  on public.analysis_jobs (priority desc, created_at asc)
  where status = 'NONE';

-- Supports reap_stale_jobs().
create index analysis_jobs_inflight_idx
  on public.analysis_jobs (claimed_at)
  where status = 'GENERATING';

create trigger analysis_jobs_set_user_id
  before insert on public.analysis_jobs
  for each row execute function public.set_user_id_from_paper_analysis();

create trigger analysis_jobs_set_updated_at
  before update on public.analysis_jobs
  for each row execute function public.set_updated_at();

comment on table public.analysis_jobs is
  'Work queue. Service-role only — no user policies. Claimed via FOR UPDATE SKIP LOCKED.';
comment on column public.analysis_jobs.idempotency_key is
  'Unique. Enqueueing the same logical job twice is a no-op, making retries free.';
comment on column public.analysis_jobs.is_optional is
  'When true, permanent failure must not fail the parent analysis.';

-- ----------------------------------------------------------------------------
-- token_usage — per-call LLM cost ledger.
--
-- cached_input_tokens is logged from day one because it is the ONLY way to
-- prove prompt caching is actually working, and caching is the difference
-- between a viable and an unviable cost per analysis. Discovering six months
-- from now that caching silently broke, with no historical baseline to compare
-- against, is a very expensive kind of blind.
-- ----------------------------------------------------------------------------
create table public.token_usage (
  id                    bigint generated always as identity primary key,
  paper_upload_id       uuid references public.paper_uploads (id) on delete cascade,
  paper_analysis_id     uuid references public.paper_analyses (id) on delete cascade,
  analysis_job_id       uuid references public.analysis_jobs (id) on delete set null,
  user_id               uuid references auth.users (id) on delete set null,

  operation             public.llm_operation not null,
  model                 text not null,

  calls                 integer not null default 1 check (calls > 0),
  input_tokens          integer not null default 0 check (input_tokens >= 0),
  cached_input_tokens   integer not null default 0 check (cached_input_tokens >= 0),
  output_tokens         integer not null default 0 check (output_tokens >= 0),
  cost_usd              numeric(12, 6) not null default 0 check (cost_usd >= 0),

  latency_ms            integer check (latency_ms >= 0),
  created_at            timestamptz not null default now()
);

create index token_usage_upload_idx on public.token_usage (paper_upload_id);
create index token_usage_analysis_idx on public.token_usage (paper_analysis_id);
create index token_usage_user_id_idx on public.token_usage (user_id);
create index token_usage_operation_idx on public.token_usage (operation, created_at desc);
create index token_usage_created_at_idx on public.token_usage (created_at desc);

comment on table public.token_usage is
  'Per-call LLM cost ledger. Service-role only. cached_input_tokens proves caching works.';

-- ============================================================================
-- Queue functions
-- ============================================================================

-- ----------------------------------------------------------------------------
-- claim_analysis_jobs() — the heart of the queue.
--
-- FOR UPDATE SKIP LOCKED is what makes concurrent workers safe: each worker
-- locks the rows it selects, and any row already locked by another worker is
-- skipped rather than waited on. Two workers therefore cannot claim the same
-- job, and neither blocks the other.
--
-- The CTE selects and locks in one statement, then the UPDATE flips status in
-- the same transaction. Splitting these into two statements would open a window
-- where a job is selected but not yet claimed.
-- ----------------------------------------------------------------------------
create or replace function public.claim_analysis_jobs(
  p_worker_id   text,
  p_batch_size  integer default 1
)
returns setof public.analysis_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with claimable as (
    select j.id
    from public.analysis_jobs j
    where j.status = 'NONE'
      and j.run_after <= now()
      and j.attempts < j.max_attempts
    order by j.priority desc, j.created_at asc
    limit greatest(p_batch_size, 1)
    for update skip locked
  )
  update public.analysis_jobs j
  set status     = 'GENERATING',
      claimed_at = now(),
      claimed_by = p_worker_id,
      attempts   = j.attempts + 1,
      updated_at = now()
  from claimable c
  where j.id = c.id
  returning j.*;
end;
$$;

comment on function public.claim_analysis_jobs(text, integer) is
  'Atomically claims up to p_batch_size pending jobs. SKIP LOCKED prevents double-claiming.';

-- ----------------------------------------------------------------------------
-- complete_job() — terminal success.
-- ----------------------------------------------------------------------------
create or replace function public.complete_job(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_analysis_id uuid;
begin
  update public.analysis_jobs
  set status       = 'DONE',
      completed_at = now(),
      last_error   = null,
      updated_at   = now()
  where id = p_job_id
  returning paper_analysis_id into v_analysis_id;

  if v_analysis_id is not null then
    perform public.recompute_analysis_status(v_analysis_id);
  end if;
end;
$$;

comment on function public.complete_job(uuid) is 'Marks a job DONE and rolls the parent analysis status forward.';

-- ----------------------------------------------------------------------------
-- fail_job() — failure with exponential backoff.
--
-- While attempts remain, the job goes back to NONE with run_after pushed out by
-- 2^attempts minutes, so a transient provider outage does not burn all three
-- attempts inside ten seconds. Once attempts are exhausted it is ERROR
-- permanently and the parent status is recomputed.
-- ----------------------------------------------------------------------------
create or replace function public.fail_job(p_job_id uuid, p_error text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job          public.analysis_jobs;
  v_is_permanent boolean;
begin
  select * into v_job from public.analysis_jobs where id = p_job_id;

  if v_job.id is null then
    raise exception 'fail_job: job % not found', p_job_id;
  end if;

  v_is_permanent := v_job.attempts >= v_job.max_attempts;

  if v_is_permanent then
    update public.analysis_jobs
    set status       = 'ERROR',
        last_error   = p_error,
        completed_at = now(),
        updated_at   = now()
    where id = p_job_id;
  else
    update public.analysis_jobs
    set status     = 'NONE',
        last_error = p_error,
        claimed_at = null,
        claimed_by = null,
        run_after  = now() + (interval '1 minute' * power(2, v_job.attempts)),
        updated_at = now()
    where id = p_job_id;
  end if;

  perform public.recompute_analysis_status(v_job.paper_analysis_id);
end;
$$;

comment on function public.fail_job(uuid, text) is
  'Re-queues with 2^attempts minute backoff, or marks ERROR once attempts are exhausted.';

-- ----------------------------------------------------------------------------
-- reap_stale_jobs() — returns wedged jobs to the queue.
--
-- A worker that crashes mid-job leaves it in GENERATING with nothing to move
-- it. Without this the analysis never completes and nothing ever says why.
-- Scheduled below via pg_cron every 5 minutes.
-- ----------------------------------------------------------------------------
create or replace function public.reap_stale_jobs(p_timeout interval default interval '15 minutes')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reaped integer;
begin
  with stale as (
    update public.analysis_jobs
    set status     = case
                       when attempts >= max_attempts then 'ERROR'::public.job_status
                       else 'NONE'::public.job_status
                     end,
        claimed_at = null,
        claimed_by = null,
        last_error = coalesce(last_error, 'Worker timed out; job reaped as stale.'),
        run_after  = now(),
        updated_at = now()
    where status = 'GENERATING'
      and claimed_at is not null
      and claimed_at < now() - p_timeout
    returning paper_analysis_id
  )
  select count(*) into v_reaped from stale;

  return v_reaped;
end;
$$;

comment on function public.reap_stale_jobs(interval) is
  'Returns jobs stuck in GENERATING past a timeout. Without this a crashed worker wedges an analysis forever.';

-- ----------------------------------------------------------------------------
-- recompute_analysis_status() — rolls sub-job state up to the parent.
--
-- Rules, in order:
--   * any REQUIRED job still pending or running  → GENERATING
--   * any REQUIRED job permanently ERROR         → ERROR
--   * otherwise                                  → DONE
--
-- Optional jobs (is_optional) are excluded from both terminal conditions. A
-- failed defense-question generation must never turn a perfectly good grammar
-- analysis into a failure.
-- ----------------------------------------------------------------------------
create or replace function public.recompute_analysis_status(p_analysis_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_required_open   integer;
  v_required_failed integer;
  v_total           integer;
begin
  select
    count(*) filter (where not is_optional and status in ('NONE', 'GENERATING')),
    count(*) filter (where not is_optional and status = 'ERROR' and attempts >= max_attempts),
    count(*)
  into v_required_open, v_required_failed, v_total
  from public.analysis_jobs
  where paper_analysis_id = p_analysis_id;

  -- No jobs enqueued yet: leave the analysis alone rather than declaring it done.
  if v_total = 0 then
    return;
  end if;

  if v_required_open > 0 then
    update public.paper_analyses
    set status = 'GENERATING', completed_at = null, updated_at = now()
    where id = p_analysis_id and status <> 'GENERATING';

  elsif v_required_failed > 0 then
    update public.paper_analyses
    set status = 'ERROR', completed_at = now(), updated_at = now()
    where id = p_analysis_id and status <> 'ERROR';

  else
    update public.paper_analyses
    set status = 'DONE', completed_at = now(), updated_at = now()
    where id = p_analysis_id and status <> 'DONE';
  end if;
end;
$$;

comment on function public.recompute_analysis_status(uuid) is
  'Rolls sub-job state up to paper_analyses.status. Optional job failures never fail the parent.';

-- ----------------------------------------------------------------------------
-- Schedule the reaper. Wrapped because pg_cron may be unavailable locally.
-- ----------------------------------------------------------------------------
do $$
begin
  perform cron.schedule(
    'reap-stale-analysis-jobs',
    '*/5 * * * *',
    $cron$ select public.reap_stale_jobs(); $cron$
  );
exception
  when undefined_table or undefined_function or invalid_schema_name then
    raise notice 'pg_cron not available — schedule reap_stale_jobs() externally.';
end
$$;
