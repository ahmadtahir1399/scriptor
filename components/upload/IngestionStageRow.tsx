"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { useFadeRise } from "@/lib/hooks/useReducedMotion";
import type { StageProgress } from "@/hooks/useIngestionProgress";
import { Progress } from "@/components/ui/progress";
import { StatusPill } from "@/components/shared/StatusPill";

export interface IngestionStageRowProps {
  stage: StageProgress;
  index: number;
}

/**
 * One ingestion stage.
 *
 * A running stage shows an INDETERMINATE progress bar rather than a
 * percentage: we genuinely do not know how far through parsing we are, and a
 * fabricated number that stalls at 70% is worse than an honest unknown.
 */
export function IngestionStageRow({ stage, index }: IngestionStageRowProps) {
  const t = useTranslations("upload.stages");
  const fadeRise = useFadeRise(index * 0.02);

  const isRunning = stage.status === "GENERATING";
  const isDone = stage.status === "DONE";

  const duration = React.useMemo(() => {
    if (!isDone || !stage.startedAt || !stage.completedAt) return null;
    const ms =
      new Date(stage.completedAt).getTime() -
      new Date(stage.startedAt).getTime();
    if (ms < 0) return null;
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  }, [isDone, stage.startedAt, stage.completedAt]);

  return (
    <motion.li
      initial={fadeRise.initial}
      animate={fadeRise.animate}
      transition={fadeRise.transition}
      className="border-border border-b py-4 last:border-b-0"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p
            className={cn(
              "text-body font-medium",
              isRunning ? "text-ink" : isDone ? "text-ink" : "text-muted",
            )}
          >
            {t(`${stage.kind}.label`)}
          </p>
          <p className="text-meta text-muted mt-0.5">
            {t(`${stage.kind}.description`)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {duration ? (
            <span className="text-meta text-muted">{duration}</span>
          ) : null}
          <StatusPill status={stage.status} size="sm" />
        </div>
      </div>

      {isRunning ? <Progress value={null} className="mt-3" /> : null}

      {stage.status === "ERROR" && stage.error ? (
        <p className="text-meta text-critical mt-2">{stage.error}</p>
      ) : null}
    </motion.li>
  );
}
