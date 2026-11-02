import type {
  Check,
  CheckAbTest,
  CheckVersion,
  PublicCheck,
} from "@/lib/domain/check";
import type { Db } from "@/lib/db/queries/papers";

/**
 * Check catalogue reads.
 *
 * Two tiers, and the split is a security boundary:
 *
 *   listPublicChecks / getPublicCheck — safe for any authenticated user.
 *   listChecksAdmin / getCheckVersion — require MANAGE_CHECK* permissions and
 *     must only ever be called from server code. `getCheckVersion` returns the
 *     prompt text and its result must never be serialised to a client.
 */

function unwrap<T>(
  result: { data: T; error: null } | { data: null; error: { message: string } },
  context: string,
): T {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Public tier — prompt-free.
// ---------------------------------------------------------------------------

export async function listPublicChecks(db: Db): Promise<PublicCheck[]> {
  const result = await db
    .from("checks_public")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  return unwrap(result, "listPublicChecks");
}

export async function getPublicCheck(
  db: Db,
  checkId: string,
): Promise<PublicCheck | null> {
  const result = await db
    .from("checks_public")
    .select("*")
    .eq("id", checkId)
    .maybeSingle();

  return unwrap(result, "getPublicCheck");
}

/** Checks offered for a document type — what the upload screen renders. */
export async function listChecksForDocumentType(
  db: Db,
  documentTypeCode: string,
): Promise<PublicCheck[]> {
  const typeResult = await db
    .from("document_types")
    .select("id")
    .eq("code", documentTypeCode)
    .maybeSingle();

  const documentType = unwrap(typeResult, "listChecksForDocumentType");
  if (!documentType) return [];

  const mappingResult = await db
    .from("document_type_checks")
    .select("check_id")
    .eq("document_type_id", documentType.id)
    .order("sort_order", { ascending: true });

  const mappings = unwrap(mappingResult, "listChecksForDocumentType");
  const checkIds = mappings.map((row) => row.check_id);
  if (checkIds.length === 0) return [];

  const checksResult = await db
    .from("checks_public")
    .select("*")
    .in("id", checkIds)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  return unwrap(checksResult, "listChecksForDocumentType");
}

// ---------------------------------------------------------------------------
// Admin tier — CONTAINS PROMPT IP. Server-side callers only.
// ---------------------------------------------------------------------------

/** Requires MANAGE_CHECKS. */
export async function listChecksAdmin(db: Db): Promise<Check[]> {
  const result = await db
    .from("checks")
    .select("*")
    .order("sort_order", { ascending: true });

  return unwrap(result, "listChecksAdmin");
}

/**
 * Returns prompt text. Requires MANAGE_CHECK_VERSIONS.
 *
 * Never return this from a server action that a client component awaits — use
 * `stripPrompts()` from `lib/domain/check.ts` if version metadata needs to
 * reach the browser.
 */
export async function getCheckVersion(
  db: Db,
  versionId: string,
): Promise<CheckVersion | null> {
  const result = await db
    .from("check_versions")
    .select("*")
    .eq("id", versionId)
    .maybeSingle();

  return unwrap(result, "getCheckVersion");
}

/**
 * The active prompt for a check in a given locale. This is what the LLM runner
 * (P5) loads before dispatching a RUN_CHECK job.
 */
export async function getActiveCheckVersion(
  db: Db,
  checkId: string,
  locale: "EN" | "DE",
): Promise<CheckVersion | null> {
  const result = await db
    .from("check_versions")
    .select("*")
    .eq("check_id", checkId)
    .eq("locale", locale)
    .eq("is_active", true)
    .maybeSingle();

  return unwrap(result, "getActiveCheckVersion");
}

/** Version history for one check. Requires MANAGE_CHECK_VERSIONS. */
export async function listCheckVersions(
  db: Db,
  checkId: string,
): Promise<CheckVersion[]> {
  const result = await db
    .from("check_versions")
    .select("*")
    .eq("check_id", checkId)
    .order("version", { ascending: false });

  return unwrap(result, "listCheckVersions");
}

/**
 * Resolves a check's `code` to its id.
 *
 * The engine reasons in codes (CITATION_STYLE) because weights and categories
 * are keyed by code; the database joins on id. This is the one bridge.
 */
export async function getCheckIdByCode(
  db: Db,
  code: string,
): Promise<string | null> {
  const result = await db
    .from("checks")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  return unwrap(result, "getCheckIdByCode")?.id ?? null;
}

/** Full check rows for a set of ids — the engine needs code, mode and scope. */
export async function getChecksByIds(
  db: Db,
  ids: readonly string[],
): Promise<Check[]> {
  if (ids.length === 0) return [];
  const result = await db
    .from("checks")
    .select("*")
    .in("id", [...ids]);
  return unwrap(result, "getChecksByIds");
}

/** One full check row — code, mode, page_scope. */
export async function getCheckById(db: Db, id: string): Promise<Check | null> {
  const result = await db.from("checks").select("*").eq("id", id).maybeSingle();
  return unwrap(result, "getCheckById");
}

/**
 * The active A/B test for a check, or null.
 *
 * P1's partial unique index guarantees at most one active test per check, so
 * `maybeSingle` is correct — two active tests would be a data error, not a
 * case to merge.
 */
export async function getActiveAbTest(
  db: Db,
  checkId: string,
): Promise<CheckAbTest | null> {
  const result = await db
    .from("check_ab_tests")
    .select("*")
    .eq("check_id", checkId)
    .eq("is_active", true)
    .maybeSingle();

  return unwrap(result, "getActiveAbTest");
}
