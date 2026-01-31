"use client";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Banknote, Percent, Layers, TrendingUp } from "lucide-react";
import type { SmbPricingResult } from "./types";
import { cn } from "@/lib/utils";

interface PricingPreviewCardProps {
  result: SmbPricingResult | null;
  /** True when form has no valid input (amount 0 or no date). */
  isEmpty: boolean;
  /** True when tenor > 90 days (rejected in MVP). */
  isRejected?: boolean;
  /** Called when SMB clicks Continue to go to confirmation. */
  onContinue?: () => void;
  className?: string;
}

export function PricingPreviewCard({
  result,
  isEmpty,
  isRejected,
  onContinue,
  className,
}: PricingPreviewCardProps) {
  if (isEmpty) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg">Pricing preview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Enter invoice amount, due date, and payer rating to see your quote.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isRejected) {
    return (
      <Card className={cn("border-amber-500/50", className)}>
        <CardHeader>
          <CardTitle className="text-lg">Pricing preview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Due date must be within 90 days. Please choose an earlier due date.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!result) return null;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Pricing preview</CardTitle>
        <p className="text-xs text-muted-foreground">
          Default quote based on pool risk. Eligible pool: {result.eligiblePoolName}.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg bg-primary/10 p-4">
          <span className="flex items-center gap-2 font-medium text-muted-foreground">
            <Banknote className="h-5 w-5 text-primary" />
            You receive today
          </span>
          <span className="text-2xl font-semibold tabular-nums text-primary">
            {result.cashAdvancedUsdc.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            USDC
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Percent className="h-4 w-4" />
            Factoring fee
          </span>
          <span className="font-semibold tabular-nums">
            {result.discountPercent}%
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Layers className="h-4 w-4" />
            Pool
          </span>
          <span className="font-medium">{result.eligiblePoolName}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Derived APR (informational)
          </span>
          <span className="tabular-nums">{result.derivedAprPercent}%</span>
        </div>
      </CardContent>
      {onContinue && (
        <CardFooter className="pt-2">
          <Button className="w-full" onClick={onContinue}>
            Continue
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
