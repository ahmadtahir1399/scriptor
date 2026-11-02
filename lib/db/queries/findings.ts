import type { FindingSeverity, FindingType } from "@/lib/db/enums";
import type { Finding } from "@/lib/domain/analysis";
import type { Db } from "@/lib/db/queries/papers";

/** Finding reads and the one write a user is permitted. */

function unwrap<T>(
  result: { data: T; error: null } | { data: null; error: { message: string } },
  context: string,
): T {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  return result.data;
}

export interface FindingFilters {
  types?: readonly FindingType[];
  severities?: readonly FindingSeverity[];
  /** Omit for all; false for outstanding only. */
  isResolved?: boolean;
  pageNumber?: number;
}

/** All findings for an analysis, filtered — the P8 findings list. */
export async function listFindings(
  db: Db,
  analysisId: string,
  filters: FindingFilters = {},
): Promise<Finding[]> {
  let query = db
    .from("findings")
    .select("*")
    .eq("paper_analysis_id", analysisId);

  if (filters.types && filters.types.length > 0) {
    query = query.in("type", [...filters.types]);
  }
  if (filters.severities && filters.severities.length > 0) {
    query = query.in("severity", [...filters.severities]);
  }
  if (filters.isResolved !== undefined) {
    query = query.eq("is_resolved", filters.isResolved);
  }
  if (filters.pageNumber !== undefined) {
    query = query.eq("page_number", filters.pageNumber);
  }

  // Page order, then position within the page: the order a reader would meet
  // them working through the document.
  const result = await query
    .order("page_number", { ascending: true, nullsFirst: false })
    .order("word_index_start", { ascending: true, nullsFirst: false });

  return unwrap(result, "listFindings");
}

/** Findings on one page — drives the P7 highlight overlay. */
export async function listFindingsForPage(
  db: Db,
  analysisId: string,
  pageNumber: number,
): Promise<Finding[]> {
  return listFindings(db, analysisId, { pageNumber });
}

export async function listFindingsForCheckResult(
  db: Db,
  checkResultId: string,
): Promise<Finding[]> {
  const result = await db
    .from("findings")
    .select("*")
    .eq("check_result_id", checkResultId)
    .order("page_number", { ascending: true, nullsFirst: false });

  return unwrap(result, "listFindingsForCheckResult");
}

export async function getFinding(
  db: Db,
  findingId: string,
): Promise<Finding | null> {
  const result = await db
    .from("findings")
    .select("*")
    .eq("id", findingId)
    .maybeSingle();
  return unwrap(result, "getFinding");
}

/**
 * The only finding write a user is granted.
 *
 * `is_resolved` and `resolved_at` are the two columns in the UPDATE grant from
 * 15_rls.sql. `resolved_at` is set here rather than by trigger because it is a
 * user action timestamp, not a row-modification timestamp — `set_updated_at()`
 * already covers the latter.
 */
export async function setFindingResolved(
  db: Db,
  findingId: string,
  isResolved: boolean,
): Promise<void> {
  const result = await db
    .from("findings")
    .update({
      is_resolved: isResolved,
      resolved_at: isResolved ? new Date().toISOString() : null,
    })
    .eq("id", findingId);

  if (result.error) {
    throw new Error(`setFindingResolved: ${result.error.message}`);
  }
}

export interface FindingCounts {
  total: number;
  resolved: number;
  high: number;
  medium: number;
  low: number;
}

/**
 * Counts for the findings summary header.
 *
 * Selects only the three columns it needs. A thesis can carry several hundred
 * findings and pulling full rows to count them would be wasteful.
 */
export async function countFindings(
  db: Db,
  analysisId: string,
): Promise<FindingCounts> {
  const result = await db
    .from("findings")
    .select("severity, is_resolved, type")
    .eq("paper_analysis_id", analysisId);

  const rows = unwrap(result, "countFindings");

  return {
    total: rows.length,
    resolved: rows.filter((row) => row.is_resolved).length,
    high: rows.filter((row) => row.severity === "HIGH").length,
    medium: rows.filter((row) => row.severity === "MEDIUM").length,
    low: rows.filter((row) => row.severity === "LOW").length,
  };
}
