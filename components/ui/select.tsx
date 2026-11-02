"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { IconCheck, IconChevronDown, IconChevronUp } from "@/components/icons";

import { cn } from "@/lib/utils";

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export interface SelectTriggerProps
  extends React.ComponentProps<typeof SelectPrimitive.Trigger> {
  /** `sm` matches `Button size="sm"` — for selects used as toolbar controls
   *  rather than form fields. */
  size?: "default" | "sm";
}

export function SelectTrigger({
  className,
  children,
  size = "default",
  ...props
}: SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        /* Same well-to-surface treatment as `Input` — a select IS a field, and
           the two sitting in one form must not look like different species. */
        "text-body text-ink flex w-full items-center justify-between gap-2 rounded-full border border-transparent",
        size === "sm" ? "text-meta h-9 px-3.5" : "h-11 px-4",
        "bg-primary-soft/45",
        "transition-[background-color,border-color,box-shadow] duration-200 ease-out-quiet",
        "hover:bg-primary-soft/65",
        "data-[placeholder]:text-muted-soft",
        "focus:bg-surface focus:border-green-400 focus:ring-primary/12 focus:ring-4 focus:outline-none",
        "data-[state=open]:bg-surface data-[state=open]:border-green-400",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&>span]:truncate",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        {/* Rotates on open. The chevron is the only thing on a closed select
            that can say "this expands", so it should visibly answer. */}
        {/* `in-data-[state=open]` reads the state off the TRIGGER above it —
            the icon is a descendant, and the trigger is what Radix marks. */}
        <IconChevronDown className="text-muted size-4 shrink-0 transition-transform duration-200 ease-out-quiet in-data-[state=open]:rotate-180" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        className={cn(
          "bg-surface text-ink border-border/60 relative z-50 max-h-96 min-w-32 overflow-hidden rounded-lg border p-1.5 shadow-popover",
          "origin-(--radix-select-content-transform-origin)",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-150 ease-out-quiet",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center">
          <IconChevronUp className="text-muted size-4" />
        </SelectPrimitive.ScrollUpButton>

        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>

        <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center">
          <IconChevronDown className="text-muted size-4" />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn("text-micro text-muted px-2 py-1.5 uppercase", className)}
      {...props}
    />
  );
}

export interface SelectItemProps
  extends React.ComponentProps<typeof SelectPrimitive.Item> {
  /**
   * A second line of guidance under the option's name.
   *
   * It sits OUTSIDE `ItemText` deliberately. Radix clones `ItemText` into the
   * closed trigger, so anything nested there is what the field shows once the
   * option is picked — a two-line block inside an h-11 capsule, truncated. The
   * description belongs to the open list only.
   */
  description?: React.ReactNode;
}

export function SelectItem({
  className,
  children,
  description,
  ...props
}: SelectItemProps) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        /* `min-h-9` and NOT `h-9`. A row is allowed to carry a second line —
           the document-type picker puts the character ceiling under the name —
           and a fixed height collapses the two lines onto each other. The
           padding is what sets the rhythm; the min-height only guarantees that
           a one-line row still meets the touch target. */
        "text-body relative flex min-h-9 w-full cursor-default items-center gap-2 rounded-sm py-2 pr-8 pl-2.5 outline-none select-none",
        "transition-colors duration-150",
        "focus:bg-primary-soft/70 focus:text-primary",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="absolute top-1/2 right-2 flex size-4 -translate-y-1/2 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <IconCheck className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <span className="flex min-w-0 flex-col items-start gap-0.5">
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
        {description ? (
          <span className="text-meta text-muted">{description}</span>
        ) : null}
      </span>
    </SelectPrimitive.Item>
  );
}

export function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}
