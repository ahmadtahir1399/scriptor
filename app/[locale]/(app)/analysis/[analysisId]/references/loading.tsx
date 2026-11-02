import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

/**
 * References loading state.
 *
 * Mirrors the final layout — the summary strip, then the tab bar, then a short
 * list of reference rows — so the transition to real content does not shift the
 * page. Matches the shape `ReferenceTabs` renders once data arrives.
 */
export default function ReferencesLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="p-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-10" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-24" />
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="flex items-center gap-3 p-5">
              <Skeleton className="size-2.5 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-5 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
