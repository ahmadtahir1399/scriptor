import "server-only";

import {
  getAnalysis,
  getAnalysisReportHeader,
  listCheckResults,
  listFindingsForAnalysis,
} from "@/lib/db/queries/analyses";
import { getUpload } from "@/lib/db/queries/papers";
import { listBibliographyReferences } from "@/lib/db/queries/references";
import { dispatchNotification, type DispatchResult } from "@/lib/notifications/dispatch";
import { bandForScore } from "@/lib/analysis/presentation";
import { classifyCheckable } from "@/lib/requirements/classifyCheckable";
import {
  analysisCompleteEmail,
  analysisFailedEmail,
  referenceIssuesEmail,
  requirementsExtractedEmail,
  todoDueSoonEmail,
  uploadIncompatibleEmail,
} from "@/lib/email/templates";
import type { Tone } from "@/lib/email/theme";
import type { Db } from "@/lib/db/queries/papers";
import type { FindingSeverity } from "@/lib/db/enums";
import type { Tables } from "@/lib/db/types.generated";

/**
 * One function per notifiable event.
 *
 * Each gathers the data its template needs, renders it, and hands the result to
 * `dispatchNotification`. The split matters: `dispatch.ts` knows about consent,
 * dedupe and delivery and nothing about theses; this file knows about theses and
 * nothing about Resend. Neither has to change when the other does.
 *
 * ── THEY ARE CALLED AFTER THE WORK IS COMMITTED, NEVER DURING ────────────────
 *
 * Every one of these reads state back out of the database rather than being
 * handed it by the caller. That is deliberate — it is the same reasoning as
 * `maybeEnqueuePostProcessing`, which broke precisely because it ran before the
 * triggering job's own status was written. A completion email assembled from
 * in-flight values would quote a score that the report does not show.
 *
 * ── NONE OF THEM THROW ───────────────────────────────────────────────────────
 *
 * `dispatchNotification` swallows its own failures, and the data-gathering above
 * it is wrapped per event. A notification is the last step of a pipeline that
 * has already produced everything of value; it must never be the reason that
 * work is marked failed and re-run.
 */

type Finding = Tables<"findings">;

/** How many findings the "Start here" block shows. Three fits above the fold. */
const PRIORITY_LIMIT = 3;

/** Severity → the email's semantic tone. */
function severityTone(severity: FindingSeverity): Tone {
  // HIGH is the only one that earns `critical`. MEDIUM and LOW both render
  // `warning`, and that is not laziness: the contract in CLAUDE.md is that the
  // LABEL carries the meaning and colour only reinforces it. Two severities
  // sharing a hue is fine; a severity rendered in `primary` would not be,
  // because primary must never encode state.
  return severity === "HIGH" ? "critical" : "warning";
}

function severityLabel(severity: FindingSeverity): string {
  switch (severity) {
    case "HIGH":
      return "High priority";
    case "MEDIUM":
      return "Worth fixing";
    case "LOW":
      return "Minor";
  }
}

const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

/**
 * Most severe first, then earliest in the document.
 *
 * Deliberately not `orderFindings` from `lib/analysis/presentation`: that sorts
 * for the report, where a stable page order matters more than anything. Here the
 * list is three items long and its whole job is to answer "what do I fix first",
 * so severity dominates and unresolved findings come before resolved ones.
 */
function topFindings(findings: readonly Finding[], limit: number): Finding[] {
  return [...findings]
    .filter((finding) => !finding.is_resolved)
    .sort((a, b) => {
      const bySeverity =
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (bySeverity !== 0) return bySeverity;
      return (a.page_number ?? Number.MAX_SAFE_INTEGER) -
        (b.page_number ?? Number.MAX_SAFE_INTEGER);
    })
    .slice(0, limit);
}

/** Logs and returns a no-op result, so one broken event cannot fail a job. */
function swallow(event: string, error: unknown): DispatchResult {
  console.error(`[notifications] ${event} failed`, error);
  return { created: false, emailSent: false };
}

// ---------------------------------------------------------------------------
// ANALYSIS_COMPLETE
// ---------------------------------------------------------------------------

