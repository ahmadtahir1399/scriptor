import { describe, expect, it } from "vitest";

import {
  authorDateConfidence,
  reconcile,
  type BibItem,
  type InTextItem,
} from "@/lib/references/reconcile";

/**
 * Reconciliation is the deterministic heart of Reference Health — the orphans
 * it finds are the feature's whole value. These cases lean on the ways a real
 * bibliography and its citations disagree: abbreviated author lists, "2017a"
 * disambiguators, and the two families (author-date, numeric).
 */

function inText(partial: Partial<InTextItem> & { id: string }): InTextItem {
  return {
    authors: [],
    year: null,
    numericIndex: null,
    family: "author-date",
    ...partial,
  };
}

function bib(partial: Partial<BibItem> & { id: string }): BibItem {
  return { authors: [], year: null, entryIndex: null, ...partial };
}

describe("reconcile — author-date", () => {
  it("matches a citation to its entry on surname + year", () => {
    const pairs = reconcile(
      [inText({ id: "c1", authors: ["Vaswani et al."], year: "2017" })],
      [
        bib({
          id: "b1",
          authors: ["Vaswani, Ashish", "Shazeer, Noam"],
          year: "2017",
        }),
      ],
    );
    expect(pairs).toContainEqual({
      kind: "matched",
      inTextId: "c1",
      bibId: "b1",
      confidence: 1,
    });
  });

  it("flags a citation with no matching entry as cited-but-missing", () => {
    const pairs = reconcile(
      [inText({ id: "c1", authors: ["Bahdanau"], year: "2015" })],
      [bib({ id: "b1", authors: ["Vaswani"], year: "2017" })],
    );
    expect(pairs).toContainEqual({ kind: "cited_but_missing", inTextId: "c1" });
    expect(pairs).toContainEqual({ kind: "listed_but_uncited", bibId: "b1" });
  });

  it("flags an entry no citation points at as listed-but-uncited", () => {
    const pairs = reconcile(
      [inText({ id: "c1", authors: ["Vaswani"], year: "2017" })],
      [
        bib({ id: "b1", authors: ["Vaswani"], year: "2017" }),
        bib({ id: "b2", authors: ["Kingma"], year: "2014" }),
      ],
    );
    expect(pairs).toContainEqual({
      kind: "matched",
      inTextId: "c1",
      bibId: "b1",
      confidence: 1,
    });
    expect(pairs).toContainEqual({ kind: "listed_but_uncited", bibId: "b2" });
    expect(pairs.filter((p) => p.kind === "listed_but_uncited")).toHaveLength(
      1,
    );
  });

  it("does not conflate two works by the same author in different years", () => {
    const confidence = authorDateConfidence(
      inText({ id: "c1", authors: ["Smith"], year: "2019" }),
      bib({ id: "b1", authors: ["Smith"], year: "2021" }),
    );
    expect(confidence).toBe(0);
  });

  it("treats a disambiguating year suffix as the same year", () => {
    const pairs = reconcile(
      [inText({ id: "c1", authors: ["Smith"], year: "2019a" })],
      [bib({ id: "b1", authors: ["Smith"], year: "2019" })],
    );
    expect(pairs).toContainEqual({
      kind: "matched",
      inTextId: "c1",
      bibId: "b1",
      confidence: 1,
    });
  });
});

describe("reconcile — numeric", () => {
  it("matches [2] to the second reference-list entry", () => {
    const pairs = reconcile(
      [inText({ id: "c1", family: "numeric", numericIndex: 2 })],
      [bib({ id: "b1", entryIndex: 0 }), bib({ id: "b2", entryIndex: 1 })],
    );
    expect(pairs).toContainEqual({
      kind: "matched",
      inTextId: "c1",
      bibId: "b2",
      confidence: 0.95,
    });
  });

  it("flags [9] with no entry as cited-but-missing", () => {
    const pairs = reconcile(
      [inText({ id: "c1", family: "numeric", numericIndex: 9 })],
      [bib({ id: "b1", entryIndex: 0 })],
    );
    expect(pairs).toContainEqual({ kind: "cited_but_missing", inTextId: "c1" });
  });
});

describe("reconcile — empties", () => {
  it("turns every entry into an uncited orphan when nothing is cited", () => {
    const pairs = reconcile([], [bib({ id: "b1" }), bib({ id: "b2" })]);
    expect(pairs).toHaveLength(2);
    expect(pairs.every((p) => p.kind === "listed_but_uncited")).toBe(true);
  });
});
