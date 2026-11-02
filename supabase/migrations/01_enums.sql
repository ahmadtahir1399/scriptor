-- ============================================================================
-- 01_enums.sql — every enum in the system, declared before any table uses one.
-- ============================================================================
-- This file is the single source of truth for every closed value set in the
-- product. `lib/db/enums.ts` derives its TypeScript tuples from the generated
-- types, which derive from these declarations — so adding a value here and
-- running `npm run db:types` propagates it to every layer with zero hand edits.
--
-- Adding a value later:   alter type public.<name> add value 'NEW_VALUE';
-- Removing one is not possible without recreating the type. Choose carefully.
-- ============================================================================

-- Status of a single queued unit of work.
create type public.job_status as enum (
  'NONE',        -- not requested — distinct from failed
  'GENERATING',
  'DONE',
  'ERROR'
);

-- Status of the parent analysis. Has no NONE: an analysis row only exists once
-- work has actually started.
create type public.analysis_status as enum (
  'GENERATING',
  'DONE',
  'ERROR'
);

-- What a queued job actually does. One value per worker branch in P4.
create type public.job_kind as enum (
  'COMPATIBILITY',
  'PARSE',
  'IDENTIFY_PAGES',
  'RUN_CHECK',
  'GRAMMAR',
  'BIBLIOGRAPHY',
  'REFERENCE_HEALTH',
  'AI_DETECTION',
  'TODO_LIST',
  'DEFENSE_QUESTIONS',
  'EXTRACT_REQUIREMENTS',
  'POST_PROCESSING'
);

-- Structural classification of a page. This is what lets a check read only the
-- pages it cares about instead of the whole document.
create type public.page_type as enum (
  'COVER',
  'ABSTRACT',
  'TOC',
  'LIST_OF_ABBREVIATIONS',
  'BODY',
  'BIBLIOGRAPHY',
  'APPENDIX',
  'OTHER'
);

create type public.citation_style as enum (
  'APA_7',
  'APA_6',
  'MLA_9',
  'CHICAGO_17',
  'HARVARD',
  'VANCOUVER',
  'OXFORD',
  'TURABIAN',
  'IEEE',
  'ISO_690'
);

-- UI language. Matches the two locales in `i18n/routing.ts`.
create type public.app_locale as enum (
  'DE',
  'EN'
);

-- Orthographic variant, which is not the same thing as UI language: a student
-- may read the interface in English while writing in Swiss German.
create type public.spelling_variant as enum (
  'DE_CH',
  'DE_DE',
  'EN_UK',
  'EN_US'
);

-- Whether a check reasons over the whole document at once or page by page.
create type public.processing_mode as enum (
  'ALL_PAGES',
  'INDIVIDUAL_PAGES'
);

create type public.finding_type as enum (
  'GRAMMAR',
  'SPELLING',
  'PUNCTUATION',
  'STYLE'
);

create type public.finding_severity as enum (
  'LOW',
  'MEDIUM',
  'HIGH'
);

-- Result of verifying that a cited source actually exists and is reachable.
create type public.reference_health as enum (
  'VERIFIED',
  'NEEDS_CORRECTION',
  'BROKEN_URL',
  'NOT_FOUND',
  'UNCHECKED'
);

create type public.file_format as enum (
  'PDF',
  'DOCX'
);

-- Billing/telemetry dimension for `token_usage`. Every LLM call is attributed
-- to exactly one of these so cost per analysis is decomposable.
create type public.llm_operation as enum (
  'COMPATIBILITY',
  'IDENTIFY_PAGES',
  'GRAMMAR',
  'RATED_CHECK',
  'BIBLIOGRAPHY',
  'DEFENSE_QUESTIONS',
  'POST_PROCESSING',
  'GENDERING',
  'REFERENCE',
  'REFERENCE_HEALTH',
  'COMPARE_RESULTS',
  'UNIVERSITY_EXTRACTION',
  'EXTRACT_REQUIREMENTS'
);

create type public.app_role as enum (
  'ADMIN',
  'USER',
  'STATS_VIEWER',
  'CHECK_MANAGER'
);

create type public.app_permission as enum (
  'VIEW_ANALYTICS_DASHBOARD',
  'VIEW_SHARED_PAPERS',
  'MANAGE_CHECKS',
  'MANAGE_CHECK_VERSIONS',
  'FULL_DATA_ACCESS'
);

create type public.notification_type as enum (
  'ANALYSIS_COMPLETE',
  'ANALYSIS_FAILED',
  'UPLOAD_INCOMPATIBLE',
  'REFERENCE_ISSUES_FOUND',
  'REQUIREMENTS_EXTRACTED',
  'TODO_DUE_SOON'
);

-- Audit trail vocabulary. Every privileged mutation writes one of these.
create type public.admin_action_type as enum (
  'GRANT_ROLE',
  'REVOKE_ROLE',
  'ANONYMIZE_USER',
  'DELETE_USER',
  'REQUEUE_ANALYSIS'
);