/**
 * Fired once POST_PROCESSING has committed and the analysis reads DONE.
 *
 * Honours TWO gates, not one. `notification_preferences.email_analysis_complete`
 * is the account-wide setting, and `paper_uploads.send_email_results` is the
 * per-upload checkbox in the upload wizard's privacy step. That checkbox has
 * been collected since P2 and honoured by nothing — a student who unticked
 * "email me the results" for a specific sensitive document was being told their
 * preference was recorded, and it was, and then it was ignored. Passing
 * `email: null` here is what finally makes it mean something.
 */
export async function notifyAnalysisComplete(
  db: Db,
  analysisId: string,
): Promise<DispatchResult> {
  try {
    const analysis = await getAnalysis(db, analysisId);
    if (!analysis) return { created: false, emailSent: false };

    const [header, upload, checkResults, findings] = await Promise.all([
      getAnalysisReportHeader(db, analysisId),
      getUpload(db, analysis.paper_upload_id),
      listCheckResults(db, analysisId),
      listFindingsForAnalysis(db, analysisId),
    ]);

    const paperTitle = header?.paperTitle || upload?.file_name || "your document";
    const checksRun = checkResults.filter(
      (result) => result.status === "DONE",
    ).length;
    const open = findings.filter((finding) => !finding.is_resolved);
    const highCount = open.filter((finding) => finding.severity === "HIGH").length;
    const priorities = topFindings(findings, PRIORITY_LIMIT);

    // The first finding carrying a real quotation, for the "From your draft"
    // block. Skipped entirely rather than faked when no check produced one —
    // an empty quote box reads as a rendering bug.
    const quoted = priorities.find(
      (finding) => finding.quote && finding.quote.trim().length > 20,
    );

    const email = upload?.send_email_results === false
      ? null
      : analysisCompleteEmail({
          paperTitle,
          analysisId,
          score: analysis.overall_score,
          band: bandForScore(analysis.overall_score),
          checksRun,
          findingCount: open.length,
          highSeverityCount: highCount,
          priorities: priorities.map((finding) => ({
            label: severityLabel(finding.severity),
            title: finding.title,
            tone: severityTone(finding.severity),
          })),
          sampleExcerpt: quoted
            ? {
                text: quoted.quote,
                pageLabel: quoted.page_number
                  ? `Page ${quoted.page_number}`
                  : undefined,
              }
            : undefined,
        });

    return dispatchNotification(db, {
      userId: analysis.user_id,
      type: "ANALYSIS_COMPLETE",
      title: "Your review is ready",
      body:
        analysis.overall_score === null
          ? paperTitle
          : `${Math.round(analysis.overall_score)}/100 · ${open.length} ${
              open.length === 1 ? "finding" : "findings"
            } · ${paperTitle}`,
      href: `/analysis/${analysisId}`,
      relatedPaperId: analysis.paper_id,
      relatedPaperAnalysisId: analysisId,
      // Scoped to THIS run, so re-running a corrected document notifies again
      // while a retried check inside the same run stays quiet.
      dedupeSince: analysis.started_at,
      email,
    });
  } catch (error) {
    return swallow("notifyAnalysisComplete", error);
  }
}

// ---------------------------------------------------------------------------
// ANALYSIS_FAILED
// ---------------------------------------------------------------------------

/**
 * The stored `error_reason` code, as a sentence a student can act on.
 *
 * `retryable` is the load-bearing half. Telling someone to "try again" on a
 * cost ceiling sends them into a loop that fails identically every time, so the
 * two cases get different copy and a different button.
 */
function failureReason(
  reason: string | null,
  message: string | null,
): { sentence: string; retryable: boolean } {
  switch (reason) {
    case "ALL_CHECKS_FAILED":
      return {
        sentence:
          "Every check failed to complete. That is almost always a temporary problem on our side rather than anything about your document.",
        retryable: true,
      };
    case "COST_CEILING":
      return {
        sentence:
          "The analysis reached its cost limit before every check finished. The checks that did complete are saved and worth reading — running it again would stop at the same point.",
        retryable: false,
      };
    default:
      return {
        sentence:
          message?.trim() ||
          "The analysis stopped before it finished, and we didn't capture a specific reason.",
        retryable: true,
      };
  }
}

