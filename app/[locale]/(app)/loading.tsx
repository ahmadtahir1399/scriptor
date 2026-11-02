import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonList } from "@/components/shared/LoadingSkeleton";

/**
 * Default loading state for authenticated routes.
 *
 * Mirrors the standard page shape — title, description, then a list — so the
 * layout does not shift when the real content arrives.
 */
export default function AppLoading() {
  return (
    <div>
      <div className="mb-8">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="mt-2 h-3.5 w-80" />
      </div>
      <SkeletonList rows={4} />
    </div>
  );
}
