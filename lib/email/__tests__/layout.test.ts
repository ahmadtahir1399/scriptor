import { describe, expect, it } from "vitest";

import { clamp, esc, escUrl } from "@/lib/email/layout";
import { analysisCompleteEmail } from "@/lib/email/templates";

/**
 * Escaping is a SECURITY control here, not a formatting nicety.
 *
 * Paper titles, thesis excerpts and model-written finding text all flow into
 * these templates, and a student controls all three — the filename, the document
 * body, and therefore what the model quotes back. An unescaped interpolation is
 * an HTML injection into somebody's inbox, delivered by us, from our domain.
 * These tests exist so that stays impossible.
 */

describe("esc", () => {
  it("neutralises every character that can break out of a text node", () => {
    expect(esc(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });

  it("escapes the ampersand FIRST, so entities are not double-decoded", () => {
    // If & were escaped last, "&lt;" would already contain a literal & and
    // become "&amp;lt;" — which renders as the text "&lt;" rather than "<".
    // Getting the order wrong is the classic way an escaper silently stops
    // escaping.
    expect(esc("&lt;")).toBe("&amp;lt;");
  });

  it("escapes both quote styles, for use inside attribute values", () => {
    expect(esc(`a"b'c`)).toBe("a&quot;b&#39;c");
  });
});

describe("escUrl", () => {
  it("passes http and https through", () => {
    expect(escUrl("https://example.com/a?b=1&c=2")).toBe(
      "https://example.com/a?b=1&amp;c=2",
    );
  });

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "/relative/path",
    "",
  ])("refuses %j and degrades to #", (value) => {
    expect(escUrl(value)).toBe("#");
  });

  it("refuses a scheme hidden behind leading whitespace", () => {
    expect(escUrl("  javascript:alert(1)")).toBe("#");
  });
});

describe("clamp", () => {
  it("leaves a short string alone", () => {
    expect(clamp("A short title", 40)).toBe("A short title");
  });

  it("collapses runs of whitespace", () => {
    expect(clamp("a   b\n\nc", 40)).toBe("a b c");
  });

  it("cuts on a word boundary and appends an ellipsis", () => {
    const result = clamp("alpha beta gamma delta epsilon", 20);
    expect(result.endsWith("…")).toBe(true);
    expect(result).not.toContain("delt…");
  });

  it("hard-cuts a single long word rather than returning almost nothing", () => {
    // Falling back to the word boundary here would cut at index 0 and return
    // just "…", losing the whole string.
    const result = clamp("x".repeat(50), 10);
    expect(result).toBe(`${"x".repeat(10)}…`);
  });
});

describe("analysisCompleteEmail", () => {
  const base = {
    paperTitle: "A Normal Thesis",
    analysisId: "abc",
    score: 74,
    band: "solid" as const,
    checksRun: 9,
    findingCount: 3,
    highSeverityCount: 1,
    priorities: [],
  };

  it("escapes a hostile paper title everywhere it appears", () => {
    const email = analysisCompleteEmail({
      ...base,
      paperTitle: `<img src=x onerror="alert(1)">`,
    });

    // What matters is that no TAG survives. The substring `onerror=` does still
    // appear — as inert text, inside `&lt;img src=x onerror=&quot;…`. Asserting
    // on the attribute name alone would be testing for the wrong thing: an
    // escaper's job is to neutralise the angle brackets, not to censor words.
    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("&lt;img src=x");
    expect(email.html).toContain("onerror=&quot;");
  });

  it("escapes a hostile finding title and excerpt", () => {
    const email = analysisCompleteEmail({
      ...base,
      priorities: [
        {
          label: "High priority",
          title: `</p><script>alert(1)</script>`,
          tone: "critical",
        },
      ],
      sampleExcerpt: { text: `<b>quoted</b>`, pageLabel: `<i>p1</i>` },
    });

    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<b>quoted</b>");
    expect(email.html).not.toContain("<i>p1</i>");
  });

  it("always produces a text alternative as well as HTML", () => {
    // A multipart message with no text part is a strong spam signal at every
    // major filter, and these are the emails that must not be filtered.
    const email = analysisCompleteEmail(base);
    expect(email.text.length).toBeGreaterThan(80);
    expect(email.text).not.toContain("<td");
    expect(email.subject).toBeTruthy();
  });

  it("does not claim a score when there is none", () => {
    const email = analysisCompleteEmail({ ...base, score: null, band: null });
    expect(email.text).toContain("not enough checks returned a rating");
    expect(email.html).not.toContain("Overall score");
  });
});
