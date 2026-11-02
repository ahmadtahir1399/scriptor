import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Practice-session loading state — the question counter/progress and the
 * answer surface, matching the final layout.
 */
export default function PracticeLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-1.5 flex-1" />
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-32 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-20" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
