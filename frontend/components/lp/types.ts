/**
 * Typed interfaces for LP dashboard data.
 * Ready for later API wiring.
 * Pools: Prime (A), Standard (B), High Yield (C). Special Situations (D) hidden in MVP.
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

/** Risk badge on pool card: Low / Med / High. */
export type PoolRiskTier = "low" | "medium" | "high";

/** Pool kind: Prime (A), Standard (B), High Yield (C). D = Special Situations, hidden in MVP. */
export type PoolKind = "prime" | "standard" | "highYield";

/** A liquidity pool LPs can choose to add liquidity to. */
export interface LpPool {
  id: string;
  /** Display name: Prime / Standard / High Yield */
  name: string;
  kind: PoolKind;
  description?: string;
  riskTier: PoolRiskTier;
  /** Target APR; range is fine in MVP, e.g. "4–6%" or "8–10%" */
  targetApr: string;
  /** Total value locked, e.g. "1.2M USDC" */
  tvl: string;
  /** Utilization = outstanding / total liquidity, e.g. "72%" */
  utilization: string;
  /** Average tenor of outstanding, e.g. "41 days" */
  avgTenor: string;
  /** Reserve / protection; "Coming soon" ok in MVP */
  reserveProtection: string;
}

export interface LpDashboardData {
  kpis: LpKpis;
  poolOverview: LpPoolOverview;
  pools: LpPool[];
  recentPayouts: LpPayout[];
}

/**
 * Deterministic scoring (MVP-friendly). No ML; simple points model.
 * Used by backend to assign invoices to pools. Score = credit + tenor + amount.
 *
 * Credit rating points:
 *   AAA=0, AA=1, A=2, BBB=4, BB=6, B=8, Unknown=7
 * Tenor points:
 *   0–30d=0, 31–60d=2, 61–90d=4, >90d=reject (MVP)
 * Amount points (concentration proxy):
 *   <10k=0, 10–50k=1, 50–200k=2, >200k=4 (or require manual)
 */
export const POOL_SCORING = {
  credit: { AAA: 0, AA: 1, A: 2, BBB: 4, BB: 6, B: 8, Unknown: 7 },
  tenor: { "0-30": 0, "31-60": 2, "61-90": 4, ">90": "reject" },
  amount: { "<10k": 0, "10-50k": 1, "50-200k": 2, ">200k": 4 },
} as const;
