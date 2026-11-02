"use client";

import * as React from "react";

import { usePapers } from "@/hooks/usePapers";
import {
  sortPaperCards,
  type PaperCardView,
  type PaperSort,
} from "@/lib/papers/presentation";
import { PaperCard } from "@/components/papers/PaperCard";
import { PaperSortControl } from "@/components/papers/PaperSortControl";
import { PapersEmptyState } from "@/components/papers/PapersEmptyState";

/**
 * The library grid — the client boundary that owns the Realtime subscription.
 *
 * Server-rendered `initial` seeds first paint; `usePapers` keeps any in-progress
 * card live. Sorting is local over the loaded cards. An empty library shows the
 * inviting first-run state rather than a bare grid.
 */
export interface PaperGridProps {
  initial: PaperCardView[];
  userId: string;
}

export function PaperGrid({ initial, userId }: PaperGridProps) {
  const { papers } = usePapers(initial, userId);
  const [sort, setSort] = React.useState<PaperSort>("updated");

  const sorted = React.useMemo(
    () => sortPaperCards(papers, sort),
    [papers, sort],
  );

  if (papers.length === 0) {
    return <PapersEmptyState />;
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <PaperSortControl value={sort} onChange={setSort} />
      </div>

      {/* `.rise-stagger` delays each child by its inline `--i` — the cards
          assemble in order with no animation library involved. */}
      <div className="rise-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {sorted.map((paper, index) => (
          <PaperCard key={paper.paperId} paper={paper} index={index} />
        ))}
      </div>
    </div>
  );
}
