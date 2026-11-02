-- ============================================================================
-- 02_functions_core.sql — the three helpers every later migration depends on.
-- ============================================================================
-- Written once here, referenced everywhere. If you find yourself inlining
-- `auth.uid() = user_id` in a policy, or writing `updated_at = now()` in
-- application code, stop — use these instead. Thirty slightly-different
-- hand-written variants is exactly how an RLS bug ships.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- set_updated_at() — attached by trigger to all 24 tables carrying updated_at.
-- Application code never writes this column.
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger: stamps updated_at on every UPDATE. Attached to every table with the column.';

-- ----------------------------------------------------------------------------
-- is_owner() — the ownership half of nearly every RLS policy.
--
-- STABLE, not VOLATILE, so the planner evaluates it once per statement rather
-- than once per row. On `words` (~50,000 rows per thesis) that difference is
-- the whole performance story.
-- ----------------------------------------------------------------------------
create or replace function public.is_owner(record_user_id uuid)
returns boolean
language sql
stable
as $$
  select record_user_id = (select auth.uid());
$$;

comment on function public.is_owner(uuid) is
  'True when the given user_id is the calling user. Used by every ownership policy.';

-- ----------------------------------------------------------------------------
-- has_permission() — the privileged half.
--
-- SECURITY DEFINER because a normal user has no select access to user_roles
-- beyond their own row, and SET search_path = '' because a definer function
-- without a pinned search_path is a textbook privilege-escalation hole: a
-- caller who can create objects in a schema earlier on the path can shadow the
-- tables this function reads. Every object below is therefore schema-qualified.
-- ----------------------------------------------------------------------------
-- Written in plpgsql rather than sql deliberately. A `language sql` body is
-- parsed AND its object references resolved at CREATE time, which would fail
-- here because user_roles is not created until 03_identity.sql. plpgsql binds
-- late, so the declaration order the migration sequence requires still works.
-- There is no performance cost: a SECURITY DEFINER function is never inlined
-- by the planner regardless of language.
create or replace function public.has_permission(perm public.app_permission)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_found boolean;
begin
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role = ur.role
    where ur.user_id = (select auth.uid())
      and rp.permission = perm
  ) into v_found;

  return v_found;
end;
$$;

comment on function public.has_permission(public.app_permission) is
  'True when the calling user holds a role granting the given permission.';

-- ----------------------------------------------------------------------------
-- has_role() — narrower check used by the admin surfaces in P16/P17.
-- ----------------------------------------------------------------------------
-- plpgsql for the same late-binding reason as has_permission() above.
create or replace function public.has_role(target_role public.app_role)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_found boolean;
begin
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = target_role
  ) into v_found;

  return v_found;
end;
$$;

comment on function public.has_role(public.app_role) is
  'True when the calling user holds the given role directly.';

-- ----------------------------------------------------------------------------
-- user_id denormalisation triggers.
--
-- Every child table carries its own user_id so RLS is always one indexed
-- comparison instead of a join back up the tree. These triggers are what keep
-- that column honest — application code never supplies it, and cannot lie
-- about it, because the trigger overwrites whatever was passed.
--
-- See docs/SCHEMA.md for the full reasoning.
-- ----------------------------------------------------------------------------

create or replace function public.set_user_id_from_paper()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select p.user_id into new.user_id
  from public.papers p
  where p.id = new.paper_id;

  if new.user_id is null then
    raise exception 'Cannot derive user_id: paper % not found', new.paper_id;
  end if;

  return new;
end;
$$;

create or replace function public.set_user_id_from_paper_upload()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select pu.user_id into new.user_id
  from public.paper_uploads pu
  where pu.id = new.paper_upload_id;

  if new.user_id is null then
    raise exception 'Cannot derive user_id: paper_upload % not found', new.paper_upload_id;
  end if;

  return new;
end;
$$;

create or replace function public.set_user_id_from_paper_analysis()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select pa.user_id into new.user_id
  from public.paper_analyses pa
  where pa.id = new.paper_analysis_id;

  if new.user_id is null then
    raise exception 'Cannot derive user_id: paper_analysis % not found', new.paper_analysis_id;
  end if;

  return new;
end;
$$;

create or replace function public.set_user_id_from_check_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select cr.user_id into new.user_id
  from public.check_results cr
  where cr.id = new.check_result_id;

  if new.user_id is null then
    raise exception 'Cannot derive user_id: check_result % not found', new.check_result_id;
  end if;

  return new;
end;
$$;

create or replace function public.set_user_id_from_requirement_file()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select rf.user_id into new.user_id
  from public.requirement_files rf
  where rf.id = new.requirement_file_id;

  if new.user_id is null then
    raise exception 'Cannot derive user_id: requirement_file % not found', new.requirement_file_id;
  end if;

  return new;
end;
$$;

create or replace function public.set_user_id_from_todo_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select tg.user_id into new.user_id
  from public.todo_groups tg
  where tg.id = new.todo_group_id;

  if new.user_id is null then
    raise exception 'Cannot derive user_id: todo_group % not found', new.todo_group_id;
  end if;

  return new;
end;
$$;

create or replace function public.set_user_id_from_defense_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select g.user_id into new.user_id
  from public.defense_question_groups g
  where g.id = new.defense_question_group_id;

  if new.user_id is null then
    raise exception 'Cannot derive user_id: defense_question_group % not found',
      new.defense_question_group_id;
  end if;

  return new;
end;
$$;

create or replace function public.set_user_id_from_defense_question()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select q.user_id into new.user_id
  from public.defense_questions q
  where q.id = new.defense_question_id;

  if new.user_id is null then
    raise exception 'Cannot derive user_id: defense_question % not found', new.defense_question_id;
  end if;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Blocks UPDATE entirely. Used by write-once tables where a later edit would
-- silently rewrite history (entitlements, ingestion output).
-- ----------------------------------------------------------------------------
create or replace function public.forbid_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Table %.% is write-once; UPDATE is not permitted.',
    tg_table_schema, tg_table_name;
end;
$$;
