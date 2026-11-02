import type { Enums } from "@/lib/db/types.generated";

/**
 * The ONLY place enum values exist in TypeScript.
 *
 * Each tuple is checked against the generated type by `satisfies`, so if a value
 * is added in SQL and `npm run db:types` is run, any tuple here that was not
 * updated becomes a compile error rather than a silent runtime gap. That check
 * is the whole point of this file — without it the tuples would drift from the
 * database and nothing would notice until a user hit the missing case.
 *
 * Zod schemas call `z.enum(JOB_STATUSES)`. No file anywhere else may write a
 * string union of these values by hand.
 */

/** Helper: asserts a tuple covers exactly the members of a generated enum. */
type ExactTuple<
  TEnum extends string,
  TTuple extends readonly TEnum[],
> = TEnum extends TTuple[number] ? TTuple : never;

export type JobStatus = Enums<"job_status">;
export const JOB_STATUSES = [
  "NONE",
  "GENERATING",
  "DONE",
  "ERROR",
] as const satisfies ExactTuple<JobStatus, readonly JobStatus[]>;

export type AnalysisStatus = Enums<"analysis_status">;
export const ANALYSIS_STATUSES = [
  "GENERATING",
  "DONE",
  "ERROR",
] as const satisfies ExactTuple<AnalysisStatus, readonly AnalysisStatus[]>;

export type JobKind = Enums<"job_kind">;
export const JOB_KINDS = [
  "COMPATIBILITY",
  "PARSE",
  "IDENTIFY_PAGES",
  "RUN_CHECK",
  "GRAMMAR",
  "BIBLIOGRAPHY",
  "REFERENCE_HEALTH",
  "AI_DETECTION",
  "TODO_LIST",
  "DEFENSE_QUESTIONS",
  "EXTRACT_REQUIREMENTS",
  "POST_PROCESSING",
] as const satisfies ExactTuple<JobKind, readonly JobKind[]>;

export type PageType = Enums<"page_type">;
export const PAGE_TYPES = [
  "COVER",
  "ABSTRACT",
  "TOC",
  "LIST_OF_ABBREVIATIONS",
  "BODY",
  "BIBLIOGRAPHY",
  "APPENDIX",
  "OTHER",
] as const satisfies ExactTuple<PageType, readonly PageType[]>;

export type CitationStyle = Enums<"citation_style">;
export const CITATION_STYLES = [
  "APA_7",
  "APA_6",
  "MLA_9",
  "CHICAGO_17",
  "HARVARD",
  "VANCOUVER",
  "OXFORD",
  "TURABIAN",
  "IEEE",
  "ISO_690",
] as const satisfies ExactTuple<CitationStyle, readonly CitationStyle[]>;

export type AppLocale = Enums<"app_locale">;
export const APP_LOCALES = ["DE", "EN"] as const satisfies ExactTuple<
  AppLocale,
  readonly AppLocale[]
>;

export type SpellingVariant = Enums<"spelling_variant">;
export const SPELLING_VARIANTS = [
  "DE_CH",
  "DE_DE",
  "EN_UK",
  "EN_US",
] as const satisfies ExactTuple<SpellingVariant, readonly SpellingVariant[]>;

export type ProcessingMode = Enums<"processing_mode">;
export const PROCESSING_MODES = [
  "ALL_PAGES",
  "INDIVIDUAL_PAGES",
] as const satisfies ExactTuple<ProcessingMode, readonly ProcessingMode[]>;

export type FindingType = Enums<"finding_type">;
export const FINDING_TYPES = [
  "GRAMMAR",
  "SPELLING",
  "PUNCTUATION",
  "STYLE",
] as const satisfies ExactTuple<FindingType, readonly FindingType[]>;

export type FindingSeverity = Enums<"finding_severity">;
export const FINDING_SEVERITIES = [
  "LOW",
  "MEDIUM",
  "HIGH",
] as const satisfies ExactTuple<FindingSeverity, readonly FindingSeverity[]>;

export type ReferenceHealth = Enums<"reference_health">;
export const REFERENCE_HEALTHS = [
  "VERIFIED",
  "NEEDS_CORRECTION",
  "BROKEN_URL",
  "NOT_FOUND",
  "UNCHECKED",
] as const satisfies ExactTuple<ReferenceHealth, readonly ReferenceHealth[]>;

export type FileFormat = Enums<"file_format">;
export const FILE_FORMATS = ["PDF", "DOCX"] as const satisfies ExactTuple<
  FileFormat,
  readonly FileFormat[]
>;

export type LlmOperation = Enums<"llm_operation">;
export const LLM_OPERATIONS = [
  "COMPATIBILITY",
  "IDENTIFY_PAGES",
  "GRAMMAR",
  "RATED_CHECK",
  "BIBLIOGRAPHY",
  "DEFENSE_QUESTIONS",
  "POST_PROCESSING",
  "GENDERING",
  "REFERENCE",
  "REFERENCE_HEALTH",
  "COMPARE_RESULTS",
  "UNIVERSITY_EXTRACTION",
  "EXTRACT_REQUIREMENTS",
] as const satisfies ExactTuple<LlmOperation, readonly LlmOperation[]>;

export type AppRole = Enums<"app_role">;
export const APP_ROLES = [
  "ADMIN",
  "USER",
  "STATS_VIEWER",
  "CHECK_MANAGER",
] as const satisfies ExactTuple<AppRole, readonly AppRole[]>;

export type AppPermission = Enums<"app_permission">;
export const APP_PERMISSIONS = [
  "VIEW_ANALYTICS_DASHBOARD",
  "VIEW_SHARED_PAPERS",
  "MANAGE_CHECKS",
  "MANAGE_CHECK_VERSIONS",
  "FULL_DATA_ACCESS",
] as const satisfies ExactTuple<AppPermission, readonly AppPermission[]>;

export type NotificationType = Enums<"notification_type">;
export const NOTIFICATION_TYPES = [
  "ANALYSIS_COMPLETE",
  "ANALYSIS_FAILED",
  "UPLOAD_INCOMPATIBLE",
  "REFERENCE_ISSUES_FOUND",
  "REQUIREMENTS_EXTRACTED",
  "TODO_DUE_SOON",
] as const satisfies ExactTuple<NotificationType, readonly NotificationType[]>;

export type AdminActionType = Enums<"admin_action_type">;
export const ADMIN_ACTION_TYPES = [
  "GRANT_ROLE",
  "REVOKE_ROLE",
  "ANONYMIZE_USER",
  "DELETE_USER",
  "REQUEUE_ANALYSIS",
] as const satisfies ExactTuple<AdminActionType, readonly AdminActionType[]>;

/** Terminal job states — a job in one of these will not change again. */
export const TERMINAL_JOB_STATUSES: readonly JobStatus[] = ["DONE", "ERROR"];

export function isTerminalJobStatus(status: JobStatus): boolean {
  return TERMINAL_JOB_STATUSES.includes(status);
}
