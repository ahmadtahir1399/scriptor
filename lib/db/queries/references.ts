import type { JobStatus, ReferenceHealth } from "@/lib/db/enums";
import type { TablesInsert } from "@/lib/db/types.generated";
import { enqueueJob } from "@/lib/db/queries/jobs";
import type {
  BibliographyReference,
  InTextReference,
  ResolvedReferencePair,
} from "@/lib/domain/reference";
import type { PairResult } from "@/lib/references/reconcile";
import type { Db } from "@/lib/db/queries/papers";

/** Reference health reads — P9. */

function unwrap<T>(
  result: { data: T; error: null } | { data: null; error: { message: string } },
  context: string,
): T {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  return result.data;
}

export async function listInTextReferences(
  db: Db,
  analysisId: string,
): Promise<InTextReference[]> {
  const result = await db
    .from("in_text_references")
    .select("*")
    .eq("paper_analysis_id", analysisId)
    .order("page_number", { ascending: true, nullsFirst: false })
    .order("word_index_start", { ascending: true, nullsFirst: false });

  return unwrap(result, "listInTextReferences");
}

export async function listBibliographyReferences(
  db: Db,
  analysisId: string,
  health?: readonly ReferenceHealth[],
): Promise<BibliographyReference[]> {
  let query = db
    .from("bibliography_references")
    .select("*")
    .eq("paper_analysis_id", analysisId);

  if (health && health.length > 0) {
    query = query.in("health", [...health]);
  }

  const result = await query.order("entry_index", {
    ascending: true,
    nullsFirst: false,
  });

  return unwrap(result, "listBibliographyReferences");
}

/**
 * Pairs with both sides resolved.
 *
 * Both joins are nullable and that is the entire point of the table — a null
 * side is an orphan, and the orphans are what the student needs to act on.
 */
const PAIR_SELECT = `
  *,
  in_text_reference:in_text_references(*),
  bibliography_reference:bibliography_references(*)
`;

export async function listReferencePairs(
  db: Db,
  analysisId: string,
): Promise<ResolvedReferencePair[]> {
  const result = await db
    .from("reference_pairs")
    .select(PAIR_SELECT)
    .eq("paper_analysis_id", analysisId)
    .order("created_at", { ascending: true });

  return unwrap(
    result,
    "listReferencePairs",
  ) as unknown as ResolvedReferencePair[];
}

/**
 * Orphans only — the actionable subset, and the reason this feature exists.
 * Backed by the partial index `reference_pairs_orphans_idx`.
 */
export async function listOrphanPairs(
  db: Db,
  analysisId: string,
): Promise<ResolvedReferencePair[]> {
  const result = await db
    .from("reference_pairs")
    .select(PAIR_SELECT)
    .eq("paper_analysis_id", analysisId)
    .or("is_orphan_in_text.eq.true,is_orphan_bibliography.eq.true")
    .order("created_at", { ascending: true });

  return unwrap(
    result,
    "listOrphanPairs",
  ) as unknown as ResolvedReferencePair[];
}

/** Entries whose verification failed — broken links and unfindable sources. */
export async function listUnhealthyReferences(
  db: Db,
  analysisId: string,
): Promise<BibliographyReference[]> {
  return listBibliographyReferences(db, analysisId, [
    "NEEDS_CORRECTION",
    "BROKEN_URL",
    "NOT_FOUND",
  ]);
}

/** Everything the References page and its live hook render, in one place. */
export interface ReferenceHealthSnapshot {
  bibliography: BibliographyReference[];
  inText: InTextReference[];
  pairs: ResolvedReferencePair[];
}

export async function loadReferenceHealth(
  db: Db,
  analysisId: string,
): Promise<ReferenceHealthSnapshot> {
  const [bibliography, inText, pairs] = await Promise.all([
    listBibliographyReferences(db, analysisId),
    listInTextReferences(db, analysisId),
    listReferencePairs(db, analysisId),
  ]);
  return { bibliography, inText, pairs };
}

// ===========================================================================
// Writes — service-role only. All three reference tables grant SELECT (never
// INSERT/UPDATE) to `authenticated` in 15_rls.sql, so every function below must
// be called with the admin client. `user_id` is stamped by a BEFORE INSERT
// trigger, so it is intentionally omitted from every insert.
// ===========================================================================

/**
 * Clears prior reference output for an analysis, so the BIBLIOGRAPHY job is
 * idempotent — a retry replaces rather than duplicates. Pairs are deleted first
 * for clarity; the FK cascade would take them anyway.
 */
export async function clearReferenceData(
  db: Db,
  analysisId: string,
): Promise<void> {
  for (const table of [
    "reference_pairs",
    "in_text_references",
    "bibliography_references",
  ] as const) {
    const result = await db
      .from(table)
      .delete()
      .eq("paper_analysis_id", analysisId);
    if (result.error) {
      throw new Error(`clearReferenceData(${table}): ${result.error.message}`);
    }
  }
}

