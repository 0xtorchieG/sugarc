import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Wallet, Droplets, Coins } from "lucide-react";
import type { LpKpis } from "./types";
import { EmptyStateChart } from "./empty-state";
import { cn } from "@/lib/utils";

interface KpiCardsProps {
  data: LpKpis | null;
  className?: string;
}

const kpiConfig = [
  {
    key: "totalDeposited" as const,
    label: "Total Deposited",
    icon: Wallet,
    format: (v: string) => v,
  },
  {
    key: "availableLiquidity" as const,
    label: "Available Liquidity",
    icon: Droplets,
    format: (v: string) => v,
  },
  {
    key: "earnedFees" as const,
    label: "Earned Fees",
    icon: Coins,
    format: (v: string) => v,
  },
] as const;

export function KpiCards({ data, className }: KpiCardsProps) {
  if (!data) {
    return (
      <EmptyStateChart
        title="No KPI data"
        description="Deposit and liquidity metrics will appear here."
      />
    );
  }

  const hasAnyValue = kpiConfig.some(({ key }) => data[key]?.trim());
  if (!hasAnyValue) {
    return (
      <EmptyStateChart
        title="No KPI data"
        description="Deposit and liquidity metrics will appear here."
      />
    );
  }

  return (
    <div className={cn("grid gap-4 sm:grid-cols-3", className)}>
      {kpiConfig.map(({ key, label, icon: Icon, format }) => (
        <Card key={key}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <Icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {data[key] ? format(data[key]) : "—"}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
