import type { FindingSeverity } from "@/lib/db/enums";
import {
  scoreBand,
  type CheckRating,
  type ScoreBand,
} from "@/lib/analysis/scoring";
import { categoryForCheck, type CheckCategory } from "@/lib/analysis/config";
import type { CheckResultWithVersion, Finding } from "@/lib/domain/analysis";

/**
 * Maps report rows to the shape `scoring.ts` consumes.
 *
 * This is the one bridge between the report's data and the scoring function —
 * the page computes no scoring itself, it hands these ratings to
 * `computeAnalysisScore`. A GENERATING check contributes a null score and is
 * excluded from the provisional mean, exactly like an errored one.
 */
export function toCheckRatings(
  results: readonly CheckResultWithVersion[],
): CheckRating[] {
  return results
    .filter((result) => !result.hidden_because_ab_test)
    .map((result) => ({
      checkCode: result.check?.code ?? "UNKNOWN",
      score: result.status === "DONE" ? result.score : null,
      errored: result.status === "ERROR",
    }));
}

/**
 * Pure presentation helpers for the report.
 *
 * No I/O, no scoring math — scoring lives in `scoring.ts` and this module only
 * ARRANGES what that produces: priority ordering, band → colour/verdict keys,
 * and the deep-link contract into the P7 document viewer.
 */

// ---------------------------------------------------------------------------
// The ?finding deep-link contract (owned here; P7 honours it).
// ---------------------------------------------------------------------------

/**
 * Builds the link from a report finding into the document viewer, landing on
 * the exact finding.
 *
 * THIS IS THE CONTRACT P7 READS. The viewer at
 * `/analysis/{analysisId}/document` looks for `?finding={id}`, scrolls that
 * finding's page into view, and flashes its highlight. Changing the param name
 * here silently breaks every "View in document" link, so it is defined once,
 * here, and imported everywhere.
 */
export const FINDING_QUERY_PARAM = "finding" as const;

export function documentFindingHref(
  analysisId: string,
  findingId: string,
): string {
  return `/analysis/${analysisId}/document?${FINDING_QUERY_PARAM}=${findingId}`;
}

export function documentPageHref(
  analysisId: string,
  pageNumber: number,
): string {
  return `/analysis/${analysisId}/document?page=${pageNumber}`;
}

/**
 * Coarse relative time ("3 minutes ago") via Intl, for the report header.
 * Returns the {value, unit} so the caller can localise through next-intl's
 * `format.relativeTime`, keeping the wording in the message layer.
 */
export function relativeTimeParts(iso: string): {
  value: number;
  unit: Intl.RelativeTimeFormatUnit;
} {
  const then = new Date(iso).getTime();
  const diffMs = then - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const absSec = Math.abs(diffSec);

  if (absSec < 60) return { value: Math.min(-1, diffSec), unit: "second" };
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return { value: diffMin, unit: "minute" };
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return { value: diffHour, unit: "hour" };
  const diffDay = Math.round(diffHour / 24);
  return { value: diffDay, unit: "day" };
}

// ---------------------------------------------------------------------------
// Bands → colour tone and message keys.
// ---------------------------------------------------------------------------

export type ScoreTone = "critical" | "warning" | "verified" | "muted";

/**
 * Maps a 0–100 score to the app's semantic colour contract.
 *
 * DERIVED FROM `scoreBand`, deliberately — it used to carry its own
 * thresholds (<50 / <75 / ≥75) and they disagreed with the band's
 * (<50 / <70 / <85 / ≥85). Anything scoring 70–74 was therefore labelled
 * "Solid" and painted in caution honey at the same time: the word said fine,
 * the colour said careful, on the same gauge. Two sets of boundaries for one
 * concept will always drift; now there is one, `scoreBand`, and it is the
 * tested one.
 *
 *   needs_work  → critical  (clay)
 *   developing  → warning   (honey)
 *   solid       → verified  (sage)
 *   strong      → verified  (sage)
 *   null        → muted     (not yet scored)
 *
 * Solid and strong share a tone on purpose: the label already separates them,
 * and a fourth arc colour would be a distinction nobody is asked to make.
 */