export async function notifyAnalysisFailed(
  db: Db,
  analysisId: string,
): Promise<DispatchResult> {
  try {
    const analysis = await getAnalysis(db, analysisId);
    if (!analysis) return { created: false, emailSent: false };

    const [header, upload] = await Promise.all([
      getAnalysisReportHeader(db, analysisId),
      getUpload(db, analysis.paper_upload_id),
    ]);

    const paperTitle = header?.paperTitle || upload?.file_name || "your document";
    const { sentence, retryable } = failureReason(
      analysis.error_reason,
      analysis.error_message,
    );

    // NOTE the asymmetry with the completion email: `send_email_results` is not
    // consulted here. That checkbox reads "email me the results"; a failure is
    // not a result, it is the absence of one, and leaving someone waiting
    // indefinitely for a review that will never arrive is the worse outcome.
    // The account-level `email_analysis_failed` preference still gates it.
    return dispatchNotification(db, {
      userId: analysis.user_id,
      type: "ANALYSIS_FAILED",
      title: "We couldn't finish your review",
      body: `${paperTitle} — ${sentence.split(".")[0]}.`,
      href: `/analysis/${analysisId}`,
      relatedPaperId: analysis.paper_id,
      relatedPaperAnalysisId: analysisId,
      dedupeSince: analysis.started_at,
      email: analysisFailedEmail({
        paperTitle,
        analysisId,
        reason: sentence,
        retryable,
      }),
    });
  } catch (error) {
    return swallow("notifyAnalysisFailed", error);
  }
}

// ---------------------------------------------------------------------------
// UPLOAD_INCOMPATIBLE
// ---------------------------------------------------------------------------

/**
 * The incompatibility copy, mirroring `upload.incompatible.*` in en.json.
 *
 * Duplicated rather than read through next-intl because this runs in the worker,
 * which has no request and therefore no locale context to resolve a translation
 * against. The app is English-only (`i18n/routing.ts`), so the duplication costs
 * nothing today; when a second locale returns, this map and the templates move
 * to a shared catalogue together.
 */
interface IncompatibilityCopy {
  sentence: string;
  fixes: string[];
}

/**
 * The fallback, named rather than inlined as `INCOMPATIBILITY.UNREADABLE`.
 *
 * `noUncheckedIndexedAccess` types every lookup on the map below as possibly
 * undefined — including the one used as the default — so the default has to be
 * something the compiler knows exists. It also means an unrecognised reason code
 * degrades to honest copy instead of `undefined` reaching the template.
 */
const UNREADABLE_COPY: IncompatibilityCopy = {
  sentence:
    "We couldn't read this file at all — no text came out of it. It may be corrupted, password-protected or empty.",
  fixes: [
    "Remove any password or permissions restriction and export it again.",
    "Re-export from the original source rather than re-saving the PDF.",
  ],
};

const INCOMPATIBILITY: Record<string, IncompatibilityCopy> = {
  SCANNED_PDF: {
    sentence:
      "This looks like a scanned document — the pages are images, so there is no text for us to read.",
    fixes: [
      "Export a fresh PDF from Word, Google Docs or LaTeX rather than scanning a printed copy.",
      "If a scan is all you have, run it through OCR first so the text becomes selectable.",
    ],
  },
  TOO_SHORT: {
    sentence:
      "This document is too short to analyse — we need at least 500 words to say anything useful about structure or argument.",
    fixes: [
      "If you uploaded an excerpt or a single chapter, upload the full document instead.",
      "Check the file exported completely — a truncated export is the usual cause.",
    ],
  },
  TOO_LONG: {
    sentence: "This document is longer than we can analyse. Our limit is 48,000 words.",
    fixes: [
      "If your thesis includes large appendices, upload just the main body — the appendix rarely needs review.",
      "Split a very long work and upload the substantive chapters on their own.",
    ],
  },
  EXCEEDS_TYPE_LIMIT: {
    sentence:
      "This is longer than expected for the document type you chose, which has a lower length limit than your file.",
    fixes: [
      "Change the document type to match your work, then upload again.",
      "Or upload only the section that matches the type you selected.",
    ],
  },
  TOO_MANY_PAGES: {
    sentence: "This document has too many pages. Our limit is 300.",
    fixes: [
      "If a large part is appendices or figures, upload the main body on its own.",
    ],
  },
  NO_BODY_CONTENT: {
    sentence:
      "We couldn't find the main body of your thesis — every page looked like front matter, references or appendix material.",
    fixes: [
      "Check you uploaded the complete document rather than just the front pages.",
      "If your chapters start unusually late, make sure the export included them.",
    ],
  },
  UNREADABLE: UNREADABLE_COPY,
};