export interface BibliographyInsert {
  rawText: string;
  authors: string[];
  title: string | null;
  year: string | null;
  publisher: string | null;
  journal: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  doi: string | null;
  url: string | null;
  isbn: string | null;
  entryIndex: number;
  pageNumber: number | null;
}

/**
 * Bulk-inserts bibliography entries and returns their ids IN INPUT ORDER, so the
 * caller can pair them by position. PostgREST returns inserted rows in insertion
 * order, which is what makes the positional correlation safe here.
 */
export async function insertBibliographyReferences(
  db: Db,
  analysisId: string,
  uploadId: string,
  entries: readonly BibliographyInsert[],
): Promise<{ id: string }[]> {
  if (entries.length === 0) return [];

  const rows: TablesInsert<"bibliography_references">[] = entries.map(
    (entry) => ({
      paper_analysis_id: analysisId,
      paper_upload_id: uploadId,
      raw_text: entry.rawText,
      authors: entry.authors,
      title: entry.title,
      year: entry.year,
      publisher: entry.publisher,
      journal: entry.journal,
      volume: entry.volume,
      issue: entry.issue,
      pages: entry.pages,
      doi: entry.doi,
      url: entry.url,
      isbn: entry.isbn,
      entry_index: entry.entryIndex,
      page_number: entry.pageNumber,
    }),
  );

  const result = await db
    .from("bibliography_references")
    .insert(rows)
    .select("id");
  return unwrap(result, "insertBibliographyReferences");
}

export interface InTextInsert {
  rawText: string;
  authors: string[];
  year: string | null;
  locator: string | null;
  pageNumber: number;
  wordIndexStart: number | null;
  wordIndexEnd: number | null;
}

/** Bulk-inserts in-text citations, returning their ids in input order. */
export async function insertInTextReferences(
  db: Db,
  analysisId: string,
  uploadId: string,
  citations: readonly InTextInsert[],
): Promise<{ id: string }[]> {
  if (citations.length === 0) return [];

  const rows: TablesInsert<"in_text_references">[] = citations.map(
    (citation) => ({
      paper_analysis_id: analysisId,
      paper_upload_id: uploadId,
      raw_text: citation.rawText,
      authors: citation.authors,
      year: citation.year,
      locator: citation.locator,
      page_number: citation.pageNumber,
      word_index_start: citation.wordIndexStart,
      word_index_end: citation.wordIndexEnd,
    }),
  );

  const result = await db.from("in_text_references").insert(rows).select("id");
  return unwrap(result, "insertInTextReferences");
}

/**
 * Writes the reconciliation result: matched pairs and both kinds of orphan.
 * Also flips `is_matched` on the referenced rows so the unmatched partial
 * indexes stay meaningful.
 */
export async function writeReferencePairs(
  db: Db,
  analysisId: string,
  pairs: readonly PairResult[],
): Promise<void> {
  if (pairs.length === 0) return;

  const rows: TablesInsert<"reference_pairs">[] = pairs.map((pair) => {
    if (pair.kind === "matched") {
      return {
        paper_analysis_id: analysisId,
        in_text_reference_id: pair.inTextId,
        bibliography_reference_id: pair.bibId,
        match_confidence: Number(pair.confidence.toFixed(3)),
        is_orphan_in_text: false,
        is_orphan_bibliography: false,
      };
    }
    if (pair.kind === "cited_but_missing") {
      return {
        paper_analysis_id: analysisId,
        in_text_reference_id: pair.inTextId,
        bibliography_reference_id: null,
        is_orphan_in_text: true,
        is_orphan_bibliography: false,
      };
    }
    return {
      paper_analysis_id: analysisId,
      in_text_reference_id: null,
      bibliography_reference_id: pair.bibId,
      is_orphan_in_text: false,
      is_orphan_bibliography: true,
    };
  });

  const inserted = await db.from("reference_pairs").insert(rows);
  if (inserted.error) {
    throw new Error(`writeReferencePairs: ${inserted.error.message}`);
  }

  const matchedInText = pairs
    .filter((p) => p.kind === "matched")
    .map((p) => p.inTextId);
  const matchedBib = pairs
    .filter((p) => p.kind === "matched")
    .map((p) => p.bibId);

  await markMatched(db, "in_text_references", matchedInText);
  await markMatched(db, "bibliography_references", matchedBib);
}

async function markMatched(
  db: Db,
  table: "in_text_references" | "bibliography_references",
  ids: readonly string[],
): Promise<void> {
  if (ids.length === 0) return;
  const result = await db
    .from(table)
    .update({ is_matched: true })
    .in("id", [...ids]);
  if (result.error) {
    throw new Error(`markMatched(${table}): ${result.error.message}`);
  }
}

