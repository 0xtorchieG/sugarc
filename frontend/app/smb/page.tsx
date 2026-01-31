"use client";

import { useState, useMemo } from "react";
import { FileStack } from "lucide-react";
import { Container } from "@/components/layout/container";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvoiceForm } from "@/components/smb/invoice-form";
import { PricingPreviewCard } from "@/components/smb/pricing-preview-card";
import { OfferConfirmation } from "@/components/smb/offer-confirmation";
import { computePricing } from "@/components/smb/pricing-logic";
import type { SmbInvoiceInput, SmbLockedOffer } from "@/components/smb/types";

function getDefaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

const defaultInput: SmbInvoiceInput = {
  amountUsdc: 0,
  dueDate: getDefaultDueDate(),
  payerCreditRating: "A",
};

type Step = "quote" | "confirm";

export default function SMBDashboardPage() {
  const [step, setStep] = useState<Step>("quote");
  const [input, setInput] = useState<SmbInvoiceInput>(defaultInput);
  const [lockedOffer, setLockedOffer] = useState<SmbLockedOffer | null>(null);

  const pricing = useMemo(() => computePricing(input), [input]);
  const tenorDays = useMemo(() => {
    if (!input.dueDate) return 0;
    const due = new Date(input.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return Math.max(0, Math.ceil((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)));
  }, [input.dueDate]);
  const isRejected = tenorDays > 90;
  const isEmpty = input.amountUsdc <= 0 || !input.dueDate;
  const canContinue = !isEmpty && !isRejected && pricing !== null;

  function handleContinue() {
    if (!pricing) return;
    setLockedOffer({ input: { ...input }, pricing });
    setStep("confirm");
  }

  function handleBack() {
    setStep("quote");
  }

  if (step === "confirm" && lockedOffer) {
    return (
      <ProtectedRoute>
        <Container>
          <div className="mx-auto max-w-xl space-y-8">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                <FileStack className="h-7 w-7 text-primary" />
                Confirm your offer
              </h1>
              <p className="mt-1 text-muted-foreground">
                Review terms and accept to create your invoice intent.
              </p>
            </div>
            <OfferConfirmation
              offer={lockedOffer}
              onBack={handleBack}
            />
          </div>
        </Container>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Container>
        <div className="space-y-8">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <FileStack className="h-7 w-7 text-primary" />
              Request USDC payout
            </h1>
            <p className="mt-1 text-muted-foreground">
              Enter invoice details for a discount-driven quote. You receive USDC today; factoring fee is based on pool risk.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Invoice details</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Amount, due date, and payer credit rating (AAA → B, Unknown).
                </p>
              </CardHeader>
              <CardContent>
                <InvoiceForm value={input} onChange={setInput} />
              </CardContent>
            </Card>

            <PricingPreviewCard
              result={isRejected ? null : pricing}
              isEmpty={isEmpty}
              isRejected={!isEmpty && isRejected}
              onContinue={canContinue ? handleContinue : undefined}
            />
          </div>
        </div>
      </Container>
    </ProtectedRoute>
  );
}
