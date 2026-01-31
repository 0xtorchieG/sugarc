"use client";

import { Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PoolCard } from "./pool-card";
import { EmptyState } from "./empty-state";
import type { LpPool } from "./types";
import { cn } from "@/lib/utils";

interface AvailablePoolsProps {
  pools: LpPool[] | null;
  onAddLiquidity?: (poolId: string) => void;
  className?: string;
}

export function AvailablePools({
  pools,
  onAddLiquidity,
  className,
}: AvailablePoolsProps) {
  const hasPools = pools && pools.length > 0;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-muted-foreground" />
          Available pools
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Prime (low risk), Standard (medium), High Yield (high). Choose where to add USDC.
        </p>
      </CardHeader>
      <CardContent>
        {!hasPools ? (
          <EmptyState
            icon={<Layers className="h-10 w-10" />}
            title="No pools yet"
            description="Liquidity pools will appear here. Pools are grouped by risk tier (low / medium / high)."
          />
        ) : (
          <div
            className={cn(
              "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            )}
          >
            {pools.map((pool) => (
              <PoolCard
                key={pool.id}
                pool={pool}
                onAddLiquidity={onAddLiquidity}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
