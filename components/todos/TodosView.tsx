"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { IconAi, IconCheck, IconPlus } from "@/components/icons";

import type { TodoData } from "@/lib/todos/actions";
import { deleteTodo, reorderTodo } from "@/lib/todos/actions";
import type { TodoItem as TodoItemRow } from "@/lib/db/queries/todos";
import { useTodos } from "@/hooks/useTodos";
import {
  computeFeasibility,
  decodeItemDescription,
} from "@/lib/todos/schedule";
import { SectionCard } from "@/components/shared/SectionCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TodoSummaryBar } from "@/components/todos/TodoSummaryBar";
import { TodoGroup } from "@/components/todos/TodoGroup";
import { TodoDoneSection } from "@/components/todos/TodoDoneSection";
import { TodoAddDialog } from "@/components/todos/TodoAddDialog";
import { RegeneratePlanButton } from "@/components/todos/RegeneratePlanButton";
import { TodosEmptyState } from "@/components/todos/TodosEmptyState";

/**
 * The action-plan client boundary. Owns the live subscription and the optimistic
 * check-off, and renders the explicit states: generating, not-requested, error,
 * a strong-draft empty, all-done, and the working plan.
 */
export interface TodosViewProps {
  analysisId: string;
  userId: string;
  initial: TodoData;
}

export function TodosView({ analysisId, userId, initial }: TodosViewProps) {
  const t = useTranslations("todos");
  const queryClient = useQueryClient();
  const { data, toggle } = useTodos(analysisId, userId, initial);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editItem, setEditItem] = React.useState<TodoItemRow | null>(null);

  const invalidate = React.useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["todos", analysisId] }),
    [queryClient, analysisId],
  );

  if (data.status === "GENERATING") {
    return (
      <SectionCard>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <IconAi
              className="text-primary size-4 animate-pulse"
              aria-hidden="true"
            />
            <p className="text-body text-ink">{t("states.generatingTitle")}</p>
          </div>
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </SectionCard>
    );
  }

  if (data.status === "ERROR")
    return <TodosEmptyState variant="error" analysisId={analysisId} />;
  if (data.status === "NONE")
    return <TodosEmptyState variant="none" analysisId={analysisId} />;

  const allItems = data.plan.flatMap((group) => group.items);
  if (allItems.length === 0)
    return <TodosEmptyState variant="empty" analysisId={analysisId} />;

  const doneItems = allItems.filter((item) => item.is_done);
  const activeCount = allItems.length - doneItems.length;
  /*
   * Finishing the plan used to REPLACE this page with an empty state, which
   * threw away the one thing the student had earned: the record of the work.
   * Ticking the last box made every completed task disappear, and un-ticking
   * one was the only way to see the list again.
   *
   * "All done" is a state of the plan, not an absence of one. So the plan
   * stays rendered, `allDone` drives a green banner at the top, and the
   * completed section opens itself instead of staying collapsed.
   */
  const allDone = activeCount === 0;

  const remainingMinutes = allItems
    .filter((item) => !item.is_done)
    .reduce(
      (sum, item) =>
        sum + (decodeItemDescription(item.description).minutes ?? 0),
      0,
    );
  const feasibility = computeFeasibility(remainingMinutes, data.deadline);

  const onReorder = (groupId: string, itemIds: string[]): void => {
    void (async () => {
      await reorderTodo({ groupId, itemIds });
      await invalidate();
    })();
  };

  const onDelete = (item: TodoItemRow): void => {
    void (async () => {
      await deleteTodo({ itemId: item.id });
      await invalidate();
    })();
  };

  const openAdd = (): void => {
    setEditItem(null);
    setDialogOpen(true);
  };

  const openEdit = (item: TodoItemRow): void => {
    setEditItem(item);
    setDialogOpen(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <TodoSummaryBar
        analysisId={analysisId}
        done={doneItems.length}
        total={allItems.length}
        remainingMinutes={remainingMinutes}
        deadline={data.deadline}
        feasibility={feasibility}
      />

      {/*
       * The finished-plan banner. Sage on its own soft tint — this is the
       * palette's "verified / passed / resolved" pair, which is exactly what
       * a completed plan is, and it always carries its label so the colour
       * reinforces the words rather than replacing them.
       */}
      {allDone ? (
        <div className="bg-verified-soft border-verified/30 flex items-start gap-3 rounded-lg border p-4">
          <span
            aria-hidden="true"
            className="bg-verified flex size-8 shrink-0 items-center justify-center rounded-full"
          >
            <IconCheck
              className="text-verified-foreground size-4"
              strokeWidth={3}
            />
          </span>
          <div className="min-w-0">
            <p className="display text-verified text-[15px] leading-snug">
              {t("states.allDone.title")}
            </p>
            <p className="text-meta text-muted mt-1">
              {t("done.allComplete", { count: allItems.length })}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={openAdd}>
          <IconPlus aria-hidden="true" />
          {t("addTask")}
        </Button>
        <RegeneratePlanButton analysisId={analysisId} />
      </div>

      <div className="flex flex-col gap-3">
        {data.plan.map((group, index) => (
          <TodoGroup
            key={group.id}
            group={group}
            analysisId={analysisId}
            isFirst={index === 0}
            onToggle={toggle}
            onReorder={onReorder}
            onEdit={openEdit}
            onDelete={onDelete}
          />
        ))}
      </div>

      <TodoDoneSection
        items={doneItems}
        analysisId={analysisId}
        onToggle={toggle}
        defaultOpen={allDone}
      />

      <TodoAddDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditItem(null);
        }}
        analysisId={analysisId}
        item={editItem}
      />
    </div>
  );
}
