import { NextResponse, type NextRequest } from "next/server";

import {
  analysisCompleteEmail,
  analysisFailedEmail,
  referenceIssuesEmail,
  requirementsExtractedEmail,
  todoDueSoonEmail,
  uploadIncompatibleEmail,
  weeklyDigestEmail,
  type RenderedEmail,
} from "@/lib/email/templates";

/**
 * Email template previews. DEVELOPMENT ONLY.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 *
 * The alternative is triggering a real analysis to see one email, which is
 * minutes per iteration and cannot produce the cases that matter most — an
 * unscored analysis, a cost-ceiling failure, a bibliography where everything
 * broke. Each preview below is a fixture chosen to exercise a branch the happy
 * path never reaches.
 *
 * ── WHY IT IS 404 IN PRODUCTION ──────────────────────────────────────────────
 *
 * Not because the content is secret — it is template copy — but because an
 * unauthenticated endpoint that renders attacker-controllable strings into HTML
 * and serves it from the app's own origin is a reflected-XSS surface waiting for
 * someone to add a `?title=` parameter to it. Closing it in production means
 * that mistake can never ship. `NODE_ENV` is compiled in, so this is a build
 * constant, not a runtime check someone can flip.
 *
 * Usage:
 *   /api/dev/email-preview                    → index of every fixture
 *   /api/dev/email-preview?t=complete         → rendered HTML
 *   /api/dev/email-preview?t=complete&part=text → the text/plain alternative
 */

export const dynamic = "force-dynamic";

const FIXTURES: Record<string, () => RenderedEmail> = {
  complete: () =>
    analysisCompleteEmail({
      paperTitle:
        "Participatory Governance and Municipal Water Policy in the Rhine Valley, 1998–2019",
      analysisId: "00000000-0000-4000-8000-000000000001",
      score: 74,
      band: "solid",
      checksRun: 9,
      findingCount: 23,
      highSeverityCount: 4,
      priorities: [
        {
          label: "High priority",
          title: "The research question is never restated after chapter 2",
          tone: "critical",
        },
        {
          label: "High priority",
          title: "Methodology does not justify the case selection",
          tone: "critical",
        },
        {
          label: "Worth fixing",
          title: "Inconsistent citation style between chapters 4 and 5",
          tone: "warning",
        },
      ],
      sampleExcerpt: {
        text: "This thesis argues that participatory mechanisms, while widely adopted, have not meaningfully redistributed decision-making authority in the cases examined.",
        pageLabel: "Page 3",
      },
    }),

  // The branch where post-processing succeeded but no check returned a rating —
  // the score plate is replaced by a well, and the copy must not imply failure.
  "complete-unscored": () =>
    analysisCompleteEmail({
      paperTitle: "An Untitled Draft",
      analysisId: "00000000-0000-4000-8000-000000000002",
      score: null,
      band: null,
      checksRun: 2,
      findingCount: 0,
      highSeverityCount: 0,
      priorities: [],
    }),

  // A very low score. Checks the copy stays supervisory rather than alarmed.
  "complete-low": () =>
    analysisCompleteEmail({
      paperTitle: "Draft Two — Restructured",
      analysisId: "00000000-0000-4000-8000-000000000003",
      score: 31,
      band: "needs_work",
      checksRun: 9,
      findingCount: 61,
      highSeverityCount: 19,
      priorities: [
        {
          label: "High priority",
          title: "No clear thesis statement in the introduction",
          tone: "critical",
        },
        {
          label: "High priority",
          title: "Chapters 3 and 4 make the same argument twice",
          tone: "critical",
        },
      ],
    }),

  failed: () =>
    analysisFailedEmail({
      paperTitle: "Participatory Governance and Municipal Water Policy",
      analysisId: "00000000-0000-4000-8000-000000000004",
      reason:
        "Every check failed to complete. That is almost always a temporary problem on our side rather than anything about your document.",
      retryable: true,
    }),

  "failed-cost": () =>
    analysisFailedEmail({
      paperTitle: "A Very Long Thesis Indeed",
      analysisId: "00000000-0000-4000-8000-000000000005",
      reason:
        "The analysis reached its cost limit before every check finished. The checks that did complete are saved and worth reading — running it again would stop at the same point.",
      retryable: false,
    }),

  incompatible: () =>
    uploadIncompatibleEmail({
      paperTitle: "scan_of_thesis_final_FINAL.pdf",
      paperId: "00000000-0000-4000-8000-000000000006",
      reason:
        "This looks like a scanned document — the pages are images, so there is no text for us to read.",
      suggestions: [
        "Export a fresh PDF from Word, Google Docs or LaTeX rather than scanning a printed copy.",
        "If a scan is all you have, run it through OCR first so the text becomes selectable.",
      ],
    }),

  references: () =>
    referenceIssuesEmail({
      paperTitle: "Participatory Governance and Municipal Water Policy",
      analysisId: "00000000-0000-4000-8000-000000000007",
      total: 84,
      verified: 61,
      unverified: 17,
      broken: 6,
      examples: [
        {
          label: "Broken link",
          citation:
            "Habermas, J. (1996). Between Facts and Norms. Retrieved from http://example.edu/oldlink",
        },
        {
          label: "Not found",
          citation:
            "Müller, K. (2011). Wasserpolitik im Föderalismus. Unpublished manuscript.",
        },
        {
          label: "Needs correction",
          citation:
            "Ostrom, E. (1990). Governing the Commons. Cambridge Univ Press. (year listed as 1991 in text)",
        },
      ],
    }),

  todos: () =>
    todoDueSoonEmail({
      paperTitle: "Participatory Governance and Municipal Water Policy",
      analysisId: "00000000-0000-4000-8000-000000000008",
      todos: [
        {
          title: "Rewrite the research question so it appears in the abstract",
          dueLabel: "Overdue by 2 days",
          overdue: true,
        },
        {
          title: "Add a justification for the case selection to §3.2",
          dueLabel: "Due today",
          overdue: false,
        },
        {
          title: "Normalise citation style across chapters 4 and 5",
          dueLabel: "Due in 3 days",
          overdue: false,
        },
      ],
      remainingCount: 12,
    }),

  requirements: () =>
    requirementsExtractedEmail({
      sourceName: "Faculty of Social Sciences — Thesis Guidelines 2026.pdf",
      requirementCount: 27,
      checkableCount: 19,
    }),

  digest: () =>
    weeklyDigestEmail({
      firstName: "Amelie",
      analysesCompleted: 2,
      findingsResolved: 31,
      openTodos: 12,
      papers: [
        {
          title: "Participatory Governance and Municipal Water Policy",
          score: 74,
          band: "solid",
          analysisId: "00000000-0000-4000-8000-000000000009",
        },
        {
          title: "Seminar Paper — Deliberative Democracy",
          score: 88,
          band: "strong",
          analysisId: "00000000-0000-4000-8000-00000000000a",
        },
        {
          title: "Draft Two — Restructured",
          score: null,
          band: null,
          analysisId: "00000000-0000-4000-8000-00000000000b",
        },
      ],
    }),
};

