/**
 * Shared logic for repaying an invoice onchain (BE-006, BE-008).
 * Uses Circle developer-controlled wallet as operator.
 */

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

export type RepayResult = {
  txHash: string;
  remaining: bigint;
};

/**
 * Repay an onchain invoice. Requires operator wallet with USDC.
 * 1. Approve USDC for vault
 * 2. repayInvoice(invoiceId, remaining)
 */
export async function repayInvoiceOnchain(
  invoiceId: bigint
): Promise<RepayResult> {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.ENTITY_SECRET;
  const walletId = process.env.OPERATOR_WALLET_ID;
  const rpcUrl = process.env.ARC_RPC ?? "https://rpc.testnet.arc.network";

  if (!apiKey || !entitySecret) {
    throw new Error("CIRCLE_API_KEY and ENTITY_SECRET required");
  }
  if (!walletId) {
    throw new Error("OPERATOR_WALLET_ID required");
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
  const repaidAmount = inv[4] as bigint;
  const statusEnum = Number(inv[7]);

  if (statusEnum === 1) {
    throw new Error("Invoice already repaid");
  }
  if (statusEnum !== 0) {
    throw new Error("Invoice not funded; cannot repay");
  }

  const remaining = faceAmount - repaidAmount;
  if (remaining <= 0n) {
    throw new Error("No remaining amount to repay");
  }

  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });

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
    throw new Error("Failed to create approve transaction");
  }
  const approveTxHash = await pollForTxHash(client, approveTxId);
  if (!approveTxHash) {
    throw new Error("Approve transaction did not complete in time");
  }

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
    throw new Error("Failed to create repay transaction");
  }
  const txHash = await pollForTxHash(client, repayTxId);
  if (!txHash) {
    throw new Error("Repay transaction did not complete in time");
  }

  const intent = await findIntentByOnchainInvoiceId(String(invoiceId));
  if (intent) {
    await updateIntentSettled(intent.intentId, txHash);
  }

  return { txHash, remaining };
}
