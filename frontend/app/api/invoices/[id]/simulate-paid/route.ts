import { NextRequest, NextResponse } from "next/server";
import { repayInvoiceOnchain } from "@/lib/repay-invoice";

/**
 * POST /api/invoices/[id]/simulate-paid — id = onchain invoiceId (BE-006)
 * Reads onchain invoice, computes remaining = faceAmount - repaidAmount. Then:
 * 1. USDC.approve(SugarcPoolVault, remaining) via operator wallet
 * 2. repayInvoice(invoiceId, remaining) via operator wallet
 * Returns { txHash } (repay tx) and updates stored intent status to settled if linked.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id: invoiceIdParam } =
      context.params instanceof Promise ? await context.params : context.params;

    const invoiceId = BigInt(invoiceIdParam);
    if (invoiceId < BigInt(0)) {
      return NextResponse.json({ error: "Invalid invoiceId" }, { status: 400 });
    }

    const { txHash } = await repayInvoiceOnchain(invoiceId);
    return NextResponse.json({ txHash });
  } catch (err) {
    console.error("POST /api/invoices/[id]/simulate-paid", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Simulate paid failed", details: message },
      { status: 500 }
    );
  }
}
