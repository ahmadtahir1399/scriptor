import { describe, expect, it } from "vitest";

import {
  PURGE_FORBIDDEN_TABLES,
  assertPurgeTargetsSafe,
  selectPurgeableUploads,
  type PurgeCandidate,
} from "@/lib/retention/purge";

/**
 * The purge is the most dangerous background job in the product: a mistake
 * deletes a student's report. These tests pin the two guarantees — it selects
 * only genuinely-due uploads, and it can NEVER be pointed at a report table.
 */

function candidate(
  partial: Partial<PurgeCandidate> & { id: string },
): PurgeCandidate {
  return {
    filePath: `u/${partial.id}/source.pdf`,
    autoDelete: true,
    createdAt: "2020-01-01T00:00:00Z",
    hasContent: true,
    ...partial,
  };
}

describe("selectPurgeableUploads", () => {
  const now = new Date("2025-07-19T00:00:00Z");

  it("selects an auto-delete upload older than 90 days", () => {
    const result = selectPurgeableUploads(
      [candidate({ id: "a", createdAt: "2025-01-01T00:00:00Z" })],
      now,
    );
    expect(result.map((c) => c.id)).toEqual(["a"]);
  });

  it("excludes uploads with auto-delete off", () => {
    const result = selectPurgeableUploads(
      [
        candidate({
          id: "a",
          autoDelete: false,
          createdAt: "2020-01-01T00:00:00Z",
        }),
      ],
      now,
    );
    expect(result).toHaveLength(0);
  });

  it("excludes uploads inside the retention window", () => {
    const result = selectPurgeableUploads(
      [candidate({ id: "a", createdAt: "2025-07-01T00:00:00Z" })],
      now,
    );
    expect(result).toHaveLength(0);
  });

  it("excludes uploads already purged (no content left) — idempotent sweep", () => {
    const result = selectPurgeableUploads(
      [
        candidate({
          id: "a",
          createdAt: "2020-01-01T00:00:00Z",
          hasContent: false,
        }),
      ],
      now,
    );
    expect(result).toHaveLength(0);
  });
});

describe("assertPurgeTargetsSafe", () => {
  it("allows source-only targets", () => {
    expect(() =>
      assertPurgeTargetsSafe([
        "storage:source",
        "paper_pages.page_content",
        "words",
      ]),
    ).not.toThrow();
  });

  it("refuses to purge any report table", () => {
    for (const table of PURGE_FORBIDDEN_TABLES) {
      expect(() => assertPurgeTargetsSafe([table])).toThrow(
        /must never be purged/,
      );
    }
  });
});
