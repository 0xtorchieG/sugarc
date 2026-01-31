import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, PieChart } from "lucide-react";
import type { LpPoolOverview } from "./types";
import { EmptyStateChart } from "./empty-state";
import { cn } from "@/lib/utils";

interface PoolOverviewProps {
  data: LpPoolOverview | null;
  className?: string;
}

export function PoolOverview({ data, className }: PoolOverviewProps) {
  if (!data || (!data.currentApr?.trim() && !data.utilization?.trim())) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Pool Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyStateChart
            title="No pool data yet"
            description="APR and utilization will appear here."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Pool Overview</CardTitle>
      </CardHeader>
      <CardContent className={cn("grid gap-6 sm:grid-cols-2")}>
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Current APR
            </p>
            <p className="text-xl font-semibold tabular-nums">
              {data.currentApr ?? "—"}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <PieChart className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Utilization
            </p>
            <p className="text-xl font-semibold tabular-nums">
              {data.utilization ?? "—"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
