"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Banknote, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type InvoiceInfo = {
  invoiceId: string;
  faceAmountUsdc: string;
  remainingUsdc: string;
  status: string;
  canPay: boolean;
};

type WireInstructions = {
  trackingRef: string;
  beneficiary?: { name?: string; address1?: string; address2?: string };
  beneficiaryBank?: {
    name?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    country?: string;
    swiftCode?: string;
    routingNumber?: string;
    accountNumber: string;
    currency: string;
  };
};

export default function PayInvoicePage({
  params,
}: {
  params: Promise<{ invoiceId: string }> | { invoiceId: string };
}) {
  const [resolvedId, setResolvedId] = useState("");
  useEffect(() => {
    if (params instanceof Promise) {
      params.then((p) => setResolvedId(p.invoiceId));
    } else {
      setResolvedId((params as { invoiceId: string }).invoiceId);
    }
  }, [params]);
  const [invoice, setInvoice] = useState<InvoiceInfo | null>(null);
  const [wire, setWire] = useState<WireInstructions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payStep, setPayStep] = useState<"idle" | "wiring" | "settling" | "done" | "error">("idle");
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    if (!resolvedId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/invoices/${resolvedId}/public`),
      fetch("/api/mint/wire-instructions"),
    ])
      .then(async ([invRes, wireRes]) => {
        if (cancelled) return;
        if (!invRes.ok) {
          const j = await invRes.json().catch(() => ({}));
          throw new Error(j.details ?? j.error ?? "Failed to load invoice");
        }
        if (!wireRes.ok) {
          const j = await wireRes.json().catch(() => ({}));
          throw new Error(j.details ?? j.error ?? "Failed to load wire instructions");
        }
        const [invData, wireData] = await Promise.all([invRes.json(), wireRes.json()]);
        setInvoice(invData);
        setWire(wireData);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resolvedId]);

  async function handleSimulateWire() {
    if (!invoice || !invoice.canPay) return;
    setPayStep("wiring");
    setPayError(null);
    try {
      const wireRes = await fetch("/api/mint/mock-wire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: resolvedId,
          amountUsdc: invoice.remainingUsdc,
        }),
      });
      const wireData = await wireRes.json();
      if (!wireRes.ok) {
        throw new Error(wireData.details ?? wireData.error ?? "Mock wire failed");
      }
      setPayStep("settling");
      const settleRes = await fetch(
        `/api/invoices/${resolvedId}/settle-from-mint?force=true`,
        { method: "POST" }
      );
      const settleData = await settleRes.json();
      if (!settleRes.ok) {
        throw new Error(settleData.details ?? settleData.error ?? "Settle failed");
      }
      setPayStep("done");
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Payment failed");
      setPayStep("error");
    }
  }

  if (loading) {
    return (
      <Container>
        <div className="flex min-h-[12rem] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        </div>
      </Container>
    );
  }

  if (error || !invoice || !wire) {
    return (
      <Container>
        <div className="mx-auto max-w-xl space-y-6">
          <h1 className="text-2xl font-semibold">Payment</h1>
          <Card>
            <CardContent className="pt-6">
              <p className="text-destructive">{error ?? "Invoice not found"}</p>
              <Button variant="outline" className="mt-4" asChild>
                <Link href="/">Back to home</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </Container>
    );
  }

  const bank = wire.beneficiaryBank;
  const isDone = payStep === "done";

  return (
    <Container>
      <div className="mx-auto max-w-xl space-y-8">
        <div>
          <Link
            href="/"
            className="font-semibold text-muted-foreground hover:text-foreground"
          >
            ← Sugarc
          </Link>
        </div>

        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Banknote className="h-7 w-7 text-primary" />
            Pay invoice #{invoice.invoiceId}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Send a bank wire to settle this factored invoice.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Amount due</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-bold">{invoice.remainingUsdc} USDC</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Payment reference (include in wire memo):{" "}
              <strong>{invoice.invoiceId}</strong>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Wire instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
              {wire.beneficiary && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Beneficiary</p>
                  <p className="font-mono text-sm">
                    {wire.beneficiary.name}
                    {wire.beneficiary.address1 && `, ${wire.beneficiary.address1}`}
                    {wire.beneficiary.address2 && `, ${wire.beneficiary.address2}`}
                  </p>
                </div>
              )}
              {bank && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Bank details</p>
                  <div className="rounded-md bg-muted/50 p-4 font-mono text-sm">
                    {bank.name && <p>{bank.name}</p>}
                    {bank.address && <p>{bank.address}</p>}
                    {(bank.city || bank.postalCode || bank.country) && (
                      <p>
                        {[bank.city, bank.postalCode, bank.country]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    )}
                    {bank.swiftCode && <p>SWIFT: {bank.swiftCode}</p>}
                    {bank.routingNumber && <p>Routing: {bank.routingNumber}</p>}
                    <p>Account: {bank.accountNumber}</p>
                    <p>Currency: {bank.currency}</p>
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Tracking ref: {wire.trackingRef}
              </p>
          </CardContent>
        </Card>

        {invoice.status === "repaid" ? (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="flex items-center gap-3 pt-6">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
              <div>
                <p className="font-semibold">Invoice repaid</p>
                <p className="text-sm text-muted-foreground">
                  This invoice has been fully settled onchain.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : isDone ? (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="flex items-center gap-3 pt-6">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
              <div>
                <p className="font-semibold">Payment complete</p>
                <p className="text-sm text-muted-foreground">
                  Wire simulated and invoice settled onchain.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Demo: simulate wire payment</CardTitle>
              <p className="text-sm text-muted-foreground">
                In production, you would send a real bank wire. In sandbox, click below to
                simulate the wire and settle the invoice onchain.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {(payStep === "wiring" || payStep === "settling") && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {payStep === "wiring"
                    ? "Simulating wire..."
                    : "Settling onchain..."}
                </div>
              )}
              {payStep === "error" && payError && (
                <p className="text-sm text-destructive">{payError}</p>
              )}
              <Button
                onClick={handleSimulateWire}
                disabled={!invoice.canPay || payStep === "wiring" || payStep === "settling"}
                className="w-full sm:w-auto"
              >
                {payStep === "wiring" || payStep === "settling" ? (
                  "Processing..."
                ) : (
                  <>
                    Simulate wire & settle
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/" className="underline hover:no-underline">
            Back to Sugarc
          </Link>
        </p>
      </div>
    </Container>
  );
}
