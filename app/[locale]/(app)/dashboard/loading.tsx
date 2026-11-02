import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Dashboard loading state.
 *
 * The dashboard was the one authenticated route with no `loading.tsx` of its
 * own, so it fell through to the generic app skeleton — a title, a subtitle
 * and a four-row list, which is not the shape of this page at all. Landing on
 * it meant a stack of list rows that then vanished and were replaced by a
 * bento, i.e. the exact reflow a skeleton exists to prevent.
 *
 * This mirrors `DashboardContent`'s grid cell for cell, including the spans,
 * so the real page drops into the same boxes. The heights are the measured
 * ones from the rendered layout, not guesses.
 */
function Tile({
  className,
  children,
}: Readonly<{ className?: string; children?: React.ReactNode }>) {
  return (
    <Card className={className}>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}

export default function DashboardLoading() {
  return (
    <div>
      {/* PageHeader: eyebrow pill, then the display title. */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <Skeleton className="h-7 w-40 rounded-full" />
          <Skeleton className="mt-3 h-8 w-64" />
        </div>
        <Skeleton className="h-9 w-32 shrink-0" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
        {/* Next action — the pine panel. */}
        <div className="sm:col-span-2 lg:row-span-2">
          <Card className="pine-panel h-full min-h-[236px] border-transparent">
            <CardContent className="flex h-full flex-col justify-between p-6 lg:p-7">
              <div>
                <Skeleton className="bg-panel-foreground/12 h-3 w-28" />
                <Skeleton className="bg-panel-foreground/12 mt-4 h-7 w-3/4" />
                <Skeleton className="bg-panel-foreground/12 mt-3 h-4 w-2/3" />
              </div>
              <Skeleton className="bg-panel-foreground/12 mt-6 h-10 w-40" />
            </CardContent>
          </Card>
        </div>

        {/* Standing — the gauge. */}
        <div className="sm:col-span-2 lg:col-span-1 lg:row-span-2">
          <Card className="from-surface to-primary-soft/35 h-full bg-linear-to-br">
            <CardContent className="flex h-full flex-col items-center p-6">
              <Skeleton className="h-6 w-32 self-start rounded-full" />
              <Skeleton className="mt-6 size-[156px] rounded-full" />
              <Skeleton className="mt-4 h-4 w-24" />
              <Skeleton className="mt-2 h-3 w-40" />
            </CardContent>
          </Card>
        </div>

        {/* Four stat tiles — two beside the hero, two on the last row. */}
        {[0, 1].map((i) => (
          <Tile key={`stat-top-${i}`}>
            <Skeleton className="size-9 rounded-md" />
            <Skeleton className="mt-4 h-8 w-16" />
            <Skeleton className="mt-2 h-3 w-24" />
          </Tile>
        ))}

        {/* Trend chart. */}
        <Card className="h-full sm:col-span-2">
          <CardContent className="p-5">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="mt-2 h-3 w-56" />
            <Skeleton className="mt-5 h-[132px] w-full" />
          </CardContent>
        </Card>

        {/* Recent activity — five rows. */}
        <div className="sm:col-span-2 lg:row-span-2">
          <Card className="h-full">
            <CardContent className="p-5">
              <Skeleton className="h-4 w-36" />
              <div className="mt-4 flex flex-col gap-4">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <Skeleton className="h-3.5 w-2/3" />
                      <Skeleton className="mt-2 h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {[2, 3].map((i) => (
          <Tile key={`stat-bottom-${i}`}>
            <Skeleton className="size-9 rounded-md" />
            <Skeleton className="mt-4 h-8 w-16" />
            <Skeleton className="mt-2 h-3 w-24" />
          </Tile>
        ))}
      </div>
    </div>
  );
}
