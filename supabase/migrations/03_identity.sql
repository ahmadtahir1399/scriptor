-- ============================================================================
-- 03_identity.sql — who the user is and what they are allowed to do.
-- ============================================================================
-- Roles are stored in their own table rather than on profiles or in JWT claims.
-- A role column on a user-updatable row is the classic privilege-escalation
-- bug: the user updates their own profile and hands themselves ADMIN. Keeping
-- assignments in user_roles, which has no user-facing write policy at all,
-- makes that impossible by construction.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- institutions — universities. Optional on a profile; used later to scope
-- requirement templates to a school.
-- ----------------------------------------------------------------------------
create table public.institutions (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  domain         text unique,
  country        text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index institutions_domain_idx on public.institutions (domain);

create trigger institutions_set_updated_at
  before update on public.institutions
  for each row execute function public.set_updated_at();

comment on table public.institutions is 'Universities. Optional affiliation on a profile.';

-- ----------------------------------------------------------------------------
-- profiles — application-side user record, 1:1 with auth.users.
--
-- Deliberately has NO role column. See the header note above.
-- ----------------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  email             extensions.citext not null,
  full_name         text,
  avatar_url        text,
  locale            public.app_locale not null default 'EN',
  institution_id    uuid references public.institutions (id) on delete set null,
  is_anonymized     boolean not null default false,
  anonymized_at     timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index profiles_email_idx on public.profiles (email);
create index profiles_institution_id_idx on public.profiles (institution_id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

comment on table public.profiles is 'Application user record, 1:1 with auth.users. Holds no role — see user_roles.';

-- ----------------------------------------------------------------------------
-- role_definitions / permission_definitions — catalogue rows describing what
-- each enum member means. Referenced with ON DELETE RESTRICT so a role still
-- in use can never be deleted out from under an assignment.
-- ----------------------------------------------------------------------------
create table public.role_definitions (
  role          public.app_role primary key,
  description   text not null,
  created_at    timestamptz not null default now()
);

comment on table public.role_definitions is 'Human-readable description of each app_role.';

create table public.permission_definitions (
  permission    public.app_permission primary key,
  description   text not null,
  created_at    timestamptz not null default now()
);

comment on table public.permission_definitions is 'Human-readable description of each app_permission.';

-- ----------------------------------------------------------------------------
-- role_permissions — which permissions each role grants.
-- ----------------------------------------------------------------------------
create table public.role_permissions (
  id            uuid primary key default gen_random_uuid(),
  role          public.app_role not null
                  references public.role_definitions (role) on delete restrict,
  permission    public.app_permission not null
                  references public.permission_definitions (permission) on delete restrict,
  created_at    timestamptz not null default now(),

  constraint role_permissions_unique unique (role, permission)
);

create index role_permissions_role_idx on public.role_permissions (role);

comment on table public.role_permissions is 'Role → permission mapping. Read by has_permission().';

-- ----------------------------------------------------------------------------
-- user_roles — role assignments.
--
-- No user-facing INSERT/UPDATE/DELETE policy exists anywhere in 15_rls.sql.
-- Only the service role writes here.
-- ----------------------------------------------------------------------------
create table public.user_roles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  role          public.app_role not null
                  references public.role_definitions (role) on delete restrict,
  granted_by    uuid references auth.users (id) on delete set null,
  granted_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),

  constraint user_roles_unique unique (user_id, role)
);

create index user_roles_user_id_idx on public.user_roles (user_id);
create index user_roles_role_idx on public.user_roles (role);

comment on table public.user_roles is 'Role assignments. Service-role write only — a user must never grant themselves a role.';

-- ----------------------------------------------------------------------------
-- handle_new_user() — bootstraps everything a new signup needs.
--
-- SECURITY DEFINER because it runs from a trigger on auth.users, where the
-- inserting role has no rights on public tables. SET search_path = '' is
-- mandatory here, not stylistic: this function runs with elevated privilege on
-- every signup, and an unpinned search_path would let a caller who can create
-- objects shadow `public.profiles` and capture the insert.
--
-- ON CONFLICT DO NOTHING throughout so a retried signup is idempotent rather
-- than an error that blocks account creation.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    -- OAuth providers populate different metadata keys; fall back through them.
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'USER')
  on conflict (user_id, role) do nothing;

  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Creates profile, USER role and notification preferences for a new auth.users row.';

-- The trigger itself is created in 14_notifications.sql, once
-- notification_preferences exists — this function references it.
