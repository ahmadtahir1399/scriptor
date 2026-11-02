-- ============================================================================
-- 09_requirements.sql — the student's own supervisor/faculty requirements.
-- ============================================================================
-- A student uploads their department's formatting guide; the extraction job
-- turns it into discrete, checkable requirement rows; those get attached to an
-- upload so the analysis can grade against the actual rules of their school
-- rather than a generic standard.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- requirement_files — an uploaded guideline document.
-- Path convention: {user_id}/{requirement_file_id}/{filename} in the private
-- `requirements` bucket.
-- ----------------------------------------------------------------------------
create table public.requirement_files (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  institution_id      uuid references public.institutions (id) on delete set null,

  file_path           text not null,
  file_name           text not null,
  file_format         public.file_format not null,
  file_size_bytes     bigint not null check (file_size_bytes > 0),

  title               text not null default '',
  extraction_status   public.job_status not null default 'NONE',
  extraction_error    text,
  extracted_at        timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index requirement_files_user_id_idx on public.requirement_files (user_id);
create index requirement_files_institution_id_idx on public.requirement_files (institution_id);
create unique index requirement_files_file_path_idx on public.requirement_files (file_path);

create trigger requirement_files_set_updated_at
  before update on public.requirement_files
  for each row execute function public.set_updated_at();

comment on table public.requirement_files is 'Uploaded faculty guideline documents.';

-- ----------------------------------------------------------------------------
-- requirements — one discrete, checkable rule extracted from a file.
--
-- is_mandatory separates "must" from "should": a violated mandatory rule is a
-- critical finding, a violated optional one is advisory.
-- ----------------------------------------------------------------------------
create table public.requirements (
  id                    uuid primary key default gen_random_uuid(),
  requirement_file_id   uuid not null references public.requirement_files (id) on delete cascade,
  user_id               uuid not null references auth.users (id) on delete cascade,

  code                  text,
  title                 text not null,
  description           text not null default '',
  category              text,
  source_quote          text,

  is_mandatory          boolean not null default true,
  is_enabled            boolean not null default true,
  sort_order            integer not null default 0,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint requirements_title_not_empty check (length(btrim(title)) > 0)
);

create index requirements_file_id_idx on public.requirements (requirement_file_id);
create index requirements_user_id_idx on public.requirements (user_id);
create index requirements_enabled_idx
  on public.requirements (requirement_file_id)
  where is_enabled;

create trigger requirements_set_user_id
  before insert on public.requirements
  for each row execute function public.set_user_id_from_requirement_file();

create trigger requirements_set_updated_at
  before update on public.requirements
  for each row execute function public.set_updated_at();

comment on table public.requirements is 'One discrete checkable rule extracted from a requirement file.';

-- ----------------------------------------------------------------------------
-- upload_requirements — which requirements were applied to which upload, and
-- how the document scored against each.
--
-- The requirement FK is ON DELETE CASCADE: if the student deletes the source
-- rule, the grading against it goes too, because it can no longer be explained.
-- ----------------------------------------------------------------------------
create table public.upload_requirements (
  id                  uuid primary key default gen_random_uuid(),
  paper_upload_id     uuid not null references public.paper_uploads (id) on delete cascade,
  requirement_id      uuid not null references public.requirements (id) on delete cascade,
  paper_analysis_id   uuid references public.paper_analyses (id) on delete cascade,
  user_id             uuid not null references auth.users (id) on delete cascade,

  status              public.job_status not null default 'NONE',
  is_satisfied        boolean,
  evidence_quote      text,
  explanation         text,
  page_number         integer check (page_number > 0),

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint upload_requirements_unique unique (paper_upload_id, requirement_id)
);

create index upload_requirements_upload_idx on public.upload_requirements (paper_upload_id);
create index upload_requirements_requirement_idx on public.upload_requirements (requirement_id);
create index upload_requirements_analysis_idx on public.upload_requirements (paper_analysis_id);
create index upload_requirements_user_id_idx on public.upload_requirements (user_id);

create trigger upload_requirements_set_user_id
  before insert on public.upload_requirements
  for each row execute function public.set_user_id_from_paper_upload();

create trigger upload_requirements_set_updated_at
  before update on public.upload_requirements
  for each row execute function public.set_updated_at();

comment on table public.upload_requirements is
  'Which requirements were applied to an upload and how it scored against each.';
