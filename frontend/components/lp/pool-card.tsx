"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, TrendingUp, Wallet, Clock, ShieldCheck } from "lucide-react";
import type { LpPool, PoolRiskTier } from "./types";
import { cn } from "@/lib/utils";

interface PoolCardProps {
  pool: LpPool;
  onAddLiquidity?: (pool: LpPool) => void;
  className?: string;
}

const riskConfig: Record<
  PoolRiskTier,
  { label: string; className: string; icon: typeof Shield }
> = {
  low: {
    label: "Low",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    icon: Shield,
  },
  medium: {
    label: "Med",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    icon: Shield,
  },
  high: {
    label: "High",
    className: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
    icon: Shield,
  },
};

export function PoolCard({ pool, onAddLiquidity, className }: PoolCardProps) {
  const risk = riskConfig[pool.riskTier];

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg">{pool.name}</CardTitle>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              risk.className
            )}
          >
            <risk.icon className="h-3 w-3" />
            {risk.label}
          </span>
        </div>
        {pool.description && (
          <CardDescription className="mt-1 line-clamp-2">
            {pool.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            Target APR
          </span>
          <span className="font-semibold tabular-nums text-primary">
            {pool.targetApr}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Wallet className="h-4 w-4" />
            TVL
          </span>
          <span className="font-medium tabular-nums">{pool.tvl}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Utilization</span>
          <span className="font-medium tabular-nums">{pool.utilization}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-4 w-4" />
            Avg tenor
          </span>
          <span className="font-medium tabular-nums">{pool.avgTenor}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            Reserve
          </span>
          <span className="text-muted-foreground text-xs">
            {pool.reserveProtection}
          </span>
        </div>
      </CardContent>
      <CardFooter className="pt-2">
        <Button
          className="w-full"
          onClick={() => onAddLiquidity?.(pool)}
          aria-label={`Add USDC to ${pool.name}`}
        >
          Add USDC
        </Button>
      </CardFooter>
    </Card>
  );
}
