"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { IconClock } from "@/components/icons";

import { setDeadline } from "@/lib/todos/actions";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * The submission-deadline chip. A real calendar in a popover, writing through `setDeadline`. Setting it anchors the whole plan
 * — the deadline is stored on the tasks' due dates, which also drives the
 * later "due soon" notifications.
 */
export interface DeadlinePickerProps {
  analysisId: string;
  deadline: string | null;
}

export function DeadlinePicker({ analysisId, deadline }: DeadlinePickerProps) {
  const t = useTranslations("todos.deadline");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);

  const onSet = (iso: string | null): void => {
    startTransition(async () => {
      await setDeadline({ analysisId, deadline: iso });
      await queryClient.invalidateQueries({ queryKey: ["todos", analysisId] });
      setOpen(false);
    });
  };

  const label = deadline
    ? t("set", {
        date: format.dateTime(new Date(deadline), {
          day: "numeric",
          month: "short",
        }),
      })
    : t("add");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={isPending}>
          <IconClock aria-hidden="true" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        {/*
         * A real calendar, not `<input type="date">`.
         *
         * The native control renders whatever the OS decides — a different
         * widget on every platform, in the browser's locale rather than the
         * app's, and completely outside this design system. A submission
         * deadline is also a date you want to SEE in context ("is that a
         * Sunday? how far is it?"), which a text field cannot answer.
         *
         * Noon local is preserved from the old input: storing midnight makes a
         * deadline land on the previous day for anyone west of UTC once it is
         * read back as a date.
         */}
        <Calendar
          mode="single"
          autoFocus
          defaultMonth={deadline ? new Date(deadline) : undefined}
          selected={deadline ? new Date(deadline) : undefined}
          disabled={{ before: new Date() }}
          onSelect={(date) =>
            onSet(
              date
                ? new Date(
                    date.getFullYear(),
                    date.getMonth(),
                    date.getDate(),
                    12,
                  ).toISOString()
                : null,
            )
          }
        />
        {deadline ? (
          <Button
            variant="ghost"
            size="sm"
            className="border-border w-full rounded-none border-t"
            onClick={() => onSet(null)}
            disabled={isPending}
          >
            {t("clear")}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
