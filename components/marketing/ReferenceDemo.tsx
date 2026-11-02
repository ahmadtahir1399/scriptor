"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * The reconciliation panel, with the product's own tabs.
 *
 * `Tabs` and `Badge` here are the REAL components — the same ones
 * `ReferenceTabs` and `HealthBadge` use in the analysis screen, with the same
 * three tab values (`sources` / `issues` / `uncited`) and the same badge
 * variants. Restyling a lookalike would have been less code to read and more
 * to drift; this cannot drift unless the product does.
 *
 * ── Why the tabs are controlled ───────────────────────────────────────────
 * They were uncontrolled first, on the assumption that Radix unmounts an
 * inactive `TabsContent` and that switching tabs would therefore remount the
 * list and restart its CSS `.rise-stagger` for free. It does not: all three
 * panels render, inactive ones merely `hidden`. So the rows animated once on
 * first reveal and never again, and every later tab switch swapped in a static
 * list.
 *
 * Holding the value in state and keying each `RowList` on it forces the
 * remount that assumption took for granted — the elements really are new, so
 * the CSS stagger runs again. Still no animation library, and still no
 * per-row JavaScript.
 *
 * `RevealOnView` holds the FIRST play with `.await-view` until the panel is on
 * screen; once released, later switches animate immediately, which is what a
 * deliberate interaction should do.
 */

export type RowVariant = "verified" | "warning" | "critical" | "outline";

export interface ReferenceRow {
  id: string;
  citation: string;
  badge: string;
  variant: RowVariant;
  note?: string;
}

export interface ReferenceCounter {
  label: string;
  value: string;
  tone: "ink" | "verified" | "critical" | "warning";
}

export interface ReferenceDemoProps {
  counters: readonly ReferenceCounter[];
  tabs: { sources: string; issues: string; uncited: string };
  rows: {
    sources: readonly ReferenceRow[];
    issues: readonly ReferenceRow[];
    uncited: readonly ReferenceRow[];
  };
}

const TONE: Record<ReferenceCounter["tone"], string> = {
  ink: "text-ink",
  verified: "text-verified",
  critical: "text-critical",
  warning: "text-warning",
};

function RowList({ rows }: Readonly<{ rows: readonly ReferenceRow[] }>) {
  return (
    <ul className="rise-stagger flex flex-col gap-2.5">
      {rows.map((row, index) => (
        <li
          key={row.id}
          style={{ "--i": index } as React.CSSProperties}
          className="border-border bg-bg/40 flex flex-col gap-2 rounded-md border px-3.5 py-3 sm:flex-row sm:items-start sm:gap-3"
        >
          <div className="min-w-0 flex-1">
            {/* The student's own bibliography text — `.prose-thesis`, because
                whose words these are is the point the type system makes. */}
            <p className="prose-thesis text-ink text-[12.5px] leading-relaxed">
              {row.citation}
            </p>
            {row.note ? (
              <p className="text-muted mt-1.5 text-[11.5px] leading-relaxed">
                {row.note}
              </p>
            ) : null}
          </div>
          {/* Always a written label beside the colour. */}
          <Badge variant={row.variant} className="shrink-0 self-start">
            {row.badge}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

export function ReferenceDemo({ counters, tabs, rows }: ReferenceDemoProps) {
  const [tab, setTab] = React.useState("issues");

  return (
    <div className="bg-surface border-border shadow-card overflow-hidden rounded-lg border">
      {/* Summary strip — same shape as the product's: a definition list, two
          columns on phones, four from sm. */}
      <dl className="border-border bg-primary-soft/25 grid grid-cols-2 gap-4 border-b px-4 py-4 sm:grid-cols-4 sm:px-5">
        {counters.map((counter) => (
          <div key={counter.label}>
            <dt className="text-muted text-[10px] font-medium tracking-wide uppercase">
              {counter.label}
            </dt>
            <dd
              className={cn(
                "display mt-1 text-[24px] leading-none tabular-nums",
                TONE[counter.tone],
              )}
            >
              {counter.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="p-4 sm:p-5">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="sources">{tabs.sources}</TabsTrigger>
            {/* `issues` opens first, not `sources`. The orphans are the
                product; landing on a tidy list of verified entries would bury
                the only thing this screen exists to show. */}
            <TabsTrigger value="issues">{tabs.issues}</TabsTrigger>
            <TabsTrigger value="uncited">{tabs.uncited}</TabsTrigger>
          </TabsList>

          {/* `key={tab}` is what makes the stagger replay — see the note at the
              top. Without it these lists persist across switches and only ever
              animate once. */}
          <TabsContent value="sources" className="mt-4">
            <RowList key={tab} rows={rows.sources} />
          </TabsContent>
          <TabsContent value="issues" className="mt-4">
            <RowList key={tab} rows={rows.issues} />
          </TabsContent>
          <TabsContent value="uncited" className="mt-4">
            <RowList key={tab} rows={rows.uncited} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
