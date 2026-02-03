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

/** Form values: invoice amount, due date, payer credit rating; optional PDF-derived fields. */
export interface SmbInvoiceInput {
  amountUsdc: number;
  dueDate: string; // ISO date YYYY-MM-DD
  payerCreditRating: CreditRating;
  /** Payer/customer email (required for PDF flow; used for payment instructions notification) */
  customerEmail?: string;
  /** Invoice number from PDF or manual */
  invoiceNumber?: string;
  /** Payer/customer name */
  payerName?: string;
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
  /** Set when offer was created from PDF parse (for refHash stability) */
  extractedTextHash?: string;
}

/** SMB dashboard stats (read from chain by wallet later; mock for now). */
export interface SmbStats {
  /** Total invoice face value factored so far (USDC) */
  totalFactoredUsdc: string;
  /** Total USDC received (cash advanced) so far */
  totalReceivedUsdc: string;
  /** Number of invoices currently active (not yet settled) */
  activeInvoicesCount: number;
  /** Number of invoices settled/paid off */
  settledInvoicesCount: number;
}

/** Status of a factored invoice. */
export type SmbInvoiceStatus = "active" | "settled" | "pending";

/** Single factored invoice record (chain-derived later; mock for now). */
export interface SmbInvoiceRecord {
  id: string;
  /** On-chain invoice id (for simulate-paid demo) */
  onchainInvoiceId?: string;
  /** Invoice face value (USDC) */
  amountUsdc: string;
  /** Cash advanced / received (USDC) */
  receivedUsdc: string;
  status: SmbInvoiceStatus;
  dueDate: string;
  /** When factored (ISO date) */
  factoredAt: string;
  /** Pool that funded: Prime / Standard / High Yield */
  pool: string;
}
