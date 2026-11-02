import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Viewer loading skeleton — toolbar, one page-shaped canvas placeholder, and
 * sidebar rows, laid out like the real viewer so nothing reflows when the PDF
 * and findings arrive.
 */
export default function DocumentLoading() {
  return (
    <div className="flex h-[calc(100dvh-220px)] min-h-[480px] overflow-hidden">
      {/* Thumbnail rail */}
      <div className="border-border hidden w-[120px] shrink-0 flex-col gap-2 border-r p-2 sm:flex">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-sm" />
        ))}
      </div>

      {/* Document column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-border flex items-center gap-2 border-b px-3 py-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-7 w-40" />
          <div className="flex-1" />
          <Skeleton className="h-7 w-24" />
        </div>
        <div className="bg-bg flex flex-1 justify-center p-6">
          <Skeleton className="h-full w-full max-w-2xl rounded-sm" />
        </div>
      </div>

      {/* Sidebar */}
      <div className="border-border hidden w-[340px] shrink-0 flex-col gap-2 border-l p-3 lg:flex">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}
