-- ============================================================================
-- 13_events.sql — telemetry, rate limiting, audit trail.
-- ============================================================================
-- None of these three tables has a user-facing policy. They exist to answer
-- questions about users, so letting users read or write them would defeat the
-- purpose — a rate-limit row a client can delete is not a rate limit, and an
-- audit log an admin can edit is not an audit log.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- upload_events — the ingestion funnel, step by step.
-- Answers "where do uploads die?" without having to reconstruct it from logs.
-- ----------------------------------------------------------------------------
create table public.upload_events (
  id                bigint generated always as identity primary key,
  paper_upload_id   uuid references public.paper_uploads (id) on delete cascade,
  user_id           uuid references auth.users (id) on delete set null,

  event_type        text not null,
  detail            jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),

  constraint upload_events_event_type_not_empty check (length(btrim(event_type)) > 0)
);

create index upload_events_upload_idx on public.upload_events (paper_upload_id);
create index upload_events_user_id_idx on public.upload_events (user_id);
create index upload_events_type_created_idx on public.upload_events (event_type, created_at desc);

comment on table public.upload_events is 'Ingestion funnel telemetry. Service-role only.';

-- ----------------------------------------------------------------------------
-- rate_limit_attempts — abuse control.
--
-- Keyed by an opaque identifier (user id, IP hash, email hash) plus a bucket
-- name, so one table serves signup throttling, upload throttling and OTP
-- resends without three near-identical tables.
--
-- Deliberately NOT client-writable and NOT client-readable: a client that can
-- see or delete its own counters can trivially evade them.
-- ----------------------------------------------------------------------------
create table public.rate_limit_attempts (
  id            bigint generated always as identity primary key,
  bucket        text not null,
  identifier    text not null,
  user_id       uuid references auth.users (id) on delete set null,

  attempted_at  timestamptz not null default now(),
  succeeded     boolean not null default false,
  metadata      jsonb not null default '{}'::jsonb,

  constraint rate_limit_attempts_bucket_not_empty check (length(btrim(bucket)) > 0)
);

-- The counting query: attempts in this bucket, for this identifier, since T.
create index rate_limit_attempts_lookup_idx
  on public.rate_limit_attempts (bucket, identifier, attempted_at desc);
create index rate_limit_attempts_attempted_at_idx
  on public.rate_limit_attempts (attempted_at);

comment on table public.rate_limit_attempts is
  'Abuse counters. Service-role only — a client that can delete its counters has no rate limit.';

-- ----------------------------------------------------------------------------
-- admin_actions — immutable audit trail of every privileged mutation.
--
-- actor_user_id is ON DELETE SET NULL, never CASCADE: deleting an admin account
-- must not erase the record of what that admin did. The trail outlives them.
-- ----------------------------------------------------------------------------
create table public.admin_actions (
  id                bigint generated always as identity primary key,
  actor_user_id     uuid references auth.users (id) on delete set null,
  target_user_id    uuid references auth.users (id) on delete set null,

  action            public.admin_action_type not null,
  target_table      text,
  target_id         text,
  detail            jsonb not null default '{}'::jsonb,
  reason            text,

  created_at        timestamptz not null default now()
);

create index admin_actions_actor_idx on public.admin_actions (actor_user_id, created_at desc);
create index admin_actions_target_idx on public.admin_actions (target_user_id, created_at desc);
create index admin_actions_action_idx on public.admin_actions (action, created_at desc);

-- Append-only. An audit log that can be edited is not an audit log.
create trigger admin_actions_forbid_update
  before update on public.admin_actions
  for each row execute function public.forbid_update();

comment on table public.admin_actions is
  'Append-only audit trail. Service-role only. Survives deletion of the acting admin.';
