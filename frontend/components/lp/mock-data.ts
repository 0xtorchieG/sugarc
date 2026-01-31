import type { LpDashboardData } from "./types";

/**
 * Mock LP dashboard data for read-only v1.
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
  recentPayouts: [
    {
      id: "1",
      date: "2025-01-28",
      amount: "42.30 USDC",
      pool: "USDC–ETH",
      txHash: "0xabc123def456789",
    },
    {
      id: "2",
      date: "2025-01-25",
      amount: "38.10 USDC",
      pool: "USDC–ETH",
      txHash: "0xdef789abc123456",
    },
    {
      id: "3",
      date: "2025-01-22",
      amount: "51.20 USDC",
      pool: "USDC–ETH",
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
  recentPayouts: [],
};
