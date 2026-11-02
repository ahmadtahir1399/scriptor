-- ============================================================================
-- 15_rls.sql — row-level security for all 38 tables.
-- ============================================================================
-- Model: enable RLS everywhere (which denies everything by default), then add
-- back exactly what is needed. A table with RLS on and no policy is reachable
-- only by the service role, which is the correct posture for the queue, the
-- cost ledger, the rate limiter and the audit trail.
--
-- Two enforcement layers are used together:
--   * POLICIES decide which ROWS a user can touch.
--   * COLUMN GRANTS decide which COLUMNS they can write.
-- Policies alone are not enough for check_results and findings: a row policy
-- would let a user rewrite the feedback they were given. The column grants
-- below are what actually prevent that.
--
-- Note on `authenticated` vs `service_role`: the service role bypasses RLS
-- entirely, so no policy below needs to mention it.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Baseline: revoke the permissive defaults, then grant deliberately.
-- ----------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

grant usage on schema public to anon, authenticated;

-- ============================================================================
-- 03_identity
-- ============================================================================

alter table public.institutions              enable row level security;
alter table public.profiles                  enable row level security;
alter table public.role_definitions          enable row level security;
alter table public.permission_definitions    enable row level security;
alter table public.role_permissions          enable row level security;
alter table public.user_roles                enable row level security;

-- institutions — public catalogue, readable by any signed-in user.
grant select on public.institutions to authenticated;
create policy "institutions: read for authenticated"
  on public.institutions for select to authenticated
  using (true);

-- profiles — own row only.
--
-- The UPDATE policy carries a WITH CHECK that pins `id`, so a user cannot
-- repoint their own profile row at another account. There is no role column
-- here to protect: roles live in user_roles, which has no user write policy.
grant select on public.profiles to authenticated;
grant update (full_name, avatar_url, locale, institution_id) on public.profiles to authenticated;

create policy "profiles: select own"
  on public.profiles for select to authenticated
  using (public.is_owner(id));

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (public.is_owner(id))
  with check (public.is_owner(id));

-- Profiles with FULL_DATA_ACCESS may be read by support/admin tooling.
create policy "profiles: select all with FULL_DATA_ACCESS"
  on public.profiles for select to authenticated
  using (public.has_permission('FULL_DATA_ACCESS'));

-- role_definitions / permission_definitions — descriptive catalogue.
grant select on public.role_definitions to authenticated;
create policy "role_definitions: read for authenticated"
  on public.role_definitions for select to authenticated
  using (true);

grant select on public.permission_definitions to authenticated;
create policy "permission_definitions: read for authenticated"
  on public.permission_definitions for select to authenticated
  using (true);

-- role_permissions — readable so the UI can explain what a role grants.
grant select on public.role_permissions to authenticated;
create policy "role_permissions: read for authenticated"
  on public.role_permissions for select to authenticated
  using (true);

-- user_roles — SELECT own assignments only. No INSERT/UPDATE/DELETE policy
-- exists, by design: a user must never be able to grant themselves a role.
grant select on public.user_roles to authenticated;
create policy "user_roles: select own"
  on public.user_roles for select to authenticated
  using (public.is_owner(user_id));

create policy "user_roles: select all with FULL_DATA_ACCESS"
  on public.user_roles for select to authenticated
  using (public.has_permission('FULL_DATA_ACCESS'));

-- ============================================================================
-- 04_catalogue
-- ============================================================================

alter table public.document_types         enable row level security;
alter table public.checks                 enable row level security;
alter table public.check_versions         enable row level security;
alter table public.document_type_checks   enable row level security;
alter table public.check_ab_tests         enable row level security;

grant select on public.document_types to authenticated;
create policy "document_types: read active"
  on public.document_types for select to authenticated
  using (is_active or public.has_permission('MANAGE_CHECKS'));

-- checks — the TABLE is granted only to check managers. Ordinary users read
-- `checks_public`, which omits nothing sensitive but also carries no prompts.
grant select on public.checks to authenticated;
create policy "checks: read active"
  on public.checks for select to authenticated
  using (is_active or public.has_permission('MANAGE_CHECKS'));