export async function GET(request: NextRequest): Promise<Response> {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  const key = request.nextUrl.searchParams.get("t");
  if (!key) return index();

  const fixture = FIXTURES[key];
  if (!fixture) {
    return new NextResponse(`Unknown template "${key}".`, {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const rendered = fixture();

  if (request.nextUrl.searchParams.get("part") === "text") {
    return new NextResponse(`Subject: ${rendered.subject}\n\n${rendered.text}`, {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  return new NextResponse(rendered.html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

/** A plain index. Deliberately unstyled — the templates are the subject here. */
function index(): NextResponse {
  const rows = Object.entries(FIXTURES)
    .map(([key, render]) => {
      const { subject } = render();
      return `<tr>
<td style="padding:6px 16px 6px 0;font-family:ui-monospace,monospace;">${key}</td>
<td style="padding:6px 16px 6px 0;">${escapeHtml(subject)}</td>
<td style="padding:6px 0;"><a href="?t=${key}">html</a> · <a href="?t=${key}&amp;part=text">text</a></td>
</tr>`;
    })
    .join("");

  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Email previews</title></head>
<body style="font-family:system-ui,sans-serif;max-width:840px;margin:48px auto;padding:0 24px;line-height:1.5;">
<h1 style="font-size:20px;">Scriptor email previews</h1>
<p style="color:#555;">Development only. Open an HTML preview and resize the window to check the 620px breakpoint; switch your OS to dark mode to check the dark variant.</p>
<table style="border-collapse:collapse;font-size:14px;">${rows}</table>
</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
