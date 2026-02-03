"use client";

import { useState, useEffect, useCallback } from "react";
import { Droplets, BarChart3, Layers } from "lucide-react";
import { Container } from "@/components/layout/container";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCards } from "@/components/lp/kpi-cards";
import { PoolOverview } from "@/components/lp/pool-overview";
import { AvailablePools } from "@/components/lp/available-pools";
import { RecentPayouts } from "@/components/lp/recent-payouts";
import { DepositModal } from "@/components/lp/deposit-modal";
import { useAuth } from "@/contexts/auth-context";
import { mockLpDashboardData } from "@/components/lp/mock-data";
import type { LpDashboardData, LpPool, LpKpis, LpPoolOverview } from "@/components/lp/types";

function mapApiPoolToLpPool(p: { id: string; name: string; kind: string; description: string; riskTier: string; targetApr: string; tvl: string; utilization: string; avgTenor: string; reserveProtection: string }): LpPool {
  return {
    id: p.id,
    name: p.name,
    kind: p.kind as LpPool["kind"],
    description: p.description,
    riskTier: p.riskTier as LpPool["riskTier"],
    targetApr: p.targetApr,
    tvl: p.tvl,
    utilization: p.utilization,
    avgTenor: p.avgTenor,
    reserveProtection: p.reserveProtection,
  };
}

export default function LPDashboardPage() {
  const { wallet, refreshWallet } = useAuth();
  const [data, setData] = useState<LpDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [depositPool, setDepositPool] = useState<LpPool | null>(null);

  const fetchPools = useCallback(async () => {
    try {
      const url = wallet?.address
        ? `/api/lp/pools?wallet=${encodeURIComponent(wallet.address)}`
        : "/api/lp/pools";
      const [poolsRes, activityRes] = await Promise.all([
        fetch(url),
        fetch("/api/lp/activity"),
      ]);
      if (!poolsRes.ok) throw new Error("Failed to fetch pools");
      const json = await poolsRes.json();
      const pools: LpPool[] = (json.pools ?? []).map(mapApiPoolToLpPool);
      const apiKpis = json.kpis as LpKpis | undefined;
      let kpis: LpKpis = apiKpis && (apiKpis.totalDeposited !== "—" || apiKpis.availableLiquidity !== "—")
        ? apiKpis
        : { ...mockLpDashboardData.kpis };
      const poolOverview: LpPoolOverview =
        pools.length > 0
          ? {
              currentApr: mockLpDashboardData.poolOverview.currentApr || "—",
              utilization:
                Math.round(
                  pools.reduce((acc, p) => acc + (parseInt(p.utilization, 10) || 0), 0) / pools.length
                ) + "%",
            }
          : { ...mockLpDashboardData.poolOverview };

      let recentPayouts = mockLpDashboardData.recentPayouts as LpDashboardData["recentPayouts"];
      if (activityRes.ok) {
        const activityJson = await activityRes.json();
        const repayments = (activityJson.repayments ?? []) as Array<{
          id: string;
          date: string;
          amount: string;
          pool: string;
          txHash?: string;
        }>;
        const withType = repayments.map((r) => ({ ...r, type: "repayment" as const }));
        recentPayouts =
          withType.length > 0
            ? [...withType, ...recentPayouts].slice(0, 15)
            : recentPayouts;
        // Earned fees from chain (sum of faceAmount - advanceAmount for repaid invoices)
        const totalEarned = activityJson.totalEarnedFeesUsdc;
        if (totalEarned != null && totalEarned !== "" && kpis) {
          kpis = {
            ...kpis,
            earnedFees: `${totalEarned} USDC`,
          };
        }
      }

      setData({
        kpis,
        poolOverview,
        pools,
        recentPayouts,
      });
    } catch (err) {
      console.error("fetchPools", err);
      setData({
        kpis: mockLpDashboardData.kpis,
        poolOverview: mockLpDashboardData.poolOverview,
        pools: mockLpDashboardData.pools,
        recentPayouts: mockLpDashboardData.recentPayouts,
      });
    } finally {
      setIsLoading(false);
    }
  }, [wallet?.address]);

  useEffect(() => {
    void fetchPools();
  }, [fetchPools]);

  function handleAddLiquidity(pool: LpPool) {
    setDepositPool(pool);
  }

  async function handleDepositSuccess() {
    await refreshWallet();
    await fetchPools();
    setDepositPool(null);
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
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-center gap-3">
            <Layers className="h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm font-medium text-foreground">
              Multichain liquidity with Arc as hub — Deposit USDC from Base Sepolia or Ethereum Sepolia directly into Sugarc pools. No manual bridging.
            </p>
          </div>
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
              <KpiCards data={data!.kpis} />
              <PoolOverview data={data!.poolOverview} />
              <RecentPayouts payouts={data!.recentPayouts} />
            </TabsContent>

            <TabsContent value="pools" className="space-y-8">
              <AvailablePools
                pools={data!.pools}
                onAddLiquidity={handleAddLiquidity}
              />
            </TabsContent>
          </Tabs>
        </div>
        {depositPool && (
          <DepositModal
            pool={depositPool}
            onClose={() => setDepositPool(null)}
            onSuccess={handleDepositSuccess}
          />
        )}
      </Container>
    </ProtectedRoute>
  );
}
