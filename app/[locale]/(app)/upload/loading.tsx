import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard } from "@/components/shared/LoadingSkeleton";

/** Mirrors the upload page's shape so nothing jumps when content arrives. */
export default function UploadLoading() {
  return (
    <div>
      <div className="mb-8">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-2 h-3.5 w-72" />
      </div>

      <div className="flex flex-col gap-6">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
