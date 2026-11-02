import { describe, expect, it } from "vitest";

import {
  findBibliographyWordCutoff,
  selectReferenceSections,
} from "@/lib/references/referenceSections";
import { splitBibliographyBlocks } from "@/lib/references/splitEntries";
import type { PageType } from "@/lib/db/enums";

/**
 * The regression these cover is the one that made the feature look broken:
 * a reference list that starts partway down a BODY page, with entries that wrap
 * across lines. Both halves were lost — the page because it was typed BODY, the
 * wrapped lines because each became its own "source".
 *
 * The fixture below is the real shape taken from an upload in the database, not
 * an invented one.
 */

function page(
  page_number: number,
  page_type: PageType,
  page_content: string,
): { page_number: number; page_type: PageType; page_content: string } {
  return { page_number, page_type, page_content };
}

const CONCLUSION_THEN_REFERENCES = `having lost the practices that gave it substance. Further research might productively
compare this sequence with other interwar democracies that experienced comparable economic
distress without comparable institutional erosion.
References
Bracher, K. D. (1970). The German Dictatorship: The Origins, Structure and Effects of
National Socialism. New York: Praeger.
Broszat, M. (1981). The Hitler State: The Foundation and Development of the Internal
Structure of the Third Reich. London: Longman.
Childers, T. (1983). The Nazi Voter: The Social Foundations of Fascism in Germany,
1919-1933. Chapel Hill: University of North Carolina Press.`;

const REFERENCES_CONTINUED = `Peukert, D. J. K. (1992). The Weimar Republic: The Crisis of Classical Modernity. New York:
Hill and Wang.
Turner, H. A. (1985). German Big Business and the Rise of Hitler. Oxford: Oxford University
Press.`;

describe("selectReferenceSections", () => {
  it("recovers a reference list that starts partway down a BODY page", () => {
    const sections = selectReferenceSections([
      page(1, "COVER", "A Thesis"),
      page(2, "BODY", "The depression was indispensable to the outcome."),
      page(3, "BODY", CONCLUSION_THEN_REFERENCES),
      page(4, "BIBLIOGRAPHY", REFERENCES_CONTINUED),
    ]);

    expect(sections.map((section) => section.page_number)).toEqual([3, 4]);
    // The conclusion above the heading is excluded...
    expect(sections[0]?.page_content).not.toContain("Further research");
    // ...and so is the heading itself, which is not somebody's citation.
    expect(sections[0]?.page_content.startsWith("Bracher")).toBe(true);
  });

  it("finds the section when no page was classified BIBLIOGRAPHY at all", () => {
    const sections = selectReferenceSections([
      page(1, "COVER", "A Thesis"),
      page(2, "BODY", CONCLUSION_THEN_REFERENCES),
      page(3, "BODY", REFERENCES_CONTINUED),
    ]);

    expect(sections.map((section) => section.page_number)).toEqual([2, 3]);
  });

  it("reads a markdown heading, hashes and bold fences and all", () => {
    const sections = selectReferenceSections([
      page(1, "COVER", "A Thesis"),
      page(
        2,
        "BODY",
        `Some closing prose about the argument.\n## **References**\n${REFERENCES_CONTINUED}`,
      ),
    ]);

    expect(sections).toHaveLength(1);
    expect(sections[0]?.page_content.startsWith("Peukert")).toBe(true);
  });

  it("stops at the appendix rather than swallowing it", () => {
    const sections = selectReferenceSections([
      page(1, "COVER", "A Thesis"),
      page(2, "BODY", CONCLUSION_THEN_REFERENCES),
      page(3, "APPENDIX", "Appendix A\nInterview transcripts follow."),
    ]);

    expect(sections.map((section) => section.page_number)).toEqual([2]);
  });

  it("ignores a contents line and reports no section", () => {
    const sections = selectReferenceSections([
      page(1, "COVER", "A Thesis"),
      page(2, "TOC", "Contents\n1. Introduction 3\nReferences 24"),
      page(3, "BODY", "Ordinary prose that argues a point at some length."),
    ]);

    expect(sections).toEqual([]);
  });

  it("returns nothing for a document with no reference section", () => {
    const sections = selectReferenceSections([
      page(1, "COVER", "A Thesis"),
      page(2, "BODY", "Ordinary prose that argues a point at some length."),
    ]);

    expect(sections).toEqual([]);
  });
});

