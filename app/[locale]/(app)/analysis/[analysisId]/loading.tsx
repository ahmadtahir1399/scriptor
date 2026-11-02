import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

/**
 * Report loading skeleton.
 *
 * Mirrors the final layout — score hero, then the check cards — so there is no
 * reflow when the real data arrives. Only used for the brief server-fetch of
 * the initial snapshot; once any data exists, the live report renders instead
 * and this never shows again.
 */
export default function AnalysisLoading() {
  return (
    <div>
      {/* Score hero */}
      <Card className="mb-6 p-5">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-center">
          <div className="flex shrink-0 flex-col items-center gap-3 sm:items-start">
            <Skeleton className="size-[140px] rounded-full" />
            <Skeleton className="h-3.5 w-48" />
          </div>
          <div className="flex-1 space-y-3 sm:border-l sm:pl-8">
            {[0, 1, 2, 3].map((i) => (
              <div key={i}>
                <Skeleton className="mb-1 h-3 w-24" />
                <Skeleton className="h-1.5 w-full" />
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Check cards */}
      <div className="flex flex-col gap-2">
        {Array.from({ length: 9 }, (_, i) => (
          <Card key={i} className="flex items-center gap-3 px-5 py-4">
            <Skeleton className="h-4 w-40" />
            <div className="ml-auto flex items-center gap-2">
              <Skeleton className="h-5 w-8 rounded-sm" />
              <Skeleton className="h-5 w-16 rounded-sm" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
