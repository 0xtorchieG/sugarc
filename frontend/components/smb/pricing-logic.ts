/**
 * Mock pricing logic: given invoice amount, due date, payer rating,
 * compute eligible pool, default discount %, cash advanced, derived APR.
 * Aligns with pool risk scheme (Prime / Standard / High Yield).
 * Replace with API when backend is ready.
 */

import type { PoolKind } from "@/components/lp/types";
import type { CreditRating, SmbInvoiceInput, SmbPricingResult } from "./types";

const CREDIT_POINTS: Record<CreditRating, number> = {
  AAA: 0,
  AA: 1,
  A: 2,
  BBB: 4,
  BB: 6,
  B: 8,
  Unknown: 7,
};

const POOL_NAMES: Record<PoolKind, string> = {
  prime: "Prime",
  standard: "Standard",
  highYield: "High Yield",
};

/** Tenor bucket: days from today to due date. */
function getTenorDays(dueDateStr: string): number {
  const due = new Date(dueDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const ms = due.getTime() - today.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

/** Assign pool from credit + tenor (simplified MVP). Prime = best, Standard = mid, High Yield = higher risk. */
function getEligiblePool(creditRating: CreditRating, tenorDays: number): PoolKind {
  if (tenorDays > 90) return "prime"; // will show as ineligible in UI if we reject >90d
  const points = CREDIT_POINTS[creditRating];
  if (points <= 2 && tenorDays <= 45) return "prime";
  if (points <= 6 && tenorDays <= 60) return "standard";
  return "highYield";
}

/** Default discount % by pool and tenor (mock). Longer tenor / higher risk = higher discount. */
function getDiscountPercent(pool: PoolKind, tenorDays: number): number {
  const base: Record<PoolKind, number> = {
    prime: 2.5,
    standard: 5.5,
    highYield: 10,
  };
  const tenorFactor = Math.min(tenorDays / 30, 2) * 0.5; // up to +1% for longer tenor
  return Math.round((base[pool] + tenorFactor) * 10) / 10;
}

/** Derived APR (annualized) from discount and tenor. Informational only. */
function getDerivedApr(discountPercent: number, tenorDays: number): number {
  if (tenorDays <= 0) return 0;
  const annualized = (discountPercent / 100) * (365 / tenorDays) * 100;
  return Math.round(annualized * 10) / 10;
}

export function computePricing(input: SmbInvoiceInput): SmbPricingResult | null {
  const { amountUsdc, dueDate, payerCreditRating } = input;
  if (amountUsdc <= 0 || !dueDate) return null;

  const tenorDays = getTenorDays(dueDate);
  if (tenorDays > 90) return null; // reject >90d in MVP

  const eligiblePool = getEligiblePool(payerCreditRating, tenorDays);
  const discountPercent = getDiscountPercent(eligiblePool, tenorDays);
  const cashAdvancedUsdc = Math.round(amountUsdc * (1 - discountPercent / 100) * 100) / 100;
  const derivedAprPercent = getDerivedApr(discountPercent, tenorDays);

  return {
    eligiblePool,
    eligiblePoolName: POOL_NAMES[eligiblePool],
    discountPercent,
    cashAdvancedUsdc,
    derivedAprPercent,
    tenorDays,
  };
}
