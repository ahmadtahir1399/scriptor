-- ============================================================================
-- 18_analysis_cost.sql — cost fields on paper_analyses (P4).
-- ============================================================================
-- The analysis engine writes a pre-flight estimate and, when the ceiling is
-- crossed, a machine-readable reason. P1's paper_analyses has error_message for
-- human text, but the cost guard needs a stable code the UI can localise —
-- "COST_CEILING" must map to a specific message, and matching on free text
-- would be fragile.
-- ============================================================================

alter table public.paper_analyses
  add column if not exists estimated_cost_usd numeric(12, 6),
  add column if not exists error_reason text;

comment on column public.paper_analyses.estimated_cost_usd is
  'Pre-flight cost estimate in USD, written before any check runs. Baseline for the guard and the UI expectation.';
comment on column public.paper_analyses.error_reason is
  'Machine-readable failure code (e.g. COST_CEILING, ALL_CHECKS_FAILED). UI maps it to a localised message; error_message holds any human detail.';