export function scoreTone(score: number | null): ScoreTone {
  switch (scoreBand(score)) {
    case "needs_work":
      return "critical";
    case "developing":
      return "warning";
    case "solid":
    case "strong":
      return "verified";
    default:
      return "muted";
  }
}

/** Message key for the plain-language verdict line, chosen by band. */
export function verdictKey(band: ScoreBand | null): string {
  switch (band) {
    case "strong":
      return "analysis.verdict.strong";
    case "solid":
      return "analysis.verdict.solid";
    case "developing":
      return "analysis.verdict.developing";
    case "needs_work":
      return "analysis.verdict.needs_work";
    default:
      return "analysis.verdict.pending";
  }
}

export function bandForScore(score: number | null): ScoreBand | null {
  return scoreBand(score);
}

// ---------------------------------------------------------------------------
// Check ordering — most important first.
// ---------------------------------------------------------------------------

const SEVERITY_WEIGHT: Record<FindingSeverity, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

/**
 * A check's "attention score": how much it should demand the student's focus.
 * Higher sorts first. Combines a low quality rating with the severity-weighted
 * volume of its findings, so a check that scored 40 with three HIGH findings
 * outranks one that scored 60 with a couple of LOWs.
 *
 * Errored checks sort to the very top — an unfinished check the student can
 * retry is more actionable than any completed one.
 */
export function attentionScore(result: CheckResultWithVersion): number {
  if (result.status === "ERROR") return Number.MAX_SAFE_INTEGER;

  const rating = result.score ?? 100;
  const ratingPressure = 100 - rating;

  const findingPressure = result.findings.reduce(
    (sum, finding) => sum + (SEVERITY_WEIGHT[finding.severity] ?? 1),
    0,
  );

  return ratingPressure + findingPressure * 4;
}

/** Orders check cards by priority — errors, then most-needs-work, first. */
export function orderByPriority(
  results: readonly CheckResultWithVersion[],
): CheckResultWithVersion[] {
  return [...results].sort((a, b) => attentionScore(b) - attentionScore(a));
}

// ---------------------------------------------------------------------------
// Priority strip — the "if you only do three things" answer.
// ---------------------------------------------------------------------------

export interface PriorityAction {
  /** Stable key for React and for the icon lookup. */
  kind: "check" | "finding";
  /** i18n key for the label, plus a count for pluralisation. */
  labelKey: string;
  count: number;
  /** Where the chip links — a check card anchor or a document deep-link. */
  href: string;
  checkCode: string;
  category: CheckCategory;
}

/**
 * Derives up to three priority chips from the lowest-rated checks and their
 * highest-severity findings. Pure and deterministic so the same analysis always
 * surfaces the same top-three.
 */
export function derivePriorityActions(
  analysisId: string,
  results: readonly CheckResultWithVersion[],
  maxChips = 3,
): PriorityAction[] {
  const done = results.filter((result) => result.status === "DONE");
  const ranked = orderByPriority(done);

  const chips: PriorityAction[] = [];

  for (const result of ranked) {
    if (chips.length >= maxChips) break;
    const code = result.check?.code ?? "UNKNOWN";

    const findingCount = result.findings.length;
    // Skip checks that found nothing and scored well — they are not an action.
    if (findingCount === 0 && (result.score ?? 100) >= 80) continue;

    chips.push({
      kind: findingCount > 0 ? "finding" : "check",
      labelKey:
        findingCount > 0
          ? "analysis.priority.findings"
          : "analysis.priority.review",
      count: findingCount,
      href: `#check-${result.check_id}`,
      checkCode: code,
      category: categoryForCheck(code),
    });
  }

  return chips;
}

// ---------------------------------------------------------------------------
// Finding ordering within a card.
// ---------------------------------------------------------------------------

/** Findings most severe first, then by document position. */
export function orderFindings(findings: readonly Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const severity =
      (SEVERITY_WEIGHT[b.severity] ?? 1) - (SEVERITY_WEIGHT[a.severity] ?? 1);
    if (severity !== 0) return severity;

    const pageA = a.page_number ?? Number.MAX_SAFE_INTEGER;
    const pageB = b.page_number ?? Number.MAX_SAFE_INTEGER;
    if (pageA !== pageB) return pageA - pageB;

    return (a.word_index_start ?? 0) - (b.word_index_start ?? 0);
  });
}

