-- ============================================================================
-- 07_analysis.sql — analysis results.
-- ============================================================================
-- The user may rate a check result and resolve a finding. Everything else here
-- is service-role-write-only, enforced with COLUMN-LEVEL GRANTS in 15_rls.sql
-- rather than policy text alone — a policy can gate the row, but only a column
-- grant can stop a user rewriting the feedback they were given.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- paper_analyses — one run of the pipeline over one upload.
--
-- `status` is the overall roll-up. The five per-feature columns are INDEPENDENT
-- and default to NONE, which means "not requested" — a distinct state from
-- ERROR. A student who never asked for defense questions must not see a failure
-- badge for them.
--
-- recompute_analysis_status() in 12_jobs.sql is what maintains `status`.
-- ----------------------------------------------------------------------------
create table public.paper_analyses (
  id                        uuid primary key default gen_random_uuid(),
  paper_upload_id           uuid not null references public.paper_uploads (id) on delete cascade,
  paper_id                  uuid not null references public.papers (id) on delete cascade,
  user_id                   uuid not null references auth.users (id) on delete cascade,

  status                    public.analysis_status not null default 'GENERATING',

  -- Independent optional features. NONE = not requested, never "failed".
  plagiarism_status         public.job_status not null default 'NONE',
  todo_status               public.job_status not null default 'NONE',
  defense_status            public.job_status not null default 'NONE',
  reference_health_status   public.job_status not null default 'NONE',
  ai_detection_status       public.job_status not null default 'NONE',

  overall_score             numeric(5, 2) check (overall_score between 0 and 100),
  ai_strong_percent         numeric(5, 2) check (ai_strong_percent between 0 and 100),
  ai_likely_percent         numeric(5, 2) check (ai_likely_percent between 0 and 100),

  error_message             text,
  started_at                timestamptz not null default now(),
  completed_at              timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index paper_analyses_paper_upload_id_idx on public.paper_analyses (paper_upload_id);
create index paper_analyses_paper_id_idx on public.paper_analyses (paper_id);
create index paper_analyses_user_id_idx on public.paper_analyses (user_id);
create index paper_analyses_user_id_created_at_idx
  on public.paper_analyses (user_id, created_at desc);

create trigger paper_analyses_set_user_id
  before insert on public.paper_analyses
  for each row execute function public.set_user_id_from_paper_upload();

create trigger paper_analyses_set_updated_at
  before update on public.paper_analyses
  for each row execute function public.set_updated_at();

comment on table public.paper_analyses is
  'One pipeline run over one upload. Per-feature NONE means not requested, not failed.';

-- Deferred FK from 05 — papers.current_analysis_id could not be declared until now.
alter table public.papers
  add constraint papers_current_analysis_id_fkey
  foreign key (current_analysis_id)
  references public.paper_analyses (id) on delete set null;

create index papers_current_analysis_id_idx on public.papers (current_analysis_id);

-- ----------------------------------------------------------------------------
-- check_results — the output of one check against one analysis.
--
-- check_version_id is IMMUTABLE PROVENANCE, and it is ON DELETE RESTRICT for
-- that reason: a version that produced results can never be deleted, because
-- doing so would orphan the explanation of why a student was told what they
-- were told.
--
-- User-writable columns: rating, is_helpful, user_comment. Nothing else.
-- ----------------------------------------------------------------------------
create table public.check_results (
  id                        uuid primary key default gen_random_uuid(),
  paper_analysis_id         uuid not null references public.paper_analyses (id) on delete cascade,
  check_id                  uuid not null references public.checks (id) on delete restrict,
  check_version_id          uuid not null references public.check_versions (id) on delete restrict,
  user_id                   uuid not null references auth.users (id) on delete cascade,

  status                    public.job_status not null default 'NONE',

  feedback                  text,
  feedback_structured       jsonb not null default '{}'::jsonb,
  score                     numeric(5, 2) check (score between 0 and 100),

  -- Student feedback on the result.
  rating                    integer check (rating between 1 and 5),
  is_helpful                boolean,
  user_comment              text,

  -- Set when this result came from the losing arm of an A/B test.
  hidden_because_ab_test    boolean not null default false,
  ab_test_id                uuid references public.check_ab_tests (id) on delete set null,

  error_message             text,
  started_at                timestamptz,
  completed_at              timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint check_results_unique_per_analysis
    unique (paper_analysis_id, check_version_id)
);

create index check_results_paper_analysis_id_idx on public.check_results (paper_analysis_id);
create index check_results_user_id_idx on public.check_results (user_id);
create index check_results_check_id_idx on public.check_results (check_id);
create index check_results_check_version_id_idx on public.check_results (check_version_id);
-- P6 renders only visible results; partial index keeps that read tight.
create index check_results_visible_idx
  on public.check_results (paper_analysis_id)
  where not hidden_because_ab_test;

create trigger check_results_set_user_id
  before insert on public.check_results
  for each row execute function public.set_user_id_from_paper_analysis();

create trigger check_results_set_updated_at
  before update on public.check_results
  for each row execute function public.set_updated_at();

comment on table public.check_results is
  'One check output per analysis. check_version_id is immutable provenance.';
comment on column public.check_results.hidden_because_ab_test is
  'True for the losing arm of an A/B test — the student sees one answer per check.';

-- ----------------------------------------------------------------------------
-- findings — locatable grammar / spelling / style issues.
--
-- `quote` is the verbatim offending text and is NOT NULL by design. A finding
-- the model could not quote is unlocatable, and the ingestion layer drops it
-- rather than storing something P7 cannot anchor. The constraint below makes
-- that rule structural instead of a convention someone forgets.
--
-- The (word_index_start, word_index_end) range is what P7 resolves against
-- `words` to compute highlight boxes.
-- ----------------------------------------------------------------------------
create table public.findings (
  id                  uuid primary key default gen_random_uuid(),
  check_result_id     uuid not null references public.check_results (id) on delete cascade,
  paper_analysis_id   uuid not null references public.paper_analyses (id) on delete cascade,
  user_id             uuid not null references auth.users (id) on delete cascade,

  quote               text not null,
  correction          text,
  title               text not null,
  description         text not null default '',

  page_number         integer check (page_number > 0),
  char_start          integer check (char_start >= 0),
  char_end            integer check (char_end >= 0),
  word_index_start    integer check (word_index_start >= 0),
  word_index_end      integer check (word_index_end >= 0),

  type                public.finding_type not null,
  severity            public.finding_severity not null default 'MEDIUM',

  is_resolved         boolean not null default false,
  resolved_at         timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- A finding must be quotable, or it cannot be shown in the viewer.
  constraint findings_quote_not_empty check (length(btrim(quote)) > 0),
  constraint findings_char_range_order check (char_end is null or char_start is null or char_end >= char_start),
  constraint findings_word_range_order check (word_index_end is null or word_index_start is null or word_index_end >= word_index_start)
);

create index findings_check_result_id_idx on public.findings (check_result_id);
create index findings_paper_analysis_id_idx on public.findings (paper_analysis_id);
create index findings_user_id_idx on public.findings (user_id);
create index findings_page_idx on public.findings (paper_analysis_id, page_number);
create index findings_unresolved_idx
  on public.findings (paper_analysis_id)
  where not is_resolved;

create trigger findings_set_user_id
  before insert on public.findings
  for each row execute function public.set_user_id_from_check_result();

create trigger findings_set_updated_at
  before update on public.findings
  for each row execute function public.set_updated_at();

comment on table public.findings is
  'Locatable issues. quote is NOT NULL — an unquotable finding is unlocatable and is dropped.';
comment on column public.findings.word_index_start is
  'Resolved against words.word_index by P7 to draw highlight boxes.';
