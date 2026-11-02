"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";

import { useReducedMotion } from "@/lib/hooks/useReducedMotion";

/**
 * The calm progress signal.
 *
 * A thin bar reading "6 of 9 checks complete" — never a percentage that jumps,
 * never an alarming full-page spinner. It fades out once the analysis is
 * terminal. The width tracks completed-vs-total so it only ever moves forward.
 */
export interface AnalysisProgressBarProps {
  completed: number;
  total: number;
  visible: boolean;
}

export function AnalysisProgressBar({
  completed,
  total,
  visible,
}: AnalysisProgressBarProps) {
  const t = useTranslations("analysis.progress");
  const reduced = useReducedMotion();

  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: reduced ? 0 : 0.2 }}
          className="mb-6"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-meta text-muted">
              {t("count", { completed, total })}
            </p>
          </div>
          <div className="bg-border/50 h-1 w-full overflow-hidden rounded-full">
            <motion.div
              className="bg-primary h-full rounded-full"
              initial={false}
              animate={{ width: `${percent}%` }}
              transition={{ duration: reduced ? 0 : 0.4, ease: "easeOut" }}
            />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