/** Writes one reference's verification verdict. */
export async function updateReferenceHealth(
  db: Db,
  referenceId: string,
  verdict: {
    health: ReferenceHealth;
    detail: string;
    resolvedUrl: string | null;
  },
): Promise<void> {
  const result = await db
    .from("bibliography_references")
    .update({
      health: verdict.health,
      health_detail: verdict.detail,
      resolved_url: verdict.resolvedUrl,
      health_checked_at: new Date().toISOString(),
    })
    .eq("id", referenceId);

  if (result.error) {
    throw new Error(`updateReferenceHealth: ${result.error.message}`);
  }
}

/** Resets one reference to UNCHECKED — the per-reference "Recheck" path. */
export async function resetReferenceHealth(
  db: Db,
  referenceId: string,
): Promise<void> {
  const result = await db
    .from("bibliography_references")
    .update({
      health: "UNCHECKED",
      health_detail: null,
      resolved_url: null,
      health_checked_at: null,
    })
    .eq("id", referenceId);
  if (result.error) {
    throw new Error(`resetReferenceHealth: ${result.error.message}`);
  }
}

/** Resets every reference to UNCHECKED — the "Retry verification" path. */
export async function resetAllReferenceHealth(
  db: Db,
  analysisId: string,
): Promise<void> {
  const result = await db
    .from("bibliography_references")
    .update({
      health: "UNCHECKED",
      health_detail: null,
      resolved_url: null,
      health_checked_at: null,
    })
    .eq("paper_analysis_id", analysisId);
  if (result.error) {
    throw new Error(`resetAllReferenceHealth: ${result.error.message}`);
  }
}

/** Clears the orphan flags on one pair — the resolve/dismiss write. */
export async function clearPairOrphan(db: Db, pairId: string): Promise<void> {
  const result = await db
    .from("reference_pairs")
    .update({
      is_orphan_in_text: false,
      is_orphan_bibliography: false,
      notes: "resolved",
    })
    .eq("id", pairId);
  if (result.error) {
    throw new Error(`clearPairOrphan: ${result.error.message}`);
  }
}

/** Confirms a pair belongs to an analysis — ownership guard for the actions. */
export async function pairBelongsToAnalysis(
  db: Db,
  pairId: string,
  analysisId: string,
): Promise<boolean> {
  const result = await db
    .from("reference_pairs")
    .select("id")
    .eq("id", pairId)
    .eq("paper_analysis_id", analysisId)
    .maybeSingle();
  return unwrap(result, "pairBelongsToAnalysis") !== null;
}

/** Confirms a reference belongs to an analysis — ownership guard for recheck. */
export async function referenceBelongsToAnalysis(
  db: Db,
  referenceId: string,
  analysisId: string,
): Promise<boolean> {
  const result = await db
    .from("bibliography_references")
    .select("id")
    .eq("id", referenceId)
    .eq("paper_analysis_id", analysisId)
    .maybeSingle();
  return unwrap(result, "referenceBelongsToAnalysis") !== null;
}

/** Sets the analysis-level reference-health status column. */
export async function setReferenceHealthStatus(
  db: Db,
  analysisId: string,
  status: JobStatus,
): Promise<void> {
  const result = await db
    .from("paper_analyses")
    .update({ reference_health_status: status })
    .eq("id", analysisId);
  if (result.error) {
    throw new Error(`setReferenceHealthStatus: ${result.error.message}`);
  }
}

/**
 * Re-runs verification: resets the existing REFERENCE_HEALTH job to NONE so the
 * worker claims it fresh. If no such job exists (a first recheck after the job
 * was reaped), enqueues one. The unique idempotency key means the row is reused,
 * never duplicated — which is exactly why a plain re-enqueue would be a no-op
 * here and a reset is required instead.
 */
export async function requeueReferenceHealthJob(
  db: Db,
  analysisId: string,
  uploadId: string,
): Promise<void> {
  const result = await db
    .from("analysis_jobs")
    .update({
      status: "NONE",
      attempts: 0,
      run_after: new Date().toISOString(),
      claimed_at: null,
      claimed_by: null,
      last_error: null,
      completed_at: null,
    })
    .eq("paper_analysis_id", analysisId)
    .eq("kind", "REFERENCE_HEALTH")
    .select("id");

  if (result.error) {
    throw new Error(`requeueReferenceHealthJob: ${result.error.message}`);
  }

  if ((result.data?.length ?? 0) === 0) {
    await enqueueJob(db, {
      paperAnalysisId: analysisId,
      paperUploadId: uploadId,
      kind: "REFERENCE_HEALTH",
    });
  }
}
