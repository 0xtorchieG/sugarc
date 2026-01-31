/**
 * Typed interfaces for LP dashboard data.
 * Ready for later API wiring.
 */

export interface LpKpis {
  totalDeposited: string;
  availableLiquidity: string;
  earnedFees: string;
}

export interface LpPoolOverview {
  currentApr: string;
  utilization: string;
}

export interface LpPayout {
  id: string;
  date: string;
  amount: string;
  pool: string;
  txHash?: string;
}

export interface LpDashboardData {
  kpis: LpKpis;
  poolOverview: LpPoolOverview;
  recentPayouts: LpPayout[];
}
