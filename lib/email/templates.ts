import {
  accentRow,
  button,
  clamp,
  esc,
  excerpt,
  layout,
  lead,
  meta,
  paragraph,
  pill,
  rule,
  scorePlate,
  sectionLabel,
  statRow,
  strong,
  textLink,
  title,
  well,
} from "@/lib/email/layout";
import type { Tone } from "@/lib/email/theme";
import { emailUrls } from "@/lib/email/urls";
import type { ScoreBand } from "@/lib/analysis/scoring";

/**
 * The transactional templates — one per `notification_type`.
 *
 * ── EVERY TEMPLATE RETURNS HTML *AND* TEXT ───────────────────────────────────
 *
 * The text part is not a courtesy. A multipart message with no text alternative
 * is a strong spam signal at every major filter, and these are exactly the
 * emails that must not land in spam — a completion email that is filtered is a
 * student who never comes back to a review they paid for. The text part is also
 * what watches, screen readers in text-preferring clients, and anyone with HTML
 * disabled actually read, so it is written as prose, not as a stripped tag dump.
 *
 * ── VOICE ────────────────────────────────────────────────────────────────────
 *
 * Scriptor is a supervision tool, so the register is a supervisor's: direct
 * about what was found, never alarmed, never congratulatory about a machine
 * having finished a job. A low score is reported as information with a next
 * step, not as a failure — the student is mid-draft, which is the entire point.
 *
 * ── SUBJECTS ─────────────────────────────────────────────────────────────────
 *
 * Front-loaded, under ~45 characters where possible, because iOS Mail truncates
 * there in portrait. The paper title goes in the PREHEADER rather than the
 * subject: titles are long and would push the meaningful words off-screen.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const SETTINGS = () => emailUrls.notificationSettings();

/** Band → the label and tone the report itself uses. Kept in one place. */
function bandPresentation(band: ScoreBand | null): {
  label: string;
  tone: Tone;
  caption: string;
} {
  switch (band) {
    case "strong":
      return {
        label: "Strong",
        tone: "verified",
        caption: "this reads as close to submission-ready",
      };
    case "solid":
      return {
        label: "Solid",
        tone: "verified",
        caption: "a sound draft with clear places to sharpen",
      };
    case "developing":
      return {
        label: "Developing",
        tone: "warning",
        caption: "the argument is there; the execution needs another pass",
      };
    case "needs_work":
      return {
        label: "Needs work",
        tone: "critical",
        caption: "worth addressing the structural points before polishing",
      };
    default:
      return { label: "Not yet scored", tone: "primary", caption: "no score was produced" };
  }
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/** Shared footer for the text part. */
function textFooter(): string {
  return [
    "",
    "—",
    "You're receiving this because you asked Scriptor to review a document.",
    `Change what we email you: ${SETTINGS()}`,
    "Scriptor — supervision for your thesis.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// ANALYSIS_COMPLETE
// ---------------------------------------------------------------------------

export interface AnalysisCompleteArgs {
  paperTitle: string;
  analysisId: string;
  score: number | null;
  band: ScoreBand | null;
  checksRun: number;
  findingCount: number;
  highSeverityCount: number;
  /** Up to three headline items, most severe first. */
  priorities: ReadonlyArray<{ label: string; title: string; tone: Tone }>;
  /** One line the student actually wrote, if the report surfaced one. */
  sampleExcerpt?: { text: string; pageLabel?: string };
}

export function analysisCompleteEmail(
  args: AnalysisCompleteArgs,
): RenderedEmail {
  const band = bandPresentation(args.band);
  const url = emailUrls.analysis(args.analysisId);
  const title_ = clamp(args.paperTitle || "your document", 90);

  const body = [
    pill("Review complete", band.tone),
    title("Your review is ready"),
    lead(
      `We finished reading ${strong(title_)}. Here's where it stands.`,
    ),

    args.score !== null
      ? scorePlate({
          score: args.score,
          bandLabel: band.label,
          tone: band.tone,
          caption: band.caption,
        })
      : well(
          paragraph(
            "The review completed, but not enough checks returned a rating to produce an overall score. The individual checks below are still worth reading.",
            0,
          ),
        ),

    statRow([
      { value: String(args.checksRun), label: plural(args.checksRun, "check run", "checks run") },
      {
        value: String(args.findingCount),
        label: plural(args.findingCount, "finding", "findings"),
      },
      {
        value: String(args.highSeverityCount),
        label: "high priority",
        tone: args.highSeverityCount > 0 ? "critical" : undefined,
      },
    ]),

    args.priorities.length > 0
      ? [
          sectionLabel("Start here"),
          ...args.priorities.map((item) =>
            accentRow({ tone: item.tone, label: item.label, title: item.title }),
          ),
          "<div style=\"height:8px;font-size:0;line-height:0;\">&nbsp;</div>",
        ].join("")
      : paragraph(
          "Nothing was flagged as high priority — read through the checks to see the smaller notes.",
        ),

    args.sampleExcerpt
      ? [
          sectionLabel("From your draft"),
          excerpt(
            clamp(args.sampleExcerpt.text, 220),
            args.sampleExcerpt.pageLabel,
          ),
        ].join("")
      : "",

    button("Open the full review", url),
    rule(0, 18),
    meta(
      "The full report shows every check, every finding in context, and the exact place in your document each one refers to.",
    ),
  ].join("");

  const text = [
    "Your review is ready",
    "",
    `We finished reading "${title_}".`,
    "",
    args.score !== null
      ? `Overall score: ${Math.round(args.score)}/100 — ${band.label}, ${band.caption}.`
      : "The review completed, but not enough checks returned a rating to produce an overall score.",
    "",
    `${args.checksRun} ${plural(args.checksRun, "check", "checks")} run · ${args.findingCount} ${plural(
      args.findingCount,
      "finding",
      "findings",
    )} · ${args.highSeverityCount} high priority`,
    "",
    ...(args.priorities.length > 0
      ? [
          "Start here:",
          ...args.priorities.map((item) => `  • ${item.label}: ${item.title}`),
          "",
        ]
      : []),
    `Open the full review: ${url}`,
    textFooter(),
  ].join("\n");

  return {
    subject: "Your review is ready",
    html: layout({
      title: "Your review is ready",
      preheader:
        args.score !== null
          ? `${Math.round(args.score)}/100 — ${band.label}. ${args.findingCount} ${plural(
              args.findingCount,
              "finding",
              "findings",
            )} across ${title_}.`
          : `We finished reading ${title_}.`,
      body,
      settingsUrl: SETTINGS(),
    }),
    text,
  };
}

// ---------------------------------------------------------------------------
// ANALYSIS_FAILED
// ---------------------------------------------------------------------------

export interface AnalysisFailedArgs {
  paperTitle: string;
  analysisId: string;
  /** The stored `error_reason` code, mapped to a sentence by the caller. */
  reason: string;
  /** True when the student can simply press retry. */
  retryable: boolean;
}

export function analysisFailedEmail(args: AnalysisFailedArgs): RenderedEmail {
  const url = emailUrls.analysis(args.analysisId);
  const title_ = clamp(args.paperTitle || "your document", 90);

  const body = [
    pill("Review failed", "critical"),
    title("We couldn't finish this review"),
    lead(
      `Something went wrong while reviewing ${strong(title_)}, and we'd rather tell you than leave you waiting.`,
    ),

    well(
      [
        sectionLabel("What happened"),
        paragraph(esc(args.reason), 0),
      ].join(""),
    ),

    args.retryable
      ? paragraph(
          "This is usually temporary. Running the review again is the right first step — you won't be charged twice for the same analysis.",
        )
      : paragraph(
          "This one won't resolve on a retry. Open the analysis for the specific detail, and reply to this email if it doesn't make sense — a person reads it.",
        ),

    button(args.retryable ? "Try the review again" : "See the details", url),
    rule(0, 18),
    meta(
      "Your document and any work already completed are untouched. Nothing was lost.",
    ),
  ].join("");

  const text = [
    "We couldn't finish this review",
    "",
    `Something went wrong while reviewing "${title_}".`,
    "",
    `What happened: ${args.reason}`,
    "",
    args.retryable
      ? "This is usually temporary. Running the review again is the right first step — you won't be charged twice for the same analysis."
      : "This one won't resolve on a retry. Open the analysis for the specific detail, and reply to this email if it doesn't make sense.",
    "",
    `${args.retryable ? "Try again" : "See the details"}: ${url}`,
    "",
    "Your document and any work already completed are untouched.",
    textFooter(),
  ].join("\n");

  return {
    subject: "We couldn't finish your review",
    html: layout({
      title: "We couldn't finish this review",
      preheader: `${title_} — ${args.reason}`,
      body,
      settingsUrl: SETTINGS(),
    }),
    text,
  };
}

// ---------------------------------------------------------------------------
// UPLOAD_INCOMPATIBLE
// ---------------------------------------------------------------------------

export interface UploadIncompatibleArgs {
  paperTitle: string;
  paperId: string;
  /** Human sentence for the stored reason code. */
  reason: string;
  /** Concrete things the student can change, in order. */
  suggestions: readonly string[];
}

export function uploadIncompatibleEmail(
  args: UploadIncompatibleArgs,
): RenderedEmail {
  const url = emailUrls.paper(args.paperId);
  const title_ = clamp(args.paperTitle || "your document", 90);

  const body = [
    pill("Can't review this file", "critical"),
    title("This document needs a change first"),
    lead(
      `We had a look at ${strong(title_)} before starting, and it isn't something we can review as it stands.`,
    ),

    well([sectionLabel("The reason"), paragraph(esc(args.reason), 0)].join("")),

    args.suggestions.length > 0
      ? [
          sectionLabel("What usually fixes it"),
          ...args.suggestions.map((suggestion, index) =>
            accentRow({
              tone: "warning",
              label: `Step ${index + 1}`,
              title: suggestion,
            }),
          ),
          "<div style=\"height:8px;font-size:0;line-height:0;\">&nbsp;</div>",
        ].join("")
      : "",

    button("Upload a new version", emailUrls.upload()),
    textLink("Or review the file you sent", url),
    rule(0, 18),
    meta("You have not been charged for this upload."),
  ].join("");

  const text = [
    "This document needs a change first",
    "",
    `We had a look at "${title_}" before starting, and it isn't something we can review as it stands.`,
    "",
    `The reason: ${args.reason}`,
    "",
    ...(args.suggestions.length > 0
      ? [
          "What usually fixes it:",
          ...args.suggestions.map((s, i) => `  ${i + 1}. ${s}`),
          "",
        ]
      : []),
    `Upload a new version: ${emailUrls.upload()}`,
    `Or review the file you sent: ${url}`,
    "",
    "You have not been charged for this upload.",
    textFooter(),
  ].join("\n");

  return {
    subject: "We can't review this file yet",
    html: layout({
      title: "This document needs a change first",
      preheader: `${title_} — ${args.reason}`,
      body,
      settingsUrl: SETTINGS(),
    }),
    text,
  };
}

// ---------------------------------------------------------------------------
// REFERENCE_ISSUES_FOUND
// ---------------------------------------------------------------------------

export interface ReferenceIssuesArgs {
  paperTitle: string;
  analysisId: string;
  total: number;
  verified: number;
  unverified: number;
  broken: number;
  /** Up to four of the worst offenders. */
  examples: ReadonlyArray<{ label: string; citation: string }>;
}

export function referenceIssuesEmail(
  args: ReferenceIssuesArgs,
): RenderedEmail {
  const url = emailUrls.analysisReferences(args.analysisId);
  const title_ = clamp(args.paperTitle || "your document", 90);
  const problem = args.broken + args.unverified;

  const body = [
    pill("References need review", args.broken > 0 ? "critical" : "warning"),
    title("Some references didn't check out"),
    lead(
      `We checked all ${args.total} ${plural(args.total, "reference", "references")} in ${strong(
        title_,
      )} against the scholarly record. ${problem} ${plural(problem, "needs", "need")} your attention.`,
    ),

    statRow([
      { value: String(args.verified), label: "verified", tone: "verified" },
      { value: String(args.unverified), label: "not found", tone: "warning" },
      { value: String(args.broken), label: "broken", tone: "critical" },
    ]),

    args.examples.length > 0
      ? [
          sectionLabel("A few to look at"),
          ...args.examples.map((example) =>
            accentRow({
              tone: "warning",
              label: example.label,
              title: clamp(example.citation, 130),
            }),
          ),
          "<div style=\"height:8px;font-size:0;line-height:0;\">&nbsp;</div>",
        ].join("")
      : "",

    paragraph(
      "A reference we couldn't find isn't automatically wrong — older books, local theses and some regional journals aren't indexed anywhere we can reach. It does mean an examiner may ask about it, so it's worth being able to answer.",
    ),

    button("Review the bibliography", url),
  ].join("");

  const text = [
    "Some references didn't check out",
    "",
    `We checked all ${args.total} ${plural(args.total, "reference", "references")} in "${title_}" against the scholarly record. ${problem} ${plural(
      problem,
      "needs",
      "need",
    )} your attention.`,
    "",
    `Verified: ${args.verified} · Not found: ${args.unverified} · Broken: ${args.broken}`,
    "",
    ...(args.examples.length > 0
      ? [
          "A few to look at:",
          ...args.examples.map((e) => `  • ${e.label}: ${e.citation}`),
          "",
        ]
      : []),
    "A reference we couldn't find isn't automatically wrong — older books, local theses and some regional journals aren't indexed anywhere we can reach. It does mean an examiner may ask about it.",
    "",
    `Review the bibliography: ${url}`,
    textFooter(),
  ].join("\n");

  return {
    subject: `${problem} ${plural(problem, "reference needs", "references need")} a look`,
    html: layout({
      title: "Some references didn't check out",
      preheader: `${args.verified} of ${args.total} verified in ${title_}. ${args.broken} broken, ${args.unverified} not found.`,
      body,
      settingsUrl: SETTINGS(),
    }),
    text,
  };
}

// ---------------------------------------------------------------------------
// TODO_DUE_SOON
// ---------------------------------------------------------------------------

export interface TodoDueSoonArgs {
  paperTitle: string;
  analysisId: string;
  /** Ordered soonest first. `dueLabel` is pre-formatted in the user's locale. */
  todos: ReadonlyArray<{ title: string; dueLabel: string; overdue: boolean }>;
  remainingCount: number;
}

export function todoDueSoonEmail(args: TodoDueSoonArgs): RenderedEmail {
  const url = emailUrls.analysisTodos(args.analysisId);
  const title_ = clamp(args.paperTitle || "your document", 90);
  const anyOverdue = args.todos.some((todo) => todo.overdue);

  const body = [
    pill(anyOverdue ? "Overdue" : "Due soon", anyOverdue ? "critical" : "warning"),
    title(anyOverdue ? "A task has slipped past its date" : "A gentle nudge"),
    lead(
      `${args.todos.length} ${plural(args.todos.length, "task", "tasks")} on ${strong(
        title_,
      )} ${plural(args.todos.length, "is", "are")} coming up.`,
    ),

    ...args.todos.map((todo) =>
      accentRow({
        tone: todo.overdue ? "critical" : "warning",
        label: todo.dueLabel,
        title: clamp(todo.title, 140),
      }),
    ),
    "<div style=\"height:14px;font-size:0;line-height:0;\">&nbsp;</div>",

    args.remainingCount > 0
      ? paragraph(
          `${args.remainingCount} other ${plural(args.remainingCount, "task is", "tasks are")} still open on this paper.`,
        )
      : "",

    button("Open your action plan", url),
    rule(0, 18),
    meta(
      "These dates are yours — set from your own submission deadline. Change or clear them any time in the action plan.",
    ),
  ].join("");

  const text = [
    anyOverdue ? "A task has slipped past its date" : "A gentle nudge",
    "",
    `${args.todos.length} ${plural(args.todos.length, "task", "tasks")} on "${title_}" ${plural(
      args.todos.length,
      "is",
      "are",
    )} coming up.`,
    "",
    ...args.todos.map((todo) => `  • [${todo.dueLabel}] ${todo.title}`),
    "",
    ...(args.remainingCount > 0
      ? [
          `${args.remainingCount} other ${plural(args.remainingCount, "task is", "tasks are")} still open on this paper.`,
          "",
        ]
      : []),
    `Open your action plan: ${url}`,
    textFooter(),
  ].join("\n");

  return {
    subject: anyOverdue ? "A thesis task is overdue" : "A thesis task is due soon",
    html: layout({
      title: anyOverdue ? "A task has slipped past its date" : "A gentle nudge",
      preheader: `${args.todos[0]?.title ?? "You have tasks due"} — ${args.todos[0]?.dueLabel ?? ""}`.trim(),
      body,
      settingsUrl: SETTINGS(),
    }),
    text,
  };
}

// ---------------------------------------------------------------------------
// REQUIREMENTS_EXTRACTED
// ---------------------------------------------------------------------------

export interface RequirementsExtractedArgs {
  /** The guidelines file the rules came out of. */
  sourceName: string;
  requirementCount: number;
  /** How many can be checked automatically; the rest are manual reminders. */
  checkableCount: number;
}

export function requirementsExtractedEmail(
  args: RequirementsExtractedArgs,
): RenderedEmail {
  const url = emailUrls.requirements();
  const source = clamp(args.sourceName || "your guidelines", 60);
  const manual = Math.max(0, args.requirementCount - args.checkableCount);

  const body = [
    // `primary` here is correct and deliberate: this is a system notice, not a
    // verdict. Nothing passed or failed, so no status colour applies.
    pill("Requirements ready", "primary"),
    title("We read your supervisor's brief"),
    lead(
      `We pulled ${strong(String(args.requirementCount))} ${plural(
        args.requirementCount,
        "requirement",
        "requirements",
      )} out of ${strong(source)}.`,
    ),

    statRow([
      {
        value: String(args.checkableCount),
        label: plural(
          args.checkableCount,
          "we can check",
          "we can check",
        ),
        tone: args.checkableCount > 0 ? "verified" : undefined,
      },
      {
        value: String(manual),
        label: plural(manual, "for you to confirm", "for you to confirm"),
        tone: manual > 0 ? "warning" : undefined,
      },
    ]),

    paragraph(
      "Apply them to a paper and every review of it is checked against your department's rules as well as the standard checks — so a word count or a citation style your faculty set is caught before an examiner catches it.",
    ),

    manual > 0
      ? paragraph(
          `The ${manual} we can't check ${plural(manual, "is", "are")} things like margins, font size and line spacing. Those don't survive into the text we read, so we list them as reminders rather than pretending to verify them.`,
        )
      : "",

    paragraph(
      "Worth a quick look either way: extraction is good but not perfect, and a requirement we misread is one we'd then check you against.",
    ),

    button("Review the requirements", url),
  ].join("");

  const text = [
    "We read your supervisor's brief",
    "",
    `We pulled ${args.requirementCount} ${plural(
      args.requirementCount,
      "requirement",
      "requirements",
    )} out of "${source}".`,
    "",
    `${args.checkableCount} we can check automatically · ${manual} for you to confirm yourself`,
    "",
    "Apply them to a paper and every review of it is checked against your department's rules as well as the standard checks.",
    "",
    ...(manual > 0
      ? [
          `The ${manual} we can't check ${plural(manual, "is", "are")} things like margins, font size and line spacing — they don't survive into the text we read, so we list them as reminders rather than pretending to verify them.`,
          "",
        ]
      : []),
    "Worth a quick look either way: extraction is good but not perfect, and a requirement we misread is one we'd then check you against.",
    "",
    `Review the requirements: ${url}`,
    textFooter(),
  ].join("\n");

  return {
    subject: "Your requirements are set up",
    html: layout({
      title: "We read your supervisor's brief",
      preheader: `${args.requirementCount} ${plural(
        args.requirementCount,
        "requirement",
        "requirements",
      )} from ${source}, ready to apply to a paper.`,
      body,
      settingsUrl: SETTINGS(),
    }),
    text,
  };
}

// ---------------------------------------------------------------------------
// Weekly digest — opt-in, and the only non-event email.
// ---------------------------------------------------------------------------

export interface WeeklyDigestArgs {
  /** Empty string is fine; the greeting adapts. */
  firstName: string;
  analysesCompleted: number;
  findingsResolved: number;
  openTodos: number;
  papers: ReadonlyArray<{
    title: string;
    score: number | null;
    band: ScoreBand | null;
    analysisId: string;
  }>;
}

export function weeklyDigestEmail(args: WeeklyDigestArgs): RenderedEmail {
  const greeting = args.firstName ? `Morning, ${clamp(args.firstName, 40)}.` : "Morning.";

  const body = [
    pill("Weekly digest", "primary"),
    title("Where your thesis stands"),
    lead(`${esc(greeting)} Here's the week, briefly.`),

    statRow([
      {
        value: String(args.analysesCompleted),
        label: plural(args.analysesCompleted, "review completed", "reviews completed"),
      },
      {
        value: String(args.findingsResolved),
        label: plural(args.findingsResolved, "finding resolved", "findings resolved"),
        tone: args.findingsResolved > 0 ? "verified" : undefined,
      },
      { value: String(args.openTodos), label: "tasks open" },
    ]),

    args.papers.length > 0
      ? [
          sectionLabel("Your papers"),
          ...args.papers.map((paper) => {
            const band = bandPresentation(paper.band);
            return accentRow({
              tone: band.tone,
              label:
                paper.score === null
                  ? "Not yet scored"
                  : `${Math.round(paper.score)}/100 · ${band.label}`,
              title: clamp(paper.title, 120),
            });
          }),
          "<div style=\"height:8px;font-size:0;line-height:0;\">&nbsp;</div>",
        ].join("")
      : paragraph("Nothing under review this week."),

    button("Open your dashboard", emailUrls.dashboard()),
  ].join("");

  const text = [
    "Where your thesis stands",
    "",
    greeting,
    "",
    `${args.analysesCompleted} ${plural(args.analysesCompleted, "review", "reviews")} completed · ${args.findingsResolved} ${plural(
      args.findingsResolved,
      "finding",
      "findings",
    )} resolved · ${args.openTodos} tasks open`,
    "",
    ...(args.papers.length > 0
      ? [
          "Your papers:",
          ...args.papers.map(
            (p) =>
              `  • ${p.title} — ${p.score === null ? "not yet scored" : `${Math.round(p.score)}/100`}`,
          ),
          "",
        ]
      : ["Nothing under review this week.", ""]),
    `Open your dashboard: ${emailUrls.dashboard()}`,
    textFooter(),
  ].join("\n");

  return {
    subject: "Your thesis, this week",
    html: layout({
      title: "Where your thesis stands",
      preheader: `${args.analysesCompleted} ${plural(
        args.analysesCompleted,
        "review",
        "reviews",
      )} completed, ${args.openTodos} tasks still open.`,
      body,
      settingsUrl: SETTINGS(),
      footerNote:
        "You turned the weekly digest on in your settings. It's the only email we send that isn't about something that just happened.",
    }),
    text,
  };
}
