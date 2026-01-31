"use client";

import { useState } from "react";
import { Droplets, BarChart3, Layers } from "lucide-react";
import { Container } from "@/components/layout/container";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCards } from "@/components/lp/kpi-cards";
import { PoolOverview } from "@/components/lp/pool-overview";
import { AvailablePools } from "@/components/lp/available-pools";
import { RecentPayouts } from "@/components/lp/recent-payouts";
import { mockLpDashboardData } from "@/components/lp/mock-data";
import type { LpDashboardData } from "@/components/lp/types";

export default function LPDashboardPage() {
  // Read-only v1: use mock data. Replace with API call when wiring backend.
  const data: LpDashboardData = mockLpDashboardData;
  // Optional loading state for when API is wired; set to true to test loading UI.
  const [isLoading] = useState(false);

  // Placeholder for future: open deposit modal / navigate to deposit flow.
  function handleAddLiquidity(poolId: string) {
    // TODO: trigger transaction flow (modal, sign, etc.)
    console.log("Add liquidity to pool:", poolId);
  }

  if (isLoading) {
    return (
      <ProtectedRoute>
        <Container>
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
            <Spinner size="lg" />
            <p className="text-sm text-muted-foreground">Loading dashboard…</p>
          </div>
        </Container>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Container>
        <div className="space-y-6">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Droplets className="h-7 w-7 text-primary" />
              Liquidity Provider Dashboard
            </h1>
            <p className="mt-1 text-muted-foreground">
              Your supplied liquidity, yield, and activity. Add USDC to pools below.
            </p>
          </div>

          <Tabs defaultValue="pools" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="stats" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Stats
              </TabsTrigger>
              <TabsTrigger value="pools" className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Pools
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stats" className="space-y-8">
              <KpiCards data={data.kpis} />
              <PoolOverview data={data.poolOverview} />
              <RecentPayouts payouts={data.recentPayouts} />
            </TabsContent>

            <TabsContent value="pools" className="space-y-8">
              <AvailablePools
                pools={data.pools}
                onAddLiquidity={handleAddLiquidity}
              />
            </TabsContent>
          </Tabs>
        </div>
      </Container>
    </ProtectedRoute>
  );
}
