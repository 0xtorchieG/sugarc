import { NextRequest, NextResponse } from "next/server";
import { listWireDeposits } from "@/lib/circle-mint";
import {
  findPendingWireByInvoice,
  removePendingWire,
} from "@/lib/pending-mint-wires";
import { repayInvoiceOnchain } from "@/lib/repay-invoice";

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 24; // 2 min

function amountMatches(a: string, b: string, tolerance = 0.01): boolean {
  const na = parseFloat(a);
  const nb = parseFloat(b);
  if (Number.isNaN(na) || Number.isNaN(nb)) return false;
  return Math.abs(na - nb) < tolerance;
}

/**
 * POST /api/invoices/[id]/settle-from-mint (BE-008)
 * When Circle Mint wire deposit is complete, repay invoice onchain.
 * Query: ?force=true — skip wire check, repay immediately (demo mode).
 *
 * Flow: 1) POST /api/mint/mock-wire 2) wait for wire (up to 15 min) 3) POST this
 * Or: ?force=true to skip wire check and repay (operator wallet must have USDC).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id: invoiceIdParam } =
      context.params instanceof Promise ? await context.params : context.params;
    const force =
      request.nextUrl.searchParams.get("force")?.toLowerCase() === "true";

    const invoiceId = BigInt(invoiceIdParam);
    if (invoiceId < BigInt(0)) {
      return NextResponse.json({ error: "Invalid invoiceId" }, { status: 400 });
    }

    if (force) {
      console.log("[BE-008] settle-from-mint: force=true, skipping wire check");
    } else {
      const pending = await findPendingWireByInvoice(String(invoiceId));
      if (!pending) {
        return NextResponse.json(
          {
            error:
              "No pending wire for this invoice. Call POST /api/mint/mock-wire first, or use ?force=true to repay without wire.",
          },
          { status: 400 }
        );
      }

      // Poll for wire deposit complete
      const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      let found = false;
      for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
        const deposits = await listWireDeposits({
          from: since,
          pageSize: 20,
        });
        const complete = deposits.find(
          (d) =>
            (d.status === "complete" || d.status === "completed") &&
            amountMatches(d.amount.amount, pending.amountUsdc)
        );
        if (complete) {
          found = true;
          console.log("[BE-008] Wire deposit complete", {
            depositId: complete.id,
            amount: complete.amount,
          });
          break;
        }
        if (i < MAX_POLL_ATTEMPTS - 1) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        }
      }

      if (!found) {
        return NextResponse.json(
          {
            error:
              "Wire deposit not yet complete. Sandbox processes in batches (up to 15 min). Retry later or use ?force=true for demo.",
          },
          { status: 202 }
        );
      }

      await removePendingWire(String(invoiceId));
    }

    const { txHash } = await repayInvoiceOnchain(invoiceId);

    console.log("[BE-008] settle-from-mint: repaid onchain", {
      invoiceId: String(invoiceId),
      txHash,
    });

    return NextResponse.json({ txHash });
  } catch (err) {
    console.error("[BE-008] settle-from-mint failed", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Settle from mint failed", details: message },
      { status: 500 }
    );
  }
}
