-- ============================================================================
-- 17_page_dimensions.sql — page geometry for the P7 viewer.
-- ============================================================================
-- P1 stored per-word bounding boxes but not the size of the page they sit on.
-- Without the page dimensions those coordinates are unusable: the viewer has
-- no way to map a box in PDF units onto a rendered canvas at an arbitrary
-- zoom level.
--
-- Storing dimensions rather than pre-scaled pixels is deliberate. Pixels bake
-- in one zoom level, so any other scale misplaces every highlight — and page
-- size varies within a document (a landscape figure page among portrait
-- prose), so a single document-level constant would not do either.
-- ============================================================================

alter table public.paper_pages
  add column if not exists page_width  real not null default 595,
  add column if not exists page_height real not null default 842;

-- Defaults are A4 in PDF points, which is what an unparsed row would most
-- likely have been. The parser always writes real values, so the default only
-- ever applies to rows that predate this migration — of which there are none.
comment on column public.paper_pages.page_width is
  'Page width in PDF units (points), scale 1. P7 scales at render time.';
comment on column public.paper_pages.page_height is
  'Page height in PDF units (points), scale 1. Word y-coordinates are relative to this.';
