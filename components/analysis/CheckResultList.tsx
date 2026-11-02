"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { orderByPriority } from "@/lib/analysis/presentation";
import type { CheckResultWithVersion } from "@/lib/domain/analysis";
import { Accordion } from "@/components/ui/accordion";
import { CheckResultCard } from "@/components/analysis/CheckResultCard";

/**
 * The ordered list of check cards.
 *
 * Priority order — errors and the most-needs-work first, never check id order,
 * so the student meets what matters most at the top. Cards enter with a small
 * Framer stagger as the stream delivers them. Errored cards and the highest-
 * priority card open by default so the retry and the headline result are
 * visible without a click.
 */
export interface CheckResultListProps {
  results: readonly CheckResultWithVersion[];
  analysisId: string;
}

export function CheckResultList({ results, analysisId }: CheckResultListProps) {
  const reduced = useReducedMotion();
  const ordered = orderByPriority(results);

  // Open errored cards (retry visible) plus the top-priority done card.
  const defaultOpen = React.useMemo(() => {
    const errored = ordered
      .filter((r) => r.status === "ERROR")
      .map((r) => r.check_id);
    const firstDone = ordered.find((r) => r.status === "DONE");
    return firstDone ? [...errored, firstDone.check_id] : errored;
    // Compute once from the initial order; the user controls it thereafter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Accordion
      type="multiple"
      defaultValue={defaultOpen}
      className="flex flex-col gap-2"
    >
      {ordered.map((result, index) => (
        <motion.div
          key={result.check_id}
          layout={!reduced}
          initial={reduced ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduced ? 0 : 0.2,
            delay: reduced ? 0 : Math.min(index * 0.03, 0.3),
          }}
        >
          <CheckResultCard result={result} analysisId={analysisId} />
        </motion.div>
      ))}
    </Accordion>
  );
}
