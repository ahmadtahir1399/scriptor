-- ============================================================================
-- 14_notifications.sql — in-app notifications and per-user delivery settings.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- notification_preferences — one row per user, created by handle_new_user().
--
-- Every channel defaults to true except the digest. The defaults matter: an
-- analysis takes minutes, the student has closed the tab, and the completion
-- email is the only thing that brings them back.
-- ----------------------------------------------------------------------------
create table public.notification_preferences (
  user_id                       uuid primary key references auth.users (id) on delete cascade,

  email_analysis_complete       boolean not null default true,
  email_analysis_failed         boolean not null default true,
  email_reference_issues        boolean not null default true,
  email_todo_due_soon           boolean not null default true,
  email_weekly_digest           boolean not null default false,

  in_app_enabled                boolean not null default true,

  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

comment on table public.notification_preferences is
  'Per-user delivery settings. Created by handle_new_user() on signup.';

-- ----------------------------------------------------------------------------
-- notifications — the in-app feed backing the topbar bell (P15).
--
-- href is a deep link the popover navigates to. The related_* columns are
-- nullable and ON DELETE CASCADE so a notification about a deleted paper
-- disappears with it rather than dead-ending the user.
-- ----------------------------------------------------------------------------
create table public.notifications (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,

  type                public.notification_type not null,
  title               text not null,
  body                text not null default '',
  href                text,

  related_paper_id            uuid references public.papers (id) on delete cascade,
  related_paper_analysis_id   uuid references public.paper_analyses (id) on delete cascade,

  read_at             timestamptz,
  emailed_at          timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint notifications_title_not_empty check (length(btrim(title)) > 0)
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
-- Powers the unread badge count without scanning the whole feed.
create index notifications_unread_idx
  on public.notifications (user_id)
  where read_at is null;
create index notifications_paper_idx on public.notifications (related_paper_id);

create trigger notifications_set_updated_at
  before update on public.notifications
  for each row execute function public.set_updated_at();

comment on table public.notifications is 'In-app notification feed. Backs the topbar bell in P15.';

-- ----------------------------------------------------------------------------
-- The auth.users trigger.
--
-- Created here rather than in 03_identity.sql because handle_new_user() inserts
-- into notification_preferences, which did not exist until this migration. The
-- function was declared in 03; only the trigger binding is deferred.
-- ----------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
