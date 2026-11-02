import { describe, expect, it } from "vitest";

import { classifyCheckable } from "@/lib/requirements/classifyCheckable";

/**
 * The classifier decides what Scriptor promises to check. Its most important
 * property is honesty about physical-layout rules it cannot verify from text —
 * a false "checkable" there would quietly mislead the student, which is worse
 * than skipping.
 */

describe("classifyCheckable — checkable rules", () => {
  it("treats a word-count rule as checkable", () => {
    expect(
      classifyCheckable("The abstract must be 150–300 words").checkable,
    ).toBe(true);
  });

  it("treats a caption-format rule as checkable", () => {
    expect(
      classifyCheckable(
        "Every figure must have a caption in the format 'Figure N: …'",
      ).checkable,
    ).toBe(true);
  });

  it("treats a citation-style rule as checkable", () => {
    expect(
      classifyCheckable("All in-text citations must follow APA 7 with DOIs")
        .checkable,
    ).toBe(true);
  });

  it("treats a structure rule as checkable", () => {
    expect(
      classifyCheckable("Appendices must come after the bibliography")
        .checkable,
    ).toBe(true);
  });
});

describe("classifyCheckable — physical-layout rules (manual only)", () => {
  it("marks a margin rule unsupported", () => {
    const verdict = classifyCheckable("All margins must be 2.5 cm");
    expect(verdict.checkable).toBe(false);
    expect(verdict.reasonKey).toBe("margins");
  });

  it("marks a font-size rule unsupported", () => {
    const verdict = classifyCheckable("Use 12pt Times New Roman throughout");
    expect(verdict.checkable).toBe(false);
    expect(verdict.reasonKey).toBe("font");
  });

  it("marks a line-spacing rule unsupported", () => {
    const verdict = classifyCheckable(
      "The body text must use 1.5 line spacing",
    );
    expect(verdict.checkable).toBe(false);
    expect(verdict.reasonKey).toBe("spacing");
  });

  it("marks a page-size rule unsupported", () => {
    const verdict = classifyCheckable(
      "The thesis must be printed on A4 paper and bound",
    );
    expect(verdict.checkable).toBe(false);
    expect(verdict.reasonKey).toBe("physical");
  });

  it("marks an empty rule unsupported rather than guessing", () => {
    expect(classifyCheckable("   ").checkable).toBe(false);
  });
});