create policy "checks: manage with MANAGE_CHECKS"
  on public.checks for all to authenticated
  using (public.has_permission('MANAGE_CHECKS'))
  with check (public.has_permission('MANAGE_CHECKS'));

grant insert, update, delete on public.checks to authenticated;

-- check_versions — CORE IP.
--
-- No SELECT grant to `authenticated` at all. The three prompt columns must
-- never leave the server for a normal user. Only MANAGE_CHECK_VERSIONS holders
-- get the table, and the policy is a second lock on the same door.
grant select, insert, update, delete on public.check_versions to authenticated;

create policy "check_versions: manage with MANAGE_CHECK_VERSIONS"
  on public.check_versions for all to authenticated
  using (public.has_permission('MANAGE_CHECK_VERSIONS'))
  with check (public.has_permission('MANAGE_CHECK_VERSIONS'));

-- checks_public — the prompt-free projection every normal user reads.
grant select on public.checks_public to authenticated;

grant select on public.document_type_checks to authenticated;
create policy "document_type_checks: read for authenticated"
  on public.document_type_checks for select to authenticated
  using (true);

create policy "document_type_checks: manage with MANAGE_CHECKS"
  on public.document_type_checks for all to authenticated
  using (public.has_permission('MANAGE_CHECKS'))
  with check (public.has_permission('MANAGE_CHECKS'));

grant insert, update, delete on public.document_type_checks to authenticated;

-- check_ab_tests — admin surface only.
grant select, insert, update, delete on public.check_ab_tests to authenticated;
create policy "check_ab_tests: manage with MANAGE_CHECK_VERSIONS"
  on public.check_ab_tests for all to authenticated
  using (public.has_permission('MANAGE_CHECK_VERSIONS'))
  with check (public.has_permission('MANAGE_CHECK_VERSIONS'));

-- ============================================================================
-- 05_papers
-- ============================================================================

alter table public.papers               enable row level security;
alter table public.paper_uploads        enable row level security;
alter table public.upload_entitlements  enable row level security;

grant select, insert, update, delete on public.papers to authenticated;
create policy "papers: select own"
  on public.papers for select to authenticated
  using (public.is_owner(user_id));
create policy "papers: insert own"
  on public.papers for insert to authenticated
  with check (public.is_owner(user_id));
create policy "papers: update own"
  on public.papers for update to authenticated
  using (public.is_owner(user_id))
  with check (public.is_owner(user_id));
create policy "papers: delete own"
  on public.papers for delete to authenticated
  using (public.is_owner(user_id));

-- paper_uploads — the user creates and deletes them but may only edit their own
-- settings columns. Extracted metadata and the compatibility verdict are
-- written by the ingestion worker and must not be user-editable, or a student
-- could simply flip is_compatible and bypass the gate.
grant select, insert, delete on public.paper_uploads to authenticated;
grant update (
  auto_delete,
  share_data,
  send_email_results,
  selected_check_ids,
  use_custom_requirements
) on public.paper_uploads to authenticated;

create policy "paper_uploads: select own"
  on public.paper_uploads for select to authenticated
  using (public.is_owner(user_id));
create policy "paper_uploads: insert own"
  on public.paper_uploads for insert to authenticated
  with check (
    public.is_owner(user_id)
    or exists (
      select 1 from public.papers p
      where p.id = paper_id and public.is_owner(p.user_id)
    )
  );
create policy "paper_uploads: update own settings"
  on public.paper_uploads for update to authenticated
  using (public.is_owner(user_id))
  with check (public.is_owner(user_id));
create policy "paper_uploads: delete own"
  on public.paper_uploads for delete to authenticated
  using (public.is_owner(user_id));

-- upload_entitlements — read-only to the user. UPDATE is additionally blocked
-- by trigger for every role including the service role.
grant select on public.upload_entitlements to authenticated;
create policy "upload_entitlements: select own"
  on public.upload_entitlements for select to authenticated
  using (public.is_owner(user_id));

-- ============================================================================
-- 06_pages — ingestion output. SELECT only; the worker writes with service role.
-- ============================================================================