export async function notifyUploadIncompatible(
  db: Db,
  uploadId: string,
): Promise<DispatchResult> {
  try {
    const upload = await getUpload(db, uploadId);
    if (!upload) return { created: false, emailSent: false };

    const reasonCode = upload.incompatibility_reason ?? "UNREADABLE";
    const copy = INCOMPATIBILITY[reasonCode] ?? UNREADABLE_COPY;
    const paperTitle = upload.title || upload.file_name || "your document";

    return dispatchNotification(db, {
      userId: upload.user_id,
      type: "UPLOAD_INCOMPATIBLE",
      title: "We can't review this file yet",
      body: `${paperTitle} — ${copy.sentence}`,
      href: `/papers/${upload.paper_id}`,
      relatedPaperId: upload.paper_id,
      // Deliberately NOT keyed to an analysis: the upload was rejected before
      // any analysis ran, so dedupe falls to the paper. A student who uploads a
      // second, differently-broken file to the same paper is told once — which
      // is the right trade against emailing them on every failed attempt.
      relatedPaperAnalysisId: null,
      email: uploadIncompatibleEmail({
        paperTitle,
        paperId: upload.paper_id,
        reason: copy.sentence,
        suggestions: copy.fixes,
      }),
    });
  } catch (error) {
    return swallow("notifyUploadIncompatible", error);
  }
}

// ---------------------------------------------------------------------------
// REFERENCE_ISSUES_FOUND
// ---------------------------------------------------------------------------

/**
 * Fired after REFERENCE_HEALTH finishes, and ONLY when something is wrong.
 *
 * A bibliography that verifies cleanly produces no notification at all. That is
 * the point of the type — "we checked and everything is fine" is not news, and
 * an email for it trains people to ignore the ones that matter.
 */
export async function notifyReferenceIssues(
  db: Db,
  analysisId: string,
): Promise<DispatchResult> {
  try {
    const analysis = await getAnalysis(db, analysisId);
    if (!analysis) return { created: false, emailSent: false };

    const references = await listBibliographyReferences(db, analysisId);
    if (references.length === 0) return { created: false, emailSent: false };

    const verified = references.filter((r) => r.health === "VERIFIED").length;
    const broken = references.filter(
      (r) => r.health === "BROKEN_URL" || r.health === "NEEDS_CORRECTION",
    ).length;
    const unverified = references.filter((r) => r.health === "NOT_FOUND").length;

    // UNCHECKED is excluded from both counts on purpose: it means a provider was
    // unreachable, which is our problem and not a defect in the student's
    // bibliography. Reporting it as "not found" would be an accusation.
    if (broken + unverified === 0) return { created: false, emailSent: false };

    const [header, upload] = await Promise.all([
      getAnalysisReportHeader(db, analysisId),
      getUpload(db, analysis.paper_upload_id),
    ]);
    const paperTitle = header?.paperTitle || upload?.file_name || "your document";

    const examples = references
      .filter((r) => r.health === "BROKEN_URL" || r.health === "NEEDS_CORRECTION" || r.health === "NOT_FOUND")
      .slice(0, 4)
      .map((reference) => ({
        label:
          reference.health === "BROKEN_URL"
            ? "Broken link"
            : reference.health === "NEEDS_CORRECTION"
              ? "Needs correction"
              : "Not found",
        citation: reference.raw_text,
      }));

    const problem = broken + unverified;

    return dispatchNotification(db, {
      userId: analysis.user_id,
      type: "REFERENCE_ISSUES_FOUND",
      title: `${problem} ${problem === 1 ? "reference needs" : "references need"} a look`,
      body: `${verified} of ${references.length} verified in ${paperTitle}.`,
      href: `/analysis/${analysisId}/references`,
      relatedPaperId: analysis.paper_id,
      relatedPaperAnalysisId: analysisId,
      dedupeSince: analysis.started_at,
      email: referenceIssuesEmail({
        paperTitle,
        analysisId,
        total: references.length,
        verified,
        unverified,
        broken,
        examples,
      }),
    });
  } catch (error) {
    return swallow("notifyReferenceIssues", error);
  }
}

