-- ============================================================================
-- 11_defense.sql — viva / defense preparation.
-- ============================================================================
-- Generated questions a committee might plausibly ask, grouped by theme, plus
-- practice sessions where the student answers them and gets scored.
--
-- Four tables rather than two because a question is generated once but answered
-- many times across many practice runs, and the student needs to see whether
-- their answer to the same question improved.
-- ============================================================================

create table public.defense_question_groups (
  id                  uuid primary key default gen_random_uuid(),
  paper_analysis_id   uuid not null references public.paper_analyses (id) on delete cascade,
  paper_id            uuid not null references public.papers (id) on delete cascade,
  user_id             uuid not null references auth.users (id) on delete cascade,

  title               text not null,
  description         text not null default '',
  sort_order          integer not null default 0,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint defense_question_groups_title_not_empty check (length(btrim(title)) > 0)
);

create index defense_question_groups_analysis_idx
  on public.defense_question_groups (paper_analysis_id);
create index defense_question_groups_paper_id_idx on public.defense_question_groups (paper_id);
create index defense_question_groups_user_id_idx on public.defense_question_groups (user_id);

create trigger defense_question_groups_set_user_id
  before insert on public.defense_question_groups
  for each row execute function public.set_user_id_from_paper_analysis();

create trigger defense_question_groups_set_updated_at
  before update on public.defense_question_groups
  for each row execute function public.set_updated_at();

comment on table public.defense_question_groups is 'Thematic grouping of likely defense questions.';

-- ----------------------------------------------------------------------------
-- defense_questions — the question, plus the model's own reference answer and
-- the passage of the thesis it came from. Showing the student where in their
-- own work the answer lives is most of the value.
-- ----------------------------------------------------------------------------
create table public.defense_questions (
  id                          uuid primary key default gen_random_uuid(),
  defense_question_group_id   uuid not null
                                references public.defense_question_groups (id) on delete cascade,
  user_id                     uuid not null references auth.users (id) on delete cascade,

  question                    text not null,
  reference_answer            text not null default '',
  source_quote                text,
  page_number                 integer check (page_number > 0),
  difficulty                  public.finding_severity not null default 'MEDIUM',
  sort_order                  integer not null default 0,

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  constraint defense_questions_question_not_empty check (length(btrim(question)) > 0)
);

create index defense_questions_group_idx
  on public.defense_questions (defense_question_group_id);
create index defense_questions_user_id_idx on public.defense_questions (user_id);

create trigger defense_questions_set_user_id
  before insert on public.defense_questions
  for each row execute function public.set_user_id_from_defense_group();

create trigger defense_questions_set_updated_at
  before update on public.defense_questions
  for each row execute function public.set_updated_at();

comment on table public.defense_questions is
  'A likely committee question, its reference answer, and where in the thesis it comes from.';

-- ----------------------------------------------------------------------------
-- defense_practices — one practice session.
-- ----------------------------------------------------------------------------
create table public.defense_practices (
  id                  uuid primary key default gen_random_uuid(),
  paper_analysis_id   uuid not null references public.paper_analyses (id) on delete cascade,
  user_id             uuid not null references auth.users (id) on delete cascade,

  started_at          timestamptz not null default now(),
  completed_at        timestamptz,
  question_count      integer not null default 0 check (question_count >= 0),
  answered_count      integer not null default 0 check (answered_count >= 0),
  average_score       numeric(5, 2) check (average_score between 0 and 100),

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index defense_practices_analysis_idx on public.defense_practices (paper_analysis_id);
create index defense_practices_user_id_idx on public.defense_practices (user_id);
create index defense_practices_user_started_idx
  on public.defense_practices (user_id, started_at desc);

create trigger defense_practices_set_user_id
  before insert on public.defense_practices
  for each row execute function public.set_user_id_from_paper_analysis();

create trigger defense_practices_set_updated_at
  before update on public.defense_practices
  for each row execute function public.set_updated_at();

comment on table public.defense_practices is 'One practice run over a set of defense questions.';

-- ----------------------------------------------------------------------------
-- defense_question_answers — what the student said, and how it scored.
--
-- Keyed by (practice, question) so the same question answered in two different
-- sessions produces two rows, which is what makes progress visible.
-- ----------------------------------------------------------------------------
create table public.defense_question_answers (
  id                      uuid primary key default gen_random_uuid(),
  defense_practice_id     uuid not null references public.defense_practices (id) on delete cascade,
  defense_question_id     uuid not null references public.defense_questions (id) on delete cascade,
  user_id                 uuid not null references auth.users (id) on delete cascade,

  answer_text             text not null default '',
  score                   numeric(5, 2) check (score between 0 and 100),
  feedback                text,
  answered_at             timestamptz not null default now(),

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint defense_question_answers_unique
    unique (defense_practice_id, defense_question_id)
);

create index defense_question_answers_practice_idx
  on public.defense_question_answers (defense_practice_id);
create index defense_question_answers_question_idx
  on public.defense_question_answers (defense_question_id);
create index defense_question_answers_user_id_idx
  on public.defense_question_answers (user_id);

create trigger defense_question_answers_set_user_id
  before insert on public.defense_question_answers
  for each row execute function public.set_user_id_from_defense_question();

create trigger defense_question_answers_set_updated_at
  before update on public.defense_question_answers
  for each row execute function public.set_updated_at();

comment on table public.defense_question_answers is
  'One answer in one practice session. Same question across sessions shows progress.';
