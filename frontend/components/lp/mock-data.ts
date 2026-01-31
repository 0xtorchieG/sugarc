import type { LpDashboardData } from "./types";

/**
 * Mock LP dashboard data for read-only v1.
 * Pools: Prime (A), Standard (B), High Yield (C). Pool D (Special Situations) hidden in MVP.
 * Replace with API call when wiring backend.
 */
export const mockLpDashboardData: LpDashboardData = {
  kpis: {
    totalDeposited: "125,000.00 USDC",
    availableLiquidity: "98,500.00 USDC",
    earnedFees: "1,240.50 USDC",
  },
  poolOverview: {
    currentApr: "8.24%",
    utilization: "42%",
  },
  pools: [
    {
      id: "pool-prime",
      name: "Prime",
      kind: "prime",
      description: "Payer AAA–A · Tenor 7–45 days · LTV up to 95%. Tight concentration limits.",
      riskTier: "low",
      targetApr: "4–6%",
      tvl: "2.1M USDC",
      utilization: "68%",
      avgTenor: "28 days",
      reserveProtection: "Coming soon",
    },
    {
      id: "pool-standard",
      name: "Standard",
      kind: "standard",
      description: "Payer BBB–BB or A with longer tenor · Tenor 30–60 days · LTV up to 90%.",
      riskTier: "medium",
      targetApr: "7–10%",
      tvl: "1.4M USDC",
      utilization: "58%",
      avgTenor: "41 days",
      reserveProtection: "Coming soon",
    },
    {
      id: "pool-highYield",
      name: "High Yield",
      kind: "highYield",
      description: "Payer B or Unknown (not flagged) · Tenor up to 90 days · LTV 80–85%. Stronger caps + bigger reserve.",
      riskTier: "high",
      targetApr: "11–14%",
      tvl: "680K USDC",
      utilization: "62%",
      avgTenor: "55 days",
      reserveProtection: "Coming soon",
    },
  ],
  recentPayouts: [
    {
      id: "1",
      date: "2025-01-28",
      amount: "42.30 USDC",
      pool: "Prime",
      txHash: "0xabc123def456789",
    },
    {
      id: "2",
      date: "2025-01-25",
      amount: "38.10 USDC",
      pool: "Standard",
      txHash: "0xdef789abc123456",
    },
    {
      id: "3",
      date: "2025-01-22",
      amount: "51.20 USDC",
      pool: "Prime",
    },
  ],
};

/** Empty dashboard for testing empty states. */
export const mockLpDashboardDataEmpty: LpDashboardData = {
  kpis: {
    totalDeposited: "",
    availableLiquidity: "",
    earnedFees: "",
  },
  poolOverview: {
    currentApr: "",
    utilization: "",
  },
  pools: [],
  recentPayouts: [],
};
