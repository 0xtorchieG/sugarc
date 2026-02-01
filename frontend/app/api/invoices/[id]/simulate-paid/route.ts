import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import {
  findIntentByOnchainInvoiceId,
  updateIntentSettled,
} from "@/lib/invoice-intent-storage";
import { SUGARC_POOL_VAULT_ADDRESS, ARC_USDC_ADDRESS } from "@/lib/contracts";

async function pollForTxHash(
  client: ReturnType<typeof initiateDeveloperControlledWalletsClient>,
  transactionId: string,
  maxAttempts = 60
): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await client.getTransaction({ id: transactionId });
    const tx = res.data?.transaction;
    if (!tx) return null;
    if (tx.state === "COMPLETE" || tx.state === "CONFIRMED") {
      return tx.txHash ?? null;
    }
    if (tx.state === "FAILED") {
      throw new Error(tx.errorReason ?? "Transaction failed");
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}

/**
 * POST /api/invoices/[id]/simulate-paid — id = onchain invoiceId (BE-006)
 * Reads onchain invoice, computes remaining = faceAmount - repaidAmount. Then (same as LP deposit):
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
    if (invoiceId < 0n) {
      return NextResponse.json({ error: "Invalid invoiceId" }, { status: 400 });
    }

    const apiKey = process.env.CIRCLE_API_KEY;
    const entitySecret = process.env.ENTITY_SECRET;
    const walletId = process.env.OPERATOR_WALLET_ID;
    const rpcUrl = process.env.ARC_RPC ?? "https://rpc.testnet.arc.network";

    if (!apiKey || !entitySecret) {
      return NextResponse.json(
        { error: "CIRCLE_API_KEY and ENTITY_SECRET required" },
        { status: 500 }
      );
    }
    if (!walletId) {
      return NextResponse.json(
        { error: "OPERATOR_WALLET_ID required" },
        { status: 500 }
      );
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const vaultAbi = [
      {
        inputs: [{ internalType: "uint256", name: "invoiceId", type: "uint256" }],
        name: "getInvoice",
        outputs: [
          { internalType: "uint8", name: "poolId", type: "uint8" },
          { internalType: "address", name: "smb", type: "address" },
          { internalType: "uint256", name: "faceAmount", type: "uint256" },
          { internalType: "uint256", name: "advanceAmount", type: "uint256" },
          { internalType: "uint256", name: "repaidAmount", type: "uint256" },
          { internalType: "uint16", name: "feeBps", type: "uint16" },
          { internalType: "uint256", name: "dueDate", type: "uint256" },
          { internalType: "uint8", name: "status", type: "uint8" },
          { internalType: "bytes32", name: "refHash", type: "bytes32" },
        ],
        stateMutability: "view",
        type: "function",
      },
    ];
    const vault = new ethers.Contract(
      SUGARC_POOL_VAULT_ADDRESS,
      vaultAbi,
      provider
    );

    const inv = await vault.getInvoice(invoiceId);
    const faceAmount = inv[2] as bigint;
    const repaidAmount = inv[4] as bigint; // getInvoice: poolId, smb, faceAmount, advanceAmount, repaidAmount, ...
    const statusEnum = Number(inv[7]);

    // InvoiceStatus.Funded = 0, Repaid = 1
    if (statusEnum === 1) {
      return NextResponse.json(
        { error: "Invoice already repaid" },
        { status: 400 }
      );
    }
    if (statusEnum !== 0) {
      return NextResponse.json(
        { error: "Invoice not funded; cannot repay" },
        { status: 400 }
      );
    }

    let remaining = faceAmount - repaidAmount;
    if (remaining <= 0n) {
      return NextResponse.json(
        { error: "No remaining amount to repay" },
        { status: 400 }
      );
    }

    const client = initiateDeveloperControlledWalletsClient({
      apiKey,
      entitySecret,
    });

    // 1. Approve USDC for the vault (same pattern as LP deposit: approve then transfer)
    const approveRes = await client.createContractExecutionTransaction({
      idempotencyKey: crypto.randomUUID(),
      walletId,
      contractAddress: ARC_USDC_ADDRESS,
      abiFunctionSignature: "approve(address,uint256)",
      abiParameters: [SUGARC_POOL_VAULT_ADDRESS, remaining.toString()],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });
    const approveTxId = approveRes.data?.id;
    if (!approveTxId) {
      return NextResponse.json(
        { error: "Failed to create approve transaction", details: approveRes },
        { status: 500 }
      );
    }
    const approveTxHash = await pollForTxHash(client, approveTxId);
    if (!approveTxHash) {
      return NextResponse.json(
        { error: "Approve transaction did not complete in time" },
        { status: 504 }
      );
    }

    // 2. Repay invoice (vault will pull USDC from operator wallet)
    const repayRes = await client.createContractExecutionTransaction({
      idempotencyKey: crypto.randomUUID(),
      walletId,
      contractAddress: SUGARC_POOL_VAULT_ADDRESS,
      abiFunctionSignature: "repayInvoice(uint256,uint256)",
      abiParameters: [invoiceId.toString(), remaining.toString()],
      fee: { type: "level", config: { feeLevel: "HIGH" } },
    });
    const repayTxId = repayRes.data?.id;
    if (!repayTxId) {
      return NextResponse.json(
        { error: "Failed to create repay transaction", details: repayRes },
        { status: 500 }
      );
    }
    const txHash = await pollForTxHash(client, repayTxId);
    if (!txHash) {
      return NextResponse.json(
        { error: "Repay transaction did not complete in time" },
        { status: 504 }
      );
    }

    const intent = await findIntentByOnchainInvoiceId(String(invoiceId));
    if (intent) {
      await updateIntentSettled(intent.intentId, txHash);
    }

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