alter table public.paper_pages enable row level security;
alter table public.words      enable row level security;

grant select on public.paper_pages to authenticated;
create policy "paper_pages: select own"
  on public.paper_pages for select to authenticated
  using (public.is_owner(user_id));

grant select on public.words to authenticated;
create policy "words: select own"
  on public.words for select to authenticated
  using (public.is_owner(user_id));

-- ============================================================================
-- 07_analysis
-- ============================================================================

alter table public.paper_analyses enable row level security;
alter table public.check_results  enable row level security;
alter table public.findings       enable row level security;

-- paper_analyses — read only. Statuses are pipeline state, not user state.
grant select on public.paper_analyses to authenticated;
create policy "paper_analyses: select own"
  on public.paper_analyses for select to authenticated
  using (public.is_owner(user_id));

-- check_results — the user may rate and comment. Nothing else.
--
-- This grant is the real control. Without it, the UPDATE policy below would
-- permit rewriting `feedback` itself.
grant select on public.check_results to authenticated;
grant update (rating, is_helpful, user_comment) on public.check_results to authenticated;

create policy "check_results: select own visible"
  on public.check_results for select to authenticated
  using (
    public.is_owner(user_id)
    and (not hidden_because_ab_test or public.has_permission('MANAGE_CHECK_VERSIONS'))
  );

create policy "check_results: rate own"
  on public.check_results for update to authenticated
  using (public.is_owner(user_id))
  with check (public.is_owner(user_id));

-- findings — the user may mark resolved. Nothing else.
grant select on public.findings to authenticated;
grant update (is_resolved, resolved_at) on public.findings to authenticated;

create policy "findings: select own"
  on public.findings for select to authenticated
  using (public.is_owner(user_id));

create policy "findings: resolve own"
  on public.findings for update to authenticated
  using (public.is_owner(user_id))
  with check (public.is_owner(user_id));

-- ============================================================================
-- 08_references — analysis output, read-only to the user.
-- ============================================================================

alter table public.in_text_references      enable row level security;
alter table public.bibliography_references enable row level security;
alter table public.reference_pairs         enable row level security;

grant select on public.in_text_references to authenticated;
create policy "in_text_references: select own"
  on public.in_text_references for select to authenticated
  using (public.is_owner(user_id));

grant select on public.bibliography_references to authenticated;
create policy "bibliography_references: select own"
  on public.bibliography_references for select to authenticated
  using (public.is_owner(user_id));

grant select on public.reference_pairs to authenticated;
create policy "reference_pairs: select own"
  on public.reference_pairs for select to authenticated
  using (public.is_owner(user_id));

-- ============================================================================
-- 09_requirements — the student's own content; full CRUD on their rows.
-- ============================================================================

alter table public.requirement_files    enable row level security;
alter table public.requirements         enable row level security;
alter table public.upload_requirements  enable row level security;

grant select, insert, delete on public.requirement_files to authenticated;
grant update (title, institution_id) on public.requirement_files to authenticated;

create policy "requirement_files: select own"
  on public.requirement_files for select to authenticated
  using (public.is_owner(user_id));
create policy "requirement_files: insert own"
  on public.requirement_files for insert to authenticated
  with check (public.is_owner(user_id));
create policy "requirement_files: update own"
  on public.requirement_files for update to authenticated
  using (public.is_owner(user_id))
  with check (public.is_owner(user_id));
create policy "requirement_files: delete own"
  on public.requirement_files for delete to authenticated
  using (public.is_owner(user_id));

grant select, insert, update, delete on public.requirements to authenticated;
create policy "requirements: select own"
  on public.requirements for select to authenticated
  using (public.is_owner(user_id));
create policy "requirements: insert own"
  on public.requirements for insert to authenticated
  with check (
    exists (
      select 1 from public.requirement_files rf
      where rf.id = requirement_file_id and public.is_owner(rf.user_id)
    )
  );
create policy "requirements: update own"
  on public.requirements for update to authenticated
  using (public.is_owner(user_id))
  with check (public.is_owner(user_id));
create policy "requirements: delete own"
  on public.requirements for delete to authenticated
  using (public.is_owner(user_id));

