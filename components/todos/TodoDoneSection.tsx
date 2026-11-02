"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { TodoItem as TodoItemRow } from "@/lib/db/queries/todos";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { TodoItem } from "@/components/todos/TodoItem";
import { IconCheck } from "@/components/icons";

/**
 * The satisfying pile of finished work. Completed tasks collapse here, struck
 * through, each with an undo (un-check). Collapsed by default — the point of the
 * plan is what's left, not what's done, but the done pile is proof of momentum.
 */
export interface TodoDoneSectionProps {
  items: readonly TodoItemRow[];
  analysisId: string;
  onToggle: (itemId: string, done: boolean) => void;
  /**
   * Opens the pile on first render. Set when the whole plan is finished:
   * collapsing the only remaining content would leave the page looking empty
   * at the exact moment it should look earned.
   */
  defaultOpen?: boolean;
}

export function TodoDoneSection({
  items,
  analysisId,
  onToggle,
  defaultOpen = false,
}: TodoDoneSectionProps) {
  const t = useTranslations("todos");
  if (items.length === 0) return null;

  return (
    /*
     * Sage, and only here. Everywhere else in the plan the checkbox carries
     * the state; this section IS the completed state, so it takes the
     * `verified` family — soft tint for the ground, solid sage for the tick
     * and the count — always beside the word "Completed", never colour alone.
     */
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultOpen ? "done" : undefined}
      className="border-verified/25 bg-verified-soft/40 rounded-lg border px-4"
    >
      <AccordionItem value="done" className="border-b-0">
        <AccordionTrigger>
          <span className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="bg-verified flex size-5 shrink-0 items-center justify-center rounded-full"
            >
              <IconCheck
                className="text-verified-foreground size-3"
                strokeWidth={3}
              />
            </span>
            <span className="text-body text-verified font-medium">
              {t("done.title", { count: items.length })}
            </span>
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <div className="flex flex-col gap-2 pb-1">
            {items.map((item) => (
              <TodoItem
                key={item.id}
                item={item}
                analysisId={analysisId}
                onToggle={(done) => onToggle(item.id, done)}
              />
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