/** Colour tone for a finding severity, on the semantic contract. */
export function severityTone(severity: FindingSeverity): ScoreTone {
  switch (severity) {
    case "HIGH":
      return "critical";
    case "MEDIUM":
      return "warning";
    case "LOW":
      return "muted";
  }
}

// ---------------------------------------------------------------------------
// Unified finding display model.
//
// Findings reach the report from two stores, by P4's design:
//   - grammar checks write `findings` TABLE rows (real ids, word ranges) →
//     deep-linkable into P7 by id.
//   - rated checks write `feedback_structured.findings` JSON (no ids) →
//     deep-linkable only by page, if the model reported one.
// This model normalises both so a card renders one list and the deep-link
// contract lives in exactly one place.
// ---------------------------------------------------------------------------

export interface DisplayFinding {
  /** Stable React key. */
  key: string;
  /** Table id when the finding is a real row, else null. */
  id: string | null;
  quote: string;
  description: string;
  suggestion: string | null;
  pageNumber: number | null;
  severity: FindingSeverity;
  /** Deep-link into P7, by finding id where possible, else by page, else null. */
  href: string | null;
}

/**
 * A rated finding as stored in `check_results.feedback_structured`.
 *
 * Canonically `title` / `description` / `correction`, matching the prompts, the
 * `findings` table and `ratedFindingSchema`. `reason` and `suggestion` are read
 * too, because rows written before those names were reconciled still carry them
 * and a stored report must not lose its text on the way to the screen.
 */
interface RatedFindingJson {
  quote?: unknown;
  title?: unknown;
  description?: unknown;
  correction?: unknown;
  severity?: unknown;
  page_number?: unknown;
  /** Legacy. */
  reason?: unknown;
  suggestion?: unknown;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return null;
}

function isSeverity(value: unknown): value is FindingSeverity {
  return value === "LOW" || value === "MEDIUM" || value === "HIGH";
}

/**
 * Builds the display findings for one check result, merging both stores.
 *
 * Table findings come first and win on de-dupe (they carry ids and word ranges).
 * JSON findings are added only when their quote is not already represented, so a
 * check that somehow wrote both does not show a finding twice.
 */
export function displayFindingsForResult(
  analysisId: string,
  result: CheckResultWithVersion,
): DisplayFinding[] {
  const out: DisplayFinding[] = [];
  const seenQuotes = new Set<string>();

  for (const finding of orderFindings(result.findings)) {
    const quoteKey = finding.quote.trim().toLowerCase();
    seenQuotes.add(quoteKey);
    out.push({
      key: finding.id,
      id: finding.id,
      quote: finding.quote,
      description: finding.description || finding.title,
      suggestion: finding.correction,
      pageNumber: finding.page_number,
      severity: finding.severity,
      href: documentFindingHref(analysisId, finding.id),
    });
  }

  const structured = result.feedback_structured;
  if (
    structured &&
    typeof structured === "object" &&
    "findings" in structured
  ) {
    const raw = (structured as { findings: unknown }).findings;
    if (Array.isArray(raw)) {
      raw.forEach((item, index) => {
        if (typeof item !== "object" || item === null) return;
        const finding = item as RatedFindingJson;
        if (
          typeof finding.quote !== "string" ||
          finding.quote.trim().length === 0
        )
          return;

        const quoteKey = finding.quote.trim().toLowerCase();
        if (seenQuotes.has(quoteKey)) return;
        seenQuotes.add(quoteKey);

        const pageNumber =
          typeof finding.page_number === "number" ? finding.page_number : null;

        out.push({
          key: `${result.id}:json:${index}`,
          id: null,
          quote: finding.quote,
          description:
            firstString(finding.description, finding.reason, finding.title) ??
            "",
          suggestion: firstString(finding.correction, finding.suggestion),
          pageNumber,
          severity: isSeverity(finding.severity) ? finding.severity : "MEDIUM",
          href:
            pageNumber !== null
              ? documentPageHref(analysisId, pageNumber)
              : null,
        });
      });
    }
  }

  return out;
}
