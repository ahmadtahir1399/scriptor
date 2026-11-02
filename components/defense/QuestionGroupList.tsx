"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { DefenseGroupWithQuestions } from "@/lib/db/queries/defense";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { DefenseQuestionCard } from "@/components/defense/DefenseQuestionCard";

/**
 * The predicted questions, grouped by theme in an open-by-default accordion,
 * ordered by how central/likely each theme is to come up.
 */
export interface QuestionGroupListProps {
  groups: readonly DefenseGroupWithQuestions[];
}

export function QuestionGroupList({ groups }: QuestionGroupListProps) {
  const t = useTranslations("defense");
  const openValues = React.useMemo(
    () => groups.map((group) => group.id),
    [groups],
  );

  return (
    <Accordion
      type="multiple"
      defaultValue={openValues}
      className="flex flex-col gap-3"
    >
      {groups.map((group) => (
        <AccordionItem key={group.id} value={group.id}>
          <AccordionTrigger>
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-2">
              <span className="text-section-title text-ink">{group.title}</span>
              <span className="text-meta text-muted">
                {t("group.count", { count: group.questions.length })}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-2">
              {group.questions.map((question) => (
                <DefenseQuestionCard key={question.id} question={question} />
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