describe("findBibliographyWordCutoff", () => {
  function words(text: string) {
    return text
      .split(/\s+/)
      .filter(Boolean)
      .map((word, index) => ({ text: word, wordIndex: index }));
  }

  it("cuts the page at the heading so the list is not read as citations", () => {
    const page = words(
      "The order retained its formal structure. References Bracher, K. D. (1970). The German Dictatorship. New York: Praeger. Evans, R. J. (2003). The Coming of the Third Reich. London: Penguin.",
    );

    const cutoff = findBibliographyWordCutoff(page);

    expect(cutoff).not.toBeNull();
    expect(page[cutoff as number]?.text).toBe("References");
    // Everything kept is prose; nothing kept is a reference entry.
    expect(page.slice(0, cutoff as number).map((w) => w.text)).not.toContain(
      "Bracher,",
    );
  });

  it("ignores the word in prose, where it is not a heading", () => {
    const page = words(
      "Each of the references cited above (Evans, 2003) supports the reading, as does the argument in (Kershaw, 1998) about the same period.",
    );

    expect(findBibliographyWordCutoff(page)).toBeNull();
  });

  it("returns null for a page that is all prose", () => {
    expect(
      findBibliographyWordCutoff(
        words("Ordinary prose that argues a point at some length."),
      ),
    ).toBeNull();
  });
});

describe("splitBibliographyBlocks", () => {
  it("keeps a wrapped entry whole instead of cutting it at the line break", () => {
    const blocks = splitBibliographyBlocks([
      { page_number: 4, page_content: REFERENCES_CONTINUED },
    ]);

    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.rawText).toBe(
      "Peukert, D. J. K. (1992). The Weimar Republic: The Crisis of Classical Modernity. New York: Hill and Wang.",
    );
    expect(blocks[1]?.rawText).toBe(
      "Turner, H. A. (1985). German Big Business and the Rise of Hitler. Oxford: Oxford University Press.",
    );
  });

  it("splits a numbered list on its markers and drops them", () => {
    const blocks = splitBibliographyBlocks([
      {
        page_number: 9,
        page_content: `[1] A. Author, "A study of things," J. Things, vol. 3, no. 1,\npp. 10-20, 2019.\n[2] B. Writer, "Another study," J. Things, vol. 4, 2021.`,
      },
    ]);

    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.rawText.startsWith("A. Author")).toBe(true);
    expect(blocks[0]?.rawText).toContain("pp. 10-20");
    expect(blocks[1]?.rawText.startsWith("B. Writer")).toBe(true);
  });

  it("splits blank-line separated entries", () => {
    const blocks = splitBibliographyBlocks([
      {
        page_number: 7,
        page_content: `Evans, R. J. (2003). The Coming of the Third Reich. London: Penguin.\n\nJames, H. (1986). The German Slump. Oxford: Oxford University Press.`,
      },
    ]);

    expect(blocks).toHaveLength(2);
  });

  it("still finds every entry when a stray blank line breaks the run", () => {
    const blocks = splitBibliographyBlocks([
      {
        page_number: 7,
        page_content: `Evans, R. J. (2003). The Coming of the Third Reich. London: Penguin.\nJames, H. (1986). The German Slump. Oxford: Oxford University Press.\n\nKershaw, I. (1998). Hitler: 1889-1936: Hubris. New York: W. W. Norton.\nPeukert, D. J. K. (1992). The Weimar Republic. New York: Hill and Wang.`,
      },
    ]);

    expect(blocks).toHaveLength(4);
    expect(blocks[2]?.rawText.startsWith("Kershaw")).toBe(true);
  });

  it("keeps a title-first entry whole across its wrapped lines", () => {
    const blocks = splitBibliographyBlocks([
      {
        page_number: 7,
        page_content: `The Chicago Manual of Style. 17th ed. Chicago: University of\nChicago Press, 2017.\n\nPublication Manual of the American Psychological Association. 7th ed.\nWashington, DC: APA, 2020.`,
      },
    ]);

    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.rawText).toContain("Chicago Press, 2017.");
  });
});