-- upload_requirements — the grading result is written by the worker; the user
-- may only attach and detach requirements from an upload.
grant select, insert, delete on public.upload_requirements to authenticated;
create policy "upload_requirements: select own"
  on public.upload_requirements for select to authenticated
  using (public.is_owner(user_id));
create policy "upload_requirements: insert own"
  on public.upload_requirements for insert to authenticated
  with check (
    exists (
      select 1 from public.paper_uploads pu
      where pu.id = paper_upload_id and public.is_owner(pu.user_id)
    )
  );
create policy "upload_requirements: delete own"
  on public.upload_requirements for delete to authenticated
  using (public.is_owner(user_id));

-- ============================================================================
-- 10_todos — generated, then owned and edited by the student.
-- ============================================================================

alter table public.todo_groups enable row level security;
alter table public.todo_items  enable row level security;

grant select, insert, update, delete on public.todo_groups to authenticated;
create policy "todo_groups: select own"
  on public.todo_groups for select to authenticated
  using (public.is_owner(user_id));
create policy "todo_groups: insert own"
  on public.todo_groups for insert to authenticated
  with check (
    exists (
      select 1 from public.paper_analyses pa
      where pa.id = paper_analysis_id and public.is_owner(pa.user_id)
    )
  );
create policy "todo_groups: update own"
  on public.todo_groups for update to authenticated
  using (public.is_owner(user_id))
  with check (public.is_owner(user_id));
create policy "todo_groups: delete own"
  on public.todo_groups for delete to authenticated
  using (public.is_owner(user_id));

grant select, insert, update, delete on public.todo_items to authenticated;
create policy "todo_items: select own"
  on public.todo_items for select to authenticated
  using (public.is_owner(user_id));
create policy "todo_items: insert own"
  on public.todo_items for insert to authenticated
  with check (
    exists (
      select 1 from public.todo_groups tg
      where tg.id = todo_group_id and public.is_owner(tg.user_id)
    )
  );
create policy "todo_items: update own"
  on public.todo_items for update to authenticated
  using (public.is_owner(user_id))
  with check (public.is_owner(user_id));
create policy "todo_items: delete own"
  on public.todo_items for delete to authenticated
  using (public.is_owner(user_id));

-- ============================================================================
-- 11_defense — questions are generated (read-only); practices are the
-- student's own work (full CRUD).
-- ============================================================================

alter table public.defense_question_groups   enable row level security;
alter table public.defense_questions         enable row level security;
alter table public.defense_practices         enable row level security;
alter table public.defense_question_answers  enable row level security;

grant select on public.defense_question_groups to authenticated;
create policy "defense_question_groups: select own"
  on public.defense_question_groups for select to authenticated
  using (public.is_owner(user_id));

grant select on public.defense_questions to authenticated;
create policy "defense_questions: select own"
  on public.defense_questions for select to authenticated
  using (public.is_owner(user_id));

grant select, insert, update, delete on public.defense_practices to authenticated;
create policy "defense_practices: select own"
  on public.defense_practices for select to authenticated
  using (public.is_owner(user_id));
create policy "defense_practices: insert own"
  on public.defense_practices for insert to authenticated
  with check (
    exists (
      select 1 from public.paper_analyses pa
      where pa.id = paper_analysis_id and public.is_owner(pa.user_id)
    )
  );
create policy "defense_practices: update own"
  on public.defense_practices for update to authenticated
  using (public.is_owner(user_id))
  with check (public.is_owner(user_id));
create policy "defense_practices: delete own"
  on public.defense_practices for delete to authenticated
  using (public.is_owner(user_id));

-- The answer text is the student's; the score and feedback are written by the
-- grading worker, so only answer_text is grantable here.
grant select, insert, delete on public.defense_question_answers to authenticated;
grant update (answer_text) on public.defense_question_answers to authenticated;

create policy "defense_question_answers: select own"
  on public.defense_question_answers for select to authenticated
  using (public.is_owner(user_id));
