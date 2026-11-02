-- ============================================================================
-- 20_notification_digest.sql — the weekly digest's send ledger.
-- ============================================================================
-- The five event notifications dedupe against `notifications` itself: a row
-- exists, therefore it was sent. The weekly digest cannot, because it is not an
-- event and has no `notification_type` member — it is a periodic summary that
-- fires on a clock rather than on something happening.
--
-- Without a ledger the sweep has no way to answer "did this user already get
-- this week's digest", and a worker that runs every minute would send it every
-- minute. This column is that answer.
--
-- On `notification_preferences` rather than a table of its own because it is
-- 1:1 with the preference that controls it, and the row already exists for
-- every user (created by handle_new_user()). NULL means "never sent", which is
-- the correct starting state for every existing row — the sweep treats it as
-- due, so the first run after this migration sends to whoever has opted in.
-- ============================================================================

alter table public.notification_preferences
  add column if not exists last_digest_sent_at timestamptz;

comment on column public.notification_preferences.last_digest_sent_at is
  'When the weekly digest last went out. NULL = never. The digest sweep''s only dedupe.';

-- Partial index: the sweep reads exactly the opted-in rows and nothing else,
-- and opt-in defaults to false, so this stays small however many users exist.
create index if not exists notification_preferences_digest_idx
  on public.notification_preferences (last_digest_sent_at)
  where email_weekly_digest;

-- ----------------------------------------------------------------------------
-- The column is written by the worker under the service role ONLY.
--
-- 15_rls.sql grants `authenticated` an explicit column list on this table so a
-- user can change their own settings; `last_digest_sent_at` is deliberately NOT
-- added to it. A user who could write it could either re-send themselves the
-- digest on demand or suppress it forever, and neither is a setting — it is
-- delivery bookkeeping.
-- ----------------------------------------------------------------------------
