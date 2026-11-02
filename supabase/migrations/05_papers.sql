-- ============================================================================
-- 05_papers.sql — the document aggregate root.
-- ============================================================================
-- `papers` is stable identity: "my master's thesis", one row, forever.
-- `paper_uploads` is one immutable row per submitted file. Revising a draft
-- inserts a NEW upload against the SAME paper — it never updates the old one.
-- That is what makes draft-over-draft comparison possible in a later prompt,
-- and what keeps an analysis permanently tied to the exact bytes it read.
-- ============================================================================

create table public.papers (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  title                 text not null default '',
  -- Both nullable and both set AFTER the child rows exist, so these are
  -- deferred FKs added at the bottom of this file rather than inline columns.
  current_upload_id     uuid,
  current_analysis_id   uuid,
  is_archived           boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index papers_user_id_idx on public.papers (user_id);
create index papers_user_id_created_at_idx on public.papers (user_id, created_at desc);

create trigger papers_set_updated_at
  before update on public.papers
  for each row execute function public.set_updated_at();

comment on table public.papers is
  'Stable identity for a document across drafts. Deleting cascades everything beneath it.';

-- ----------------------------------------------------------------------------
-- paper_uploads — immutable after ingestion.
--
-- Carries four groups of columns:
--   1. provenance    — file_path, file_format, file_size_bytes, checksum
--   2. extracted     — title, author, pages, words, locale, spelling, style
--   3. gate          — is_compatible, incompatibility_reason
--   4. user settings — auto_delete, share_data, selected_check_ids, …
--
-- file_path points into the private `papers` storage bucket and follows
-- {user_id}/{paper_upload_id}/source.pdf. No public URL is ever generated.
-- ----------------------------------------------------------------------------
create table public.paper_uploads (
  id                        uuid primary key default gen_random_uuid(),
  paper_id                  uuid not null references public.papers (id) on delete cascade,
  -- Denormalised from papers so RLS never needs a join. Set by trigger.
  user_id                   uuid not null references auth.users (id) on delete cascade,

  -- Provenance
  file_path                 text not null,
  file_name                 text not null,
  file_format               public.file_format not null,
  file_size_bytes           bigint not null check (file_size_bytes > 0),
  checksum_sha256           text,

  -- Extracted metadata
  title                     text,
  author                    text,
  page_count                integer check (page_count >= 0),
  word_count                integer check (word_count >= 0),
  char_count                integer check (char_count >= 0),
  locale                    public.app_locale,
  spelling                  public.spelling_variant,
  citation_style            public.citation_style,
  document_type_code        text references public.document_types (code) on delete set null,

  -- Compatibility gate. NULL means "not yet evaluated".
  is_compatible             boolean,
  incompatibility_reason    text,

  -- User settings, captured at upload time
  auto_delete               boolean not null default false,
  share_data                boolean not null default false,
  send_email_results        boolean not null default true,
  selected_check_ids        uuid[] not null default '{}'::uuid[],
  use_custom_requirements   boolean not null default false,

  uploaded_at               timestamptz not null default now(),
  parsed_at                 timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index paper_uploads_paper_id_idx on public.paper_uploads (paper_id);
create index paper_uploads_user_id_idx on public.paper_uploads (user_id);
create index paper_uploads_user_id_created_at_idx
  on public.paper_uploads (user_id, created_at desc);
create unique index paper_uploads_file_path_idx on public.paper_uploads (file_path);

create trigger paper_uploads_set_user_id
  before insert on public.paper_uploads
  for each row execute function public.set_user_id_from_paper();

create trigger paper_uploads_set_updated_at
  before update on public.paper_uploads
  for each row execute function public.set_updated_at();

comment on table public.paper_uploads is
  'One immutable row per submitted file. A revised draft is a new row, never an update.';
comment on column public.paper_uploads.selected_check_ids is
  'Checks the student chose to run. Denormalised array — the authoritative record is check_results.';

-- ----------------------------------------------------------------------------
-- upload_entitlements — write-once snapshot of what this upload may do.
--
-- There is no billing yet, so every flag defaults to true and source is 'FREE'.
-- The table exists anyway because entitlement is decided ONCE at upload time
-- rather than read live off the account. That distinction is what makes adding
-- paid tiers later a single prompt with no refactor: an analysis from last year
-- keeps the entitlements it was granted, even if the user has since downgraded.
--
-- UPDATE is blocked by trigger. Correcting an entitlement means inserting a new
-- upload, which is the same rule the rest of this aggregate follows.
-- ----------------------------------------------------------------------------
create table public.upload_entitlements (
  id                    uuid primary key default gen_random_uuid(),
  paper_upload_id       uuid not null unique
                          references public.paper_uploads (id) on delete cascade,
  user_id               uuid not null references auth.users (id) on delete cascade,

  allow_defense         boolean not null default true,
  allow_todo            boolean not null default true,
  allow_page_feedback   boolean not null default true,
  allow_ai_detection    boolean not null default true,
  allow_reference_health boolean not null default true,

  max_checks            integer not null default 100 check (max_checks >= 0),
  tier                  text not null default 'FREE',
  source                text not null default 'FREE',

  created_at            timestamptz not null default now()
);

create index upload_entitlements_user_id_idx on public.upload_entitlements (user_id);

create trigger upload_entitlements_set_user_id
  before insert on public.upload_entitlements
  for each row execute function public.set_user_id_from_paper_upload();

create trigger upload_entitlements_forbid_update
  before update on public.upload_entitlements
  for each row execute function public.forbid_update();

comment on table public.upload_entitlements is
  'Write-once snapshot of what an upload is allowed to do. UPDATE blocked by trigger.';

-- ----------------------------------------------------------------------------
-- Deferred FKs on papers.
--
-- Added here because papers is created before paper_uploads, and
-- current_analysis_id points at a table that does not exist until 07.
-- ON DELETE SET NULL: losing the current upload must not delete the paper.
-- ----------------------------------------------------------------------------
alter table public.papers
  add constraint papers_current_upload_id_fkey
  foreign key (current_upload_id)
  references public.paper_uploads (id) on delete set null;

create index papers_current_upload_id_idx on public.papers (current_upload_id);