create policy "defense_question_answers: insert own"
  on public.defense_question_answers for insert to authenticated
  with check (
    exists (
      select 1 from public.defense_practices dp
      where dp.id = defense_practice_id and public.is_owner(dp.user_id)
    )
  );
create policy "defense_question_answers: update own"
  on public.defense_question_answers for update to authenticated
  using (public.is_owner(user_id))
  with check (public.is_owner(user_id));
create policy "defense_question_answers: delete own"
  on public.defense_question_answers for delete to authenticated
  using (public.is_owner(user_id));

-- ============================================================================
-- 12_jobs — SERVICE ROLE ONLY.
--
-- RLS is enabled and NO policy is created for either table. That is deliberate,
-- not an omission: a client that can read the queue learns the internal job
-- graph, and one that can write it can re-prioritise its own work ahead of
-- everyone else's or replay another user's job.
--
-- token_usage is likewise service-role only — it is the cost ledger, and P16
-- reads it through server-side admin queries, never from the browser.
-- ============================================================================

alter table public.analysis_jobs enable row level security;
alter table public.token_usage  enable row level security;

-- No policies. No grants. Intentional.

-- The queue functions are SECURITY DEFINER and must not be callable by a
-- browser client, or a user could claim or complete arbitrary jobs.
revoke execute on function public.claim_analysis_jobs(text, integer) from anon, authenticated;
revoke execute on function public.complete_job(uuid) from anon, authenticated;
revoke execute on function public.fail_job(uuid, text) from anon, authenticated;
revoke execute on function public.reap_stale_jobs(interval) from anon, authenticated;
revoke execute on function public.recompute_analysis_status(uuid) from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;

-- These two are read-only predicates used inside policies; the planner needs
-- the calling role to be able to execute them.
grant execute on function public.is_owner(uuid) to authenticated;
grant execute on function public.has_permission(public.app_permission) to authenticated;
grant execute on function public.has_role(public.app_role) to authenticated;

-- ============================================================================
-- 13_events — SERVICE ROLE ONLY. No policies, no grants. Intentional.
--
-- upload_events:        telemetry about the user, not for the user.
-- rate_limit_attempts:  a client that can delete its counters has no rate limit.
-- admin_actions:        an audit log a client can touch is not an audit log.
-- ============================================================================

alter table public.upload_events        enable row level security;
alter table public.rate_limit_attempts  enable row level security;
alter table public.admin_actions        enable row level security;

-- admin_actions is readable by holders of FULL_DATA_ACCESS so the P17 audit
-- screen can render. Still no write path from any client.
grant select on public.admin_actions to authenticated;
create policy "admin_actions: select with FULL_DATA_ACCESS"
  on public.admin_actions for select to authenticated
  using (public.has_permission('FULL_DATA_ACCESS'));

-- ============================================================================
-- 14_notifications
-- ============================================================================

alter table public.notifications              enable row level security;
alter table public.notification_preferences   enable row level security;

-- The user may mark read and delete. Creating a notification is the server's
-- job — a client that can insert here can forge system messages to itself.
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "notifications: select own"
  on public.notifications for select to authenticated
  using (public.is_owner(user_id));
create policy "notifications: mark read own"
  on public.notifications for update to authenticated
  using (public.is_owner(user_id))
  with check (public.is_owner(user_id));
create policy "notifications: delete own"
  on public.notifications for delete to authenticated
  using (public.is_owner(user_id));

grant select on public.notification_preferences to authenticated;
grant update (
  email_analysis_complete,
  email_analysis_failed,
  email_reference_issues,
  email_todo_due_soon,
  email_weekly_digest,
  in_app_enabled
) on public.notification_preferences to authenticated;

create policy "notification_preferences: select own"
  on public.notification_preferences for select to authenticated
  using (public.is_owner(user_id));
create policy "notification_preferences: update own"
  on public.notification_preferences for update to authenticated
  using (public.is_owner(user_id))
  with check (public.is_owner(user_id));

-- ============================================================================
-- Sequence usage for the identity-column tables the user can insert into.
-- (words, token_usage and the event tables are service-role only, so their
-- sequences are deliberately not granted.)
-- ============================================================================
grant usage on all sequences in schema public to authenticated;
