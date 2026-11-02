"use client";

import * as React from "react";
import { AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";

import type {
  TodoGroupWithItems,
  TodoItem as TodoItemRow,
} from "@/lib/db/queries/todos";
import { decodeItemDescription, formatMinutes } from "@/lib/todos/schedule";
import { MANUAL_GROUP_MARKER } from "@/lib/todos/config";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { TodoItem } from "@/components/todos/TodoItem";

/**
 * A themed group of tasks — an open-by-default accordion showing its active
 * tasks, its rolled-up effort, and (for the top group) a "Start here" badge.
 * Done tasks are hoisted out to the Done section, so this shows only what's left.
 */
export interface TodoGroupProps {
  group: TodoGroupWithItems;
  analysisId: string;
  isFirst: boolean;
  onToggle: (itemId: string, done: boolean) => void;
  onReorder: (groupId: string, itemIds: string[]) => void;
  onEdit: (item: TodoItemRow) => void;
  onDelete: (item: TodoItemRow) => void;
}

export function TodoGroup({
  group,
  analysisId,
  isFirst,
  onToggle,
  onReorder,
  onEdit,
  onDelete,
}: TodoGroupProps) {
  const t = useTranslations("todos");

  const active = group.items.filter((item) => !item.is_done);
  if (active.length === 0) return null;

  const isManualGroup = group.description.startsWith(MANUAL_GROUP_MARKER);
  const title = isManualGroup ? t("manualGroup") : group.title;
  const totalMinutes = active.reduce(
    (sum, item) => sum + (decodeItemDescription(item.description).minutes ?? 0),
    0,
  );

  const move = (index: number, direction: -1 | 1): void => {
    const target = index + direction;
    if (target < 0 || target >= active.length) return;
    const ids = active.map((item) => item.id);
    [ids[index], ids[target]] = [ids[target] as string, ids[index] as string];
    onReorder(group.id, ids);
  };

  return (
    <Accordion type="single" collapsible defaultValue={group.id}>
      <AccordionItem value={group.id}>
        <AccordionTrigger>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <span className="text-section-title text-ink">{title}</span>
            {isFirst ? (
              <Badge variant="secondary">{t("startHere")}</Badge>
            ) : null}
            <span className="text-meta text-muted">
              {t("group.summary", {
                count: active.length,
                effort: formatMinutes(totalMinutes),
              })}
            </span>
          </div>
        </AccordionTrigger>

        <AccordionContent>
          <div className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {active.map((item, index) => {
                const isManualItem =
                  decodeItemDescription(item.description).provenance ===
                  "manual";
                return (
                  <TodoItem
                    key={item.id}
                    item={item}
                    analysisId={analysisId}
                    onToggle={(done) => onToggle(item.id, done)}
                    onMoveUp={index > 0 ? () => move(index, -1) : undefined}
                    onMoveDown={
                      index < active.length - 1
                        ? () => move(index, 1)
                        : undefined
                    }
                    onEdit={isManualItem ? () => onEdit(item) : undefined}
                    onDelete={isManualItem ? () => onDelete(item) : undefined}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
