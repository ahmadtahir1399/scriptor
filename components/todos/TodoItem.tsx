"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { IconArrowRight, IconChevronDown, IconChevronUp, IconClose, IconPencil } from "@/components/icons";

import { cn } from "@/lib/utils";
import type { TodoItem as TodoItemRow } from "@/lib/db/queries/todos";
import { decodeItemDescription, formatMinutes } from "@/lib/todos/schedule";
import {
  documentFindingHref,
  documentPageHref,
} from "@/lib/analysis/presentation";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";

/**
 * One revision task: a checkbox, the imperative title, a one-line why, its
 * effort estimate, and a deep-link to the source finding (viewer) or the report.
 * Checking it off is optimistic; the row fades out of the active list into the
 * Done section, respecting reduced-motion.
 */
export interface TodoItemProps {
  item: TodoItemRow;
  analysisId: string;
  onToggle: (done: boolean) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function TodoItem({
  item,
  analysisId,
  onToggle,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
}: TodoItemProps) {
  const t = useTranslations("todos");
  const reduce = useReducedMotion();
  const decoded = decodeItemDescription(item.description);

  const href = item.finding_id
    ? documentFindingHref(analysisId, item.finding_id)
    : item.page_number !== null
      ? documentPageHref(analysisId, item.page_number)
      : null;

  return (
    <motion.div
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, x: 8 }}
      className="bg-surface border-border flex items-start gap-3 rounded-lg border p-4"
    >
      <Checkbox
        className="mt-0.5"
        checked={item.is_done}
        onCheckedChange={(value) => onToggle(value === true)}
        aria-label={item.title}
      />

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-body",
            item.is_done ? "text-muted line-through" : "text-ink",
          )}
        >
          {item.title}
        </p>
        {decoded.text ? (
          <p className="text-meta text-muted mt-0.5">{decoded.text}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {decoded.minutes !== null ? (
          <Badge variant="outline">{formatMinutes(decoded.minutes)}</Badge>
        ) : null}

        {href ? (
          <ButtonLink href={href} variant="ghost" size="sm">
            {t("item.view")}
            <IconArrowRight aria-hidden="true" />
          </ButtonLink>
        ) : null}

        {onMoveUp || onMoveDown ? (
          <div className="flex flex-col">
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              aria-label={t("item.moveUp")}
              disabled={!onMoveUp}
              onClick={onMoveUp}
            >
              <IconChevronUp className="size-3.5" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              aria-label={t("item.moveDown")}
              disabled={!onMoveDown}
              onClick={onMoveDown}
            >
              <IconChevronDown className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        ) : null}

        {onEdit ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("item.edit")}
            onClick={onEdit}
          >
            <IconPencil aria-hidden="true" />
          </Button>
        ) : null}
        {onDelete ? (
          <Button
            variant="ghost"
            size="icon"
            className="text-critical"
            aria-label={t("item.delete")}
            onClick={onDelete}
          >
            <IconClose aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </motion.div>
  );
}
