import { NextRequest, NextResponse } from "next/server";
import {
  createMockWirePayment,
  getBeneficiaryAccountNumber,
} from "@/lib/circle-mint";
import { addPendingWire } from "@/lib/pending-mint-wires";

/**
 * POST /api/mint/mock-wire (BE-008)
 * Triggers a mock wire deposit in Circle Mint sandbox.
 * Body: { invoiceId: string, amountUsdc: string }
 * Returns: { trackingRef, status, message }
 *
 * Demo flow: Call this → wait for wire to complete (up to 15 min in sandbox) →
 * call POST /api/invoices/[invoiceId]/settle-from-mint to repay onchain.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const invoiceId = String(body.invoiceId ?? "").trim();
    const amountUsdc = String(body.amountUsdc ?? body.amount ?? "").trim();

    if (!invoiceId || !amountUsdc) {
      return NextResponse.json(
        {
          error: "Missing invoiceId or amountUsdc",
          example: { invoiceId: "0", amountUsdc: "100.00" },
        },
        { status: 400 }
      );
    }

    const amountNum = parseFloat(amountUsdc);
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { error: "amountUsdc must be a positive number" },
        { status: 400 }
      );
    }

    const accountNumber = await getBeneficiaryAccountNumber();
    const trackingRef = `INV-${invoiceId}`;

    console.log("[BE-008] Creating mock wire", {
      invoiceId,
      amountUsdc,
      trackingRef,
    });

    const result = await createMockWirePayment({
      amount: amountUsdc,
      currency: "USD",
      beneficiaryBank: { accountNumber },
      trackingRef,
    });

    await addPendingWire({
      invoiceId,
      amountUsdc,
      trackingRef,
      createDate: new Date().toISOString(),
    });

    console.log("[BE-008] Mock wire created", {
      trackingRef: result.trackingRef,
      status: result.status,
    });

    return NextResponse.json({
      trackingRef: result.trackingRef,
      status: result.status,
      amount: result.amount,
      message:
        "Mock wire initiated. Sandbox processes in batches (up to 15 min). Call POST /api/invoices/[invoiceId]/settle-from-mint when ready to repay onchain.",
    });
  } catch (err) {
    console.error("[BE-008] mock-wire failed", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Mock wire failed", details: message },
      { status: 500 }
    );
  }
}
