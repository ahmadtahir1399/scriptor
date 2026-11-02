-- ============================================================================
-- 08_references.sql — citation health.
-- ============================================================================
-- The product insight here: the interesting output is not the two lists, it is
-- the ORPHANS falling out of joining them. reference_pairs has both sides
-- nullable precisely so an unmatched entry on either side is representable:
--
--   in_text_reference_id set, bibliography_reference_id null
--     → cited in the text but missing from the bibliography
--   in_text_reference_id null, bibliography_reference_id set
--     → listed in the bibliography but never actually cited
--   both set
--     → a matched pair; confidence records how sure the matcher was
-- ============================================================================

-- ----------------------------------------------------------------------------
-- in_text_references — every citation occurrence in the body text.
-- ----------------------------------------------------------------------------
create table public.in_text_references (
  id                  uuid primary key default gen_random_uuid(),
  paper_analysis_id   uuid not null references public.paper_analyses (id) on delete cascade,
  paper_upload_id     uuid not null references public.paper_uploads (id) on delete cascade,
  user_id             uuid not null references auth.users (id) on delete cascade,

  raw_text            text not null,
  authors             text[] not null default '{}'::text[],
  year                text,
  locator             text,

  page_number         integer check (page_number > 0),
  char_start          integer check (char_start >= 0),
  char_end            integer check (char_end >= 0),
  word_index_start    integer check (word_index_start >= 0),
  word_index_end      integer check (word_index_end >= 0),

  is_matched          boolean not null default false,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint in_text_references_raw_text_not_empty check (length(btrim(raw_text)) > 0)
);

create index in_text_references_analysis_idx on public.in_text_references (paper_analysis_id);
create index in_text_references_upload_idx on public.in_text_references (paper_upload_id);
create index in_text_references_user_id_idx on public.in_text_references (user_id);
create index in_text_references_unmatched_idx
  on public.in_text_references (paper_analysis_id)
  where not is_matched;

create trigger in_text_references_set_user_id
  before insert on public.in_text_references
  for each row execute function public.set_user_id_from_paper_analysis();

create trigger in_text_references_set_updated_at
  before update on public.in_text_references
  for each row execute function public.set_updated_at();

comment on table public.in_text_references is 'Every citation occurrence found in the body text.';

-- ----------------------------------------------------------------------------
-- bibliography_references — every entry in the reference list, plus the result
-- of trying to verify it actually exists.
--
-- health defaults to UNCHECKED, which is distinct from NOT_FOUND: we have not
-- looked yet, versus we looked and it is not there.
-- ----------------------------------------------------------------------------
create table public.bibliography_references (
  id                  uuid primary key default gen_random_uuid(),
  paper_analysis_id   uuid not null references public.paper_analyses (id) on delete cascade,
  paper_upload_id     uuid not null references public.paper_uploads (id) on delete cascade,
  user_id             uuid not null references auth.users (id) on delete cascade,

  raw_text            text not null,
  authors             text[] not null default '{}'::text[],
  title               text,
  year                text,
  publisher           text,
  journal             text,
  volume              text,
  issue               text,
  pages               text,
  doi                 text,
  url                 text,
  isbn                text,

  entry_index         integer check (entry_index >= 0),
  page_number         integer check (page_number > 0),

  health              public.reference_health not null default 'UNCHECKED',
  health_detail       text,
  health_checked_at   timestamptz,
  resolved_url        text,

  is_matched          boolean not null default false,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint bibliography_references_raw_text_not_empty check (length(btrim(raw_text)) > 0)
);

create index bibliography_references_analysis_idx
  on public.bibliography_references (paper_analysis_id);
create index bibliography_references_upload_idx
  on public.bibliography_references (paper_upload_id);
create index bibliography_references_user_id_idx on public.bibliography_references (user_id);
create index bibliography_references_health_idx
  on public.bibliography_references (paper_analysis_id, health);
create index bibliography_references_doi_idx on public.bibliography_references (doi);
create index bibliography_references_unmatched_idx
  on public.bibliography_references (paper_analysis_id)
  where not is_matched;

create trigger bibliography_references_set_user_id
  before insert on public.bibliography_references
  for each row execute function public.set_user_id_from_paper_analysis();

create trigger bibliography_references_set_updated_at
  before update on public.bibliography_references
  for each row execute function public.set_updated_at();

comment on table public.bibliography_references is
  'Reference-list entries plus verification result. UNCHECKED ≠ NOT_FOUND.';

-- ----------------------------------------------------------------------------
-- reference_pairs — the join, including the orphans on both sides.
--
-- Both FKs are nullable. The CHECK below guarantees at least one side is
-- present, so a wholly empty pair can never exist.
-- ----------------------------------------------------------------------------
create table public.reference_pairs (
  id                          uuid primary key default gen_random_uuid(),
  paper_analysis_id           uuid not null references public.paper_analyses (id) on delete cascade,
  user_id                     uuid not null references auth.users (id) on delete cascade,

  in_text_reference_id        uuid references public.in_text_references (id) on delete cascade,
  bibliography_reference_id   uuid references public.bibliography_references (id) on delete cascade,

  match_confidence            numeric(4, 3) check (match_confidence between 0 and 1),
  is_orphan_in_text           boolean not null default false,
  is_orphan_bibliography      boolean not null default false,
  notes                       text,

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  -- A pair with neither side is meaningless.
  constraint reference_pairs_at_least_one_side check (
    in_text_reference_id is not null or bibliography_reference_id is not null
  )
);

create index reference_pairs_analysis_idx on public.reference_pairs (paper_analysis_id);
create index reference_pairs_user_id_idx on public.reference_pairs (user_id);
create index reference_pairs_in_text_idx on public.reference_pairs (in_text_reference_id);
create index reference_pairs_bibliography_idx on public.reference_pairs (bibliography_reference_id);
create index reference_pairs_orphans_idx
  on public.reference_pairs (paper_analysis_id)
  where is_orphan_in_text or is_orphan_bibliography;

create trigger reference_pairs_set_user_id
  before insert on public.reference_pairs
  for each row execute function public.set_user_id_from_paper_analysis();

create trigger reference_pairs_set_updated_at
  before update on public.reference_pairs
  for each row execute function public.set_updated_at();

comment on table public.reference_pairs is
  'Citation ↔ bibliography join. A null side is an orphan, and the orphans are the finding.';
