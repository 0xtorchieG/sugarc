"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FileStack, Banknote, Clock, CheckCircle } from "lucide-react";
import type { SmbStats } from "./types";
import { EmptyStateChart } from "@/components/lp/empty-state";
import { cn } from "@/lib/utils";

interface SmbStatsCardsProps {
  data: SmbStats | null;
  className?: string;
}

const statConfig = [
  {
    key: "totalFactoredUsdc" as const,
    label: "Total factored",
    icon: FileStack,
    format: (v: string) => `${v} USDC`,
  },
  {
    key: "totalReceivedUsdc" as const,
    label: "Total received",
    icon: Banknote,
    format: (v: string) => `${v} USDC`,
  },
  {
    key: "activeInvoicesCount" as const,
    label: "Active invoices",
    icon: Clock,
    format: (v: number) => String(v),
  },
  {
    key: "settledInvoicesCount" as const,
    label: "Settled invoices",
    icon: CheckCircle,
    format: (v: number) => String(v),
  },
] as const;

export function SmbStatsCards({ data, className }: SmbStatsCardsProps) {
  if (!data) {
    return (
      <EmptyStateChart
        title="No stats yet"
        description="Your factoring stats will appear here (from chain)."
      />
    );
  }

  const hasAny =
    data.totalFactoredUsdc ||
    data.totalReceivedUsdc ||
    data.activeInvoicesCount > 0 ||
    data.settledInvoicesCount > 0;

  if (!hasAny) {
    return (
      <EmptyStateChart
        title="No stats yet"
        description="Your factoring stats will appear here once you factor invoices."
      />
    );
  }

  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {statConfig.map(({ key, label, icon: Icon, format }) => (
        <Card key={key}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <Icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold tabular-nums">
              {key === "activeInvoicesCount" || key === "settledInvoicesCount"
                ? format(data[key] as number)
                : format(data[key] as string)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
