import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { findIntentsByWallet } from "@/lib/invoice-intent-storage";
import { SUGARC_POOL_VAULT_ADDRESS, SUGARC_POOL_VAULT_ABI } from "@/lib/contracts";

const USDC_DECIMALS = 6;
const POOL_NAMES: Record<number, string> = { 0: "Prime", 1: "Standard", 2: "High Yield" };

/**
 * GET /api/smb/stats?wallet=0x...
 * Returns SMB stats and factored invoices from stored intents + on-chain getInvoice.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletParam = searchParams.get("wallet");
    if (!walletParam || !ethers.isAddress(walletParam)) {
      return NextResponse.json({ error: "Valid wallet query required" }, { status: 400 });
    }

    const intents = await findIntentsByWallet(walletParam);
    const fundedIntents = intents.filter(
      (i) => (i.status === "funded" || i.status === "settled") && i.onchainInvoiceId
    );

    let totalFactoredUsdc = 0;
    let totalReceivedUsdc = 0;
    let activeCount = 0;
    let settledCount = 0;
    const invoices: {
      id: string;
      amountUsdc: string;
      receivedUsdc: string;
      status: "active" | "settled" | "pending";
      dueDate: string;
      factoredAt: string;
      pool: string;
    }[] = [];

    if (fundedIntents.length > 0) {
      const rpcUrl = process.env.ARC_RPC ?? "https://rpc.testnet.arc.network";
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const vault = new ethers.Contract(SUGARC_POOL_VAULT_ADDRESS, SUGARC_POOL_VAULT_ABI as ethers.InterfaceAbi, provider);

      for (const intent of fundedIntents) {
        const invoiceId = intent.onchainInvoiceId!;
        try {
          const inv = await vault.getInvoice(invoiceId);
          const poolId = Number(inv[0]);
          const faceAmount = inv[2];
          const advanceAmount = inv[3];
          const dueDate = inv[6];
          const statusEnum = Number(inv[7]);

          const faceNum = Number(ethers.formatUnits(faceAmount, USDC_DECIMALS));
          const advanceNum = Number(ethers.formatUnits(advanceAmount, USDC_DECIMALS));
          const isRepaid = statusEnum === 1;

          totalFactoredUsdc += faceNum;
          totalReceivedUsdc += advanceNum;
          if (isRepaid) settledCount++; else activeCount++;

          const dueDateStr = dueDate ? new Date(Number(dueDate) * 1000).toISOString().slice(0, 10) : intent.input.dueDate;
          invoices.push({
            id: intent.intentId,
            amountUsdc: faceNum.toFixed(2),
            receivedUsdc: advanceNum.toFixed(2),
            status: isRepaid ? "settled" : "active",
            dueDate: dueDateStr,
            factoredAt: intent.createdAt?.slice(0, 10) ?? "",
            pool: POOL_NAMES[poolId] ?? "—",
          });
        } catch {
          // Fallback from intent if getInvoice fails
          totalFactoredUsdc += intent.input.amountUsdc ?? 0;
          totalReceivedUsdc += intent.pricing?.cashAdvancedUsdc ?? 0;
          activeCount += 1;
          invoices.push({
            id: intent.intentId,
            amountUsdc: String(intent.input.amountUsdc ?? 0),
            receivedUsdc: String(intent.pricing?.cashAdvancedUsdc ?? 0),
            status: "active",
            dueDate: intent.input.dueDate ?? "",
            factoredAt: intent.createdAt?.slice(0, 10) ?? "",
            pool: intent.pricing?.eligiblePoolName ?? "—",
          });
        }
      }
    }

    const stats = {
      totalFactoredUsdc: totalFactoredUsdc.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      totalReceivedUsdc: totalReceivedUsdc.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      activeInvoicesCount: activeCount,
      settledInvoicesCount: settledCount,
    };

    return NextResponse.json({ stats, invoices });
  } catch (err) {
    console.error("GET /api/smb/stats", err);
    return NextResponse.json({ error: "Failed to fetch SMB stats" }, { status: 500 });
  }
}
