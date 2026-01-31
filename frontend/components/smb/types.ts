/**
 * SMB invoice input and pricing preview types.
 * Discount-driven; system quotes default pricing from pool risk scheme.
 */

import type { PoolKind } from "@/components/lp/types";

/** Payer credit rating for invoice (AAA → B, Unknown). */
export type CreditRating =
  | "AAA"
  | "AA"
  | "A"
  | "BBB"
  | "BB"
  | "B"
  | "Unknown";

/** Form values: invoice amount, due date, payer credit rating. */
export interface SmbInvoiceInput {
  amountUsdc: number;
  dueDate: string; // ISO date YYYY-MM-DD
  payerCreditRating: CreditRating;
}

/** System-computed pricing result (mock or API). */
export interface SmbPricingResult {
  /** Eligible pool: Prime / Standard / High Yield */
  eligiblePool: PoolKind;
  /** Pool display name */
  eligiblePoolName: string;
  /** Default discount % (e.g. 4.5) */
  discountPercent: number;
  /** Cash advanced = amount × (1 - discount/100) */
  cashAdvancedUsdc: number;
  /** Derived APR, read-only informational (e.g. 8.2) */
  derivedAprPercent: number;
  /** Tenor in days (today → due date) */
  tenorDays: number;
}

/** Locked offer for confirmation: input + pricing. Terms are fixed when SMB continues to confirm. */
export interface SmbLockedOffer {
  input: SmbInvoiceInput;
  pricing: SmbPricingResult;
}
