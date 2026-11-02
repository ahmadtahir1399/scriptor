import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

/**
 * To-dos loading state — the summary bar and a couple of grouped task-row
 * skeletons matching the final layout, so the plan drops in without reflow.
 */
export default function TodosLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-8 w-28" />
          </div>
          <Skeleton className="h-1.5 w-full" />
        </CardContent>
      </Card>

      {Array.from({ length: 2 }).map((_, group) => (
        <div key={group} className="space-y-2">
          <Skeleton className="h-6 w-48" />
          {Array.from({ length: 3 }).map((_, item) => (
            <Card key={item}>
              <CardContent className="flex items-start gap-3 p-4">
                <Skeleton className="size-4 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-5 w-10" />
              </CardContent>
            </Card>
          ))}
        </div>
      ))}
    </div>
  );
}