// ---------------------------------------------------------------------------
// REQUIREMENTS_EXTRACTED
// ---------------------------------------------------------------------------

/**
 * Fired when a guidelines document finishes extraction.
 *
 * ACCOUNT-SCOPED, not paper-scoped: `requirement_files` has no `paper_id`. A
 * guidelines PDF is extracted once and then applied to individual papers with
 * "Apply to a paper", so both the notification and the email point at
 * `/requirements` rather than at a paper that may not use these rules yet.
 *
 * `checkable` is DERIVED here rather than read, because it is derived
 * everywhere — `classifyCheckable` is the single source of that truth and
 * `requirements` deliberately has no column for it. Splitting the count in the
 * email is the honesty feature carried into the inbox: a student is told up
 * front how many rules Scriptor will actually verify, rather than discovering
 * later that the margin rule was never checked.
 */
export async function notifyRequirementsExtracted(
  db: Db,
  args: {
    userId: string;
    sourceName: string;
    requirements: ReadonlyArray<{ title: string; description: string }>;
  },
): Promise<DispatchResult> {
  try {
    // Nothing extracted is not worth an email — the UI already shows the file's
    // ERROR/empty state, and "we found 0 requirements" is noise.
    if (args.requirements.length === 0) {
      return { created: false, emailSent: false };
    }

    const checkableCount = args.requirements.filter(
      (requirement) =>
        classifyCheckable(`${requirement.title} ${requirement.description}`)
          .checkable,
    ).length;

    return dispatchNotification(db, {
      userId: args.userId,
      type: "REQUIREMENTS_EXTRACTED",
      title: "Your requirements are set up",
      body: `${args.requirements.length} ${
        args.requirements.length === 1 ? "requirement" : "requirements"
      } from ${args.sourceName} — ${checkableCount} we can check.`,
      href: "/requirements",
      relatedPaperId: null,
      relatedPaperAnalysisId: null,
      // Repeatable by design: re-uploading or re-extracting a guidelines
      // document is a normal thing to do, and each extraction genuinely changes
      // what papers will be checked against. With no related paper or analysis
      // there is nothing to dedupe against anyway.
      allowDuplicate: true,
      email: requirementsExtractedEmail({
        sourceName: args.sourceName,
        requirementCount: args.requirements.length,
        checkableCount,
      }),
    });
  } catch (error) {
    return swallow("notifyRequirementsExtracted", error);
  }
}

// ---------------------------------------------------------------------------
// TODO_DUE_SOON
// ---------------------------------------------------------------------------

export interface DueTodo {
  title: string;
  dueLabel: string;
  overdue: boolean;
}

/**
 * The deadline nudge. Called by the sweep in `lib/notifications/todoSweep.ts`,
 * which owns the window and the once-per-day dedupe.
 *
 * `allowDuplicate` is set because this is the one genuinely repeatable event:
 * a task three days out and then overdue is two different pieces of news. The
 * sweep is what stops it becoming a daily drumbeat.
 */
export async function notifyTodosDueSoon(
  db: Db,
  args: {
    userId: string;
    paperId: string;
    analysisId: string;
    paperTitle: string;
    todos: DueTodo[];
    remainingCount: number;
  },
): Promise<DispatchResult> {
  try {
    const [soonest] = args.todos;
    if (!soonest) return { created: false, emailSent: false };

    const anyOverdue = args.todos.some((todo) => todo.overdue);

    return dispatchNotification(db, {
      userId: args.userId,
      type: "TODO_DUE_SOON",
      title: anyOverdue
        ? "A thesis task is overdue"
        : "A thesis task is due soon",
      body: `${soonest.title} — ${soonest.dueLabel}`,
      href: `/analysis/${args.analysisId}/todos`,
      relatedPaperId: args.paperId,
      relatedPaperAnalysisId: args.analysisId,
      allowDuplicate: true,
      email: todoDueSoonEmail({
        paperTitle: args.paperTitle,
        analysisId: args.analysisId,
        todos: args.todos,
        remainingCount: args.remainingCount,
      }),
    });
  } catch (error) {
    return swallow("notifyTodosDueSoon", error);
  }
}
