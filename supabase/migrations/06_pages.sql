-- ============================================================================
-- 06_pages.sql — parsed document structure. Written by the ingestion worker
-- with the service role; never client-writable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- paper_pages — one row per page, with its structural classification.
--
-- page_type is the lever that keeps analysis affordable: a check scoped to BODY
-- reads only BODY pages instead of the entire document.
--
-- char_offset_start/end locate this page inside the full-document text, so a
-- finding reported against a global character offset can be resolved back to a
-- page without re-parsing.
-- ----------------------------------------------------------------------------
create table public.paper_pages (
  id                  uuid primary key default gen_random_uuid(),
  paper_upload_id     uuid not null references public.paper_uploads (id) on delete cascade,
  user_id             uuid not null references auth.users (id) on delete cascade,

  page_number         integer not null check (page_number > 0),
  page_content        text not null default '',
  page_type           public.page_type not null default 'OTHER',
  char_offset_start   integer not null default 0 check (char_offset_start >= 0),
  char_offset_end     integer not null default 0 check (char_offset_end >= 0),
  word_count          integer not null default 0 check (word_count >= 0),

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint paper_pages_unique_page unique (paper_upload_id, page_number),
  constraint paper_pages_offset_order check (char_offset_end >= char_offset_start)
);

create index paper_pages_paper_upload_id_idx on public.paper_pages (paper_upload_id);
create index paper_pages_user_id_idx on public.paper_pages (user_id);
create index paper_pages_type_idx on public.paper_pages (paper_upload_id, page_type);

create trigger paper_pages_set_user_id
  before insert on public.paper_pages
  for each row execute function public.set_user_id_from_paper_upload();

create trigger paper_pages_set_updated_at
  before update on public.paper_pages
  for each row execute function public.set_updated_at();

comment on table public.paper_pages is
  'One row per page with structural classification. Service-role write only.';

-- ----------------------------------------------------------------------------
-- words — every word with its bounding box. ~50,000 rows per thesis.
--
-- This is the largest table in the system by two orders of magnitude, and it is
-- the reason user_id is denormalised everywhere: an RLS policy that reached the
-- owner through paper_uploads → papers would add a join to every single row
-- read, and the highlight overlay in P7 would become unusable.
--
-- word_index is the document-global ordinal. A finding stores a
-- (word_index_start, word_index_end) range, which P7 resolves to the union of
-- these boxes to draw a highlight.
--
-- Coordinates are in PDF points with origin bottom-left, matching the source
-- document rather than the browser, so the viewer does one transform instead of
-- the parser guessing at a viewport.
-- ----------------------------------------------------------------------------
create table public.words (
  id                  bigint generated always as identity primary key,
  paper_upload_id     uuid not null references public.paper_uploads (id) on delete cascade,
  user_id             uuid not null references auth.users (id) on delete cascade,

  text                text not null,
  page_number         integer not null check (page_number > 0),
  word_index          integer not null check (word_index >= 0),

  x1                  real not null,
  y1                  real not null,
  x2                  real not null,
  y2                  real not null,
  width               real not null,
  height              real not null,

  created_at          timestamptz not null default now(),

  constraint words_unique_index unique (paper_upload_id, word_index)
);

-- The two access patterns, both covered:
--   P7 renders one page at a time  → (paper_upload_id, page_number)
--   Findings resolve an index span → (paper_upload_id, word_index)
create index words_upload_page_idx on public.words (paper_upload_id, page_number);
create index words_upload_word_index_idx on public.words (paper_upload_id, word_index);
create index words_user_id_idx on public.words (user_id);

create trigger words_set_user_id
  before insert on public.words
  for each row execute function public.set_user_id_from_paper_upload();

comment on table public.words is
  'Per-word bounding boxes, ~50k rows/thesis. Powers P7 highlight overlays. Service-role write only.';
comment on column public.words.word_index is
  'Document-global ordinal. findings.word_index_start/end reference this.';
