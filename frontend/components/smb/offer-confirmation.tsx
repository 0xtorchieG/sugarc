"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Layers,
  Shield,
  Banknote,
  Percent,
  Calendar,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import type { SmbLockedOffer } from "./types";
import type { PoolKind } from "@/components/lp/types";
import { cn } from "@/lib/utils";

const POOL_RISK: Record<PoolKind, { label: string; className: string }> = {
  prime: {
    label: "Low risk",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
  standard: {
    label: "Med risk",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  highYield: {
    label: "High risk",
    className: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  },
};

interface OfferConfirmationProps {
  offer: SmbLockedOffer;
  onBack: () => void;
  onSuccess?: (intentId: string) => void;
  className?: string;
}

export function OfferConfirmation({
  offer,
  onBack,
  onSuccess,
  className,
}: OfferConfirmationProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "funding" | "success" | "error">("idle");
  const [intentId, setIntentId] = useState<string | null>(null);
  const [refHash, setRefHash] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [onchainInvoiceId, setOnchainInvoiceId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { wallet } = useAuth();

  const { input, pricing } = offer;
  const risk = POOL_RISK[pricing.eligiblePool];
  const dueDateFormatted = input.dueDate
    ? new Date(input.dueDate + "T12:00:00").toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

  async function handleAccept() {
    setStatus("loading");
    setErrorMessage(null);
    try {
      const body = {
        input: offer.input,
        pricing: offer.pricing,
        ...(wallet?.address && { smbAddress: wallet.address }),
        ...(offer.input.customerEmail && { customerEmail: offer.input.customerEmail }),
        ...(offer.input.invoiceNumber && { invoiceNumber: offer.input.invoiceNumber }),
        ...(offer.input.payerName && { payerName: offer.input.payerName }),
        ...(offer.extractedTextHash && { extractedTextHash: offer.extractedTextHash }),
      };
      const res = await fetch("/api/smb/invoice-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = data.details?.fieldErrors
          ? Object.entries(data.details.fieldErrors)
              .flatMap(([k, v]) => (Array.isArray(v) ? v : [v]).map((e: string) => `${k}: ${e}`))
              .join("; ")
          : data.details?.formErrors?.join?.("; ") ?? data.details;
        setErrorMessage(
          [data.error, detail].filter(Boolean).join(" — ") || "Request failed"
        );
        setStatus("error");
        return;
      }
      const id = data.intentId as string;
      setIntentId(id);
      setRefHash(data.refHash ?? null);
      onSuccess?.(id);

      if (!wallet?.address) {
        setStatus("success");
        return;
      }

      setStatus("funding");
      const fundRes = await fetch(`/api/invoices/${id}/fund`, { method: "POST" });
      const fundData = await fundRes.json();
      if (!fundRes.ok) {
        setErrorMessage(
          `Intent created. Funding failed: ${fundData.error ?? fundData.details ?? "Unknown error"}`
        );
        setStatus("success");
        return;
      }
      setTxHash(fundData.txHash ?? null);
      setOnchainInvoiceId(fundData.onchainInvoiceId ?? null);
      setStatus("success");
    } catch {
      setErrorMessage("Network error");
      setStatus("error");
    }
  }

  if (status === "success" && intentId) {
    return (
      <Card className={cn("border-emerald-500/30", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
            {txHash ? "Funded onchain" : "Offer accepted"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {txHash
              ? "USDC has been sent to your wallet. Invoice is now active onchain."
              : "Invoice intent created. You will receive USDC after funding is confirmed."}
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm font-medium">
            Intent ID: <span className="font-mono text-primary">{intentId}</span>
          </p>
          {onchainInvoiceId != null && (
            <p className="text-sm font-medium">
              Onchain invoice: <span className="font-mono text-primary">{onchainInvoiceId}</span>
            </p>
          )}
          {txHash && (
            <p className="text-xs text-muted-foreground font-mono break-all">
              <a
                href={`https://testnet.arcscan.app/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                View tx: {txHash.slice(0, 10)}…
              </a>
            </p>
          )}
          {refHash && !txHash && (
            <p className="text-xs text-muted-foreground font-mono break-all">
              refHash: {refHash}
            </p>
          )}
          {errorMessage && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              {errorMessage}
            </p>
          )}
          <Button variant="outline" onClick={onBack} className="mt-4">
            Create another request
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Confirm your offer</CardTitle>
        <p className="text-sm text-muted-foreground">
          Review the terms below. Accepting creates an invoice intent; you will receive USDC after funding.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Invoice summary */}
        <div className="rounded-lg border border-input/40 bg-muted/20 p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Invoice summary
          </p>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <FileText className="h-4 w-4" />
              Invoice amount
            </span>
            <span className="font-semibold tabular-nums">
              {input.amountUsdc.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              USDC
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Due date
            </span>
            <span className="font-medium">{dueDateFormatted}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
            <span>Payer rating</span>
            <span>{input.payerCreditRating}</span>
          </div>
        </div>

        {/* Assigned pool with risk label */}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Layers className="h-4 w-4" />
            Assigned pool
          </span>
          <span className="flex items-center gap-2">
            <span className="font-medium">{pricing.eligiblePoolName}</span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                risk.className
              )}
            >
              <Shield className="h-3 w-3" />
              {risk.label}
            </span>
          </span>
        </div>

        {/* Cash today */}
        <div className="flex items-center justify-between rounded-lg bg-primary/10 p-4">
          <span className="flex items-center gap-2 font-medium text-muted-foreground">
            <Banknote className="h-5 w-5 text-primary" />
            Cash today
          </span>
          <span className="text-xl font-semibold tabular-nums text-primary">
            {pricing.cashAdvancedUsdc.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            USDC
          </span>
        </div>

        {/* Fee (discount) */}
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Percent className="h-4 w-4" />
            Factoring fee (discount)
          </span>
          <span className="font-semibold tabular-nums">{pricing.discountPercent}%</span>
        </div>

        {/* Due date (again for clarity) */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Due date</span>
          <span>{dueDateFormatted}</span>
        </div>

        {/* Derived APR - small, informational */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Derived APR (informational)
          </span>
          <span className="tabular-nums">{pricing.derivedAprPercent}%</span>
        </div>

        {errorMessage && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
            {errorMessage}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onBack} disabled={status === "loading" || status === "funding"} className="flex-1">
            Back
          </Button>
          <Button
            className="flex-1"
            onClick={handleAccept}
            disabled={status === "loading" || status === "funding"}
          >
            {status === "loading"
              ? "Creating intent…"
              : status === "funding"
                ? "Funding onchain…"
                : "Accept offer & receive USDC"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
