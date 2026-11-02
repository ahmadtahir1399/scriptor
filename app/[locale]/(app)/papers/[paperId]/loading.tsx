import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Paper-detail loading state — header, version-trend and version-row skeletons
 * matching the final layout so nothing shifts when the data arrives.
 */
export default function PaperDetailLoading() {
  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <CardContent className="p-5">
            <Skeleton className="h-10 w-72" />
          </CardContent>
        </Card>

        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="flex items-start justify-between gap-4 p-5">
              <div className="space-y-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-56" />
              </div>
              <Skeleton className="h-9 w-14 rounded-md" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
