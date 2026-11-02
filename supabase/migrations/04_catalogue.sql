-- ============================================================================
-- 04_catalogue.sql — the check catalogue. This is the product's core IP.
-- ============================================================================
-- The prompts in check_versions are the thing that makes Scriptor worth paying
-- for. They must never be readable by a normal user. That is enforced twice
-- over: no SELECT grant on check_versions for `authenticated`, plus a
-- prompt-free `checks_public` view that the app actually reads.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- document_types — bachelor / master / seminar / dissertation.
-- max_chars is the compatibility gate: an upload over the limit is rejected
-- before any LLM cost is incurred.
-- ----------------------------------------------------------------------------
create table public.document_types (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  name_en       text not null,
  name_de       text not null,
  max_chars     integer not null check (max_chars > 0),
  sort_order    integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index document_types_sort_order_idx on public.document_types (sort_order);

create trigger document_types_set_updated_at
  before update on public.document_types
  for each row execute function public.set_updated_at();

comment on table public.document_types is 'Thesis categories and their maximum length.';

-- ----------------------------------------------------------------------------
-- checks — the catalogue entry. Stable identity and display metadata only;
-- all prompt text lives in check_versions.
--
-- page_scope lists which page_types this check reads. A check scoped to BODY
-- never sees the cover page, which keeps token cost proportional to relevance.
-- ----------------------------------------------------------------------------
create table public.checks (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,
  name_en           text not null,
  name_de           text not null,
  description_en    text not null,
  description_de    text not null,
  processing_mode   public.processing_mode not null,
  page_scope        public.page_type[] not null default array['BODY']::public.page_type[],
  is_active         boolean not null default true,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index checks_is_active_idx on public.checks (is_active);
create index checks_sort_order_idx on public.checks (sort_order);

create trigger checks_set_updated_at
  before update on public.checks
  for each row execute function public.set_updated_at();

comment on table public.checks is 'Check catalogue. Display metadata only — prompts live in check_versions.';
comment on column public.checks.page_scope is 'Which page_types this check reads. Keeps token cost proportional to relevance.';

-- ----------------------------------------------------------------------------
-- check_versions — immutable prompt provenance.
--
-- A check_result records which version produced it, so a result stays
-- explainable years later even after the prompt has been rewritten ten times.
-- Never UPDATE a version's prompt text: insert a new version instead.
--
-- `model` holds a ROLE NAME from lib/ai/models.ts ("reasoning", "fast", …),
-- never a raw model ID. Swapping the underlying model is then a one-line
-- change in TypeScript rather than an UPDATE across every row here.
-- ----------------------------------------------------------------------------
create table public.check_versions (
  id                  uuid primary key default gen_random_uuid(),
  check_id            uuid not null references public.checks (id) on delete cascade,
  version             integer not null check (version > 0),
  analysis_prompt     text not null,
  feedback_prompt     text not null,
  test_prompt         text,
  model               text not null,
  temperature         numeric(3, 2) not null default 0.20
                        check (temperature >= 0 and temperature <= 2),
  locale              public.app_locale not null default 'EN',
  is_active           boolean not null default false,
  notes               text,
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint check_versions_unique_version unique (check_id, version)
);

create index check_versions_check_id_idx on public.check_versions (check_id);
-- Exactly one active version per check per locale.
create unique index check_versions_one_active_idx
  on public.check_versions (check_id, locale)
  where is_active;

create trigger check_versions_set_updated_at
  before update on public.check_versions
  for each row execute function public.set_updated_at();

comment on table public.check_versions is
  'Prompt text per check version. CONTAINS CORE IP — never granted to `authenticated`.';
comment on column public.check_versions.model is
  'Role name from lib/ai/models.ts (e.g. "reasoning"), never a raw model ID.';

-- ----------------------------------------------------------------------------
-- document_type_checks — which checks apply to which document type.
-- ----------------------------------------------------------------------------
create table public.document_type_checks (
  id                  uuid primary key default gen_random_uuid(),
  document_type_id    uuid not null references public.document_types (id) on delete cascade,
  check_id            uuid not null references public.checks (id) on delete cascade,
  is_default          boolean not null default true,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),

  constraint document_type_checks_unique unique (document_type_id, check_id)
);

create index document_type_checks_document_type_id_idx
  on public.document_type_checks (document_type_id);
create index document_type_checks_check_id_idx on public.document_type_checks (check_id);

comment on table public.document_type_checks is 'Which checks are offered for each document type.';

-- ----------------------------------------------------------------------------
-- check_ab_tests — two versions of one check run head to head.
-- Results from the losing arm are marked hidden_because_ab_test so the student
-- only ever sees one answer per check.
-- ----------------------------------------------------------------------------
create table public.check_ab_tests (
  id                    uuid primary key default gen_random_uuid(),
  check_id              uuid not null references public.checks (id) on delete cascade,
  control_version_id    uuid not null references public.check_versions (id) on delete restrict,
  variant_version_id    uuid not null references public.check_versions (id) on delete restrict,
  traffic_percent       integer not null default 50
                          check (traffic_percent between 0 and 100),
  is_active             boolean not null default false,
  started_at            timestamptz,
  ended_at              timestamptz,
  notes                 text,
  created_by            uuid references auth.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint check_ab_tests_distinct_arms
    check (control_version_id <> variant_version_id)
);

create index check_ab_tests_check_id_idx on public.check_ab_tests (check_id);
create unique index check_ab_tests_one_active_idx
  on public.check_ab_tests (check_id)
  where is_active;

create trigger check_ab_tests_set_updated_at
  before update on public.check_ab_tests
  for each row execute function public.set_updated_at();

comment on table public.check_ab_tests is 'Head-to-head prompt experiments. Admin-only.';

-- ----------------------------------------------------------------------------
-- checks_public — what the application actually reads.
--
-- Exposes catalogue metadata and the ACTIVE VERSION NUMBER, but none of the
-- three prompt columns. Users are granted SELECT on this view and on nothing
-- in check_versions.
--
-- This view is intentionally NOT `security_invoker`. Running it as its owner is
-- the mechanism that lets a user read safe columns from a table they have no
-- SELECT grant on. The underlying data is a public catalogue with no per-user
-- rows, so there is no row-level leak — only the prompt columns are sensitive,
-- and those are simply not selected.
-- ----------------------------------------------------------------------------
create view public.checks_public as
select
  c.id,
  c.code,
  c.name_en,
  c.name_de,
  c.description_en,
  c.description_de,
  c.processing_mode,
  c.page_scope,
  c.is_active,
  c.sort_order,
  cv.id      as active_version_id,
  cv.version as active_version,
  cv.locale  as active_version_locale
from public.checks c
left join public.check_versions cv
  on cv.check_id = c.id and cv.is_active;

comment on view public.checks_public is
  'Prompt-free projection of checks. This is what the app reads; check_versions is never exposed.';
