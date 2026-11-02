"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { IconCheck, IconMinus } from "@/components/icons";

import type { AnswerFeedbackData } from "@/lib/validations/defense";
import { SectionCard } from "@/components/shared/SectionCard";
import { Badge } from "@/components/ui/badge";

/**
 * Structured, constructive feedback on a practice answer: what was strong, what
 * was missing, one thing to do next, and a calm verdict. Enters with a gentle
 * motion, respecting reduced-motion.
 */
export interface AnswerFeedbackProps {
  feedback: AnswerFeedbackData;
}

const VERDICT_VARIANT = {
  strong: "verified",
  adequate: "secondary",
  needs_work: "warning",
} as const;

export function AnswerFeedback({ feedback }: AnswerFeedbackProps) {
  const t = useTranslations("defense.feedback");
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <SectionCard>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-body text-ink font-medium">{t("title")}</p>
            <Badge variant={VERDICT_VARIANT[feedback.verdict]}>
              {t(`verdict.${feedback.verdict}`)}
            </Badge>
          </div>

          {feedback.strengths.length > 0 ? (
            <div>
              <p className="text-micro text-verified uppercase">
                {t("strengths")}
              </p>
              <ul className="mt-1 space-y-1">
                {feedback.strengths.map((item, index) => (
                  <li
                    key={index}
                    className="text-meta text-ink flex items-start gap-2"
                  >
                    <IconCheck
                      className="text-verified mt-0.5 size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {feedback.gaps.length > 0 ? (
            <div>
              <p className="text-micro text-warning uppercase">{t("gaps")}</p>
              <ul className="mt-1 space-y-1">
                {feedback.gaps.map((item, index) => (
                  <li
                    key={index}
                    className="text-meta text-ink flex items-start gap-2"
                  >
                    <IconMinus
                      className="text-warning mt-0.5 size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {feedback.suggestion ? (
            <div className="bg-primary-soft/40 rounded-md p-3">
              <p className="text-micro text-muted uppercase">
                {t("suggestion")}
              </p>
              <p className="text-meta text-ink mt-1">{feedback.suggestion}</p>
            </div>
          ) : null}
        </div>
      </SectionCard>
    </motion.div>
  );
}
