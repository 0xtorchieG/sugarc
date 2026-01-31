import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import {
  findIntentById,
  updateIntentFunded,
} from "@/lib/invoice-intent-storage";
import { SUGARC_POOL_VAULT_ADDRESS } from "@/lib/contracts";

const POOL_ID_MAP: Record<string, number> = {
  prime: 0,
  standard: 1,
  highYield: 2,
};

const USDC_DECIMALS = 6;

function getInvoiceFundedEventAbi() {
  return [
    {
      anonymous: false,
      inputs: [
        { indexed: true, internalType: "uint256", name: "invoiceId", type: "uint256" },
        { indexed: true, internalType: "uint8", name: "poolId", type: "uint8" },
        { indexed: true, internalType: "address", name: "smb", type: "address" },
        { indexed: false, internalType: "uint256", name: "advanceAmount", type: "uint256" },
        { indexed: false, internalType: "uint256", name: "faceAmount", type: "uint256" },
        { indexed: false, internalType: "uint256", name: "dueDate", type: "uint256" },
        { indexed: false, internalType: "uint16", name: "feeBps", type: "uint16" },
        { indexed: false, internalType: "bytes32", name: "refHash", type: "bytes32" },
      ],
      name: "InvoiceFunded",
      type: "event",
    },
  ];
}

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
 * POST /api/invoices/[intentId]/fund
 * Load intent, call PoolVault.fundInvoice via Circle dev-controlled wallet, persist txHash + onchainInvoiceId.
 * Idempotent: if already funded, returns existing result.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ intentId: string }> | { intentId: string } }
) {
  try {
    const { intentId } =
      context.params instanceof Promise ? await context.params : context.params;
    const intent = await findIntentById(intentId);
    if (!intent) {
      return NextResponse.json({ error: "Intent not found" }, { status: 404 });
    }

    if (intent.status === "funded" && intent.txHash && intent.onchainInvoiceId) {
      return NextResponse.json({
        txHash: intent.txHash,
        onchainInvoiceId: intent.onchainInvoiceId,
      });
    }

    if (!intent.smbAddress || !ethers.isAddress(intent.smbAddress)) {
      return NextResponse.json(
        { error: "Intent has no valid smbAddress; cannot fund" },
        { status: 400 }
      );
    }

    const apiKey = process.env.CIRCLE_API_KEY;
    const entitySecret = process.env.ENTITY_SECRET;
    const walletId = process.env.OPERATOR_WALLET_ID;
    const rpcUrl = process.env.ARC_RPC ?? "https://rpc.testnet.arc.network";

    if (!apiKey || !entitySecret) {
      return NextResponse.json(
        { error: "CIRCLE_API_KEY and ENTITY_SECRET required for Circle dev-controlled wallet" },
        { status: 500 }
      );
    }
    if (!walletId) {
      return NextResponse.json(
        { error: "OPERATOR_WALLET_ID required (Circle developer-controlled wallet ID)" },
        { status: 500 }
      );
    }

    const poolId = POOL_ID_MAP[intent.pricing.eligiblePool];
    if (poolId === undefined) {
      return NextResponse.json(
        { error: `Unknown pool: ${intent.pricing.eligiblePool}` },
        { status: 400 }
      );
    }

    const faceAmount = ethers.parseUnits(
      String(intent.input.amountUsdc),
      USDC_DECIMALS
    );
    const advanceAmount = ethers.parseUnits(
      String(intent.pricing.cashAdvancedUsdc),
      USDC_DECIMALS
    );
    const feeBps = Math.round(intent.pricing.discountPercent * 100);
    const dueDateStr = intent.input.dueDate;
    const dueDate = Math.floor(
      new Date(dueDateStr + "T23:59:59Z").getTime() / 1000
    );
    const refHashBytes32 = intent.refHash.startsWith("0x")
      ? intent.refHash
      : "0x" + intent.refHash;
    if (refHashBytes32.length !== 66) {
      return NextResponse.json(
        { error: "Invalid refHash format" },
        { status: 400 }
      );
    }

    // Pre-check: dueDate must be in the future (contract reverts DueDateNotFuture)
    const now = Math.floor(Date.now() / 1000);
    if (dueDate <= now) {
      return NextResponse.json(
        {
          error: "Due date must be in the future",
          details: `dueDate ${dueDate} <= now ${now}`,
        },
        { status: 400 }
      );
    }

    // Pre-check: verify pool has enough liquidity (avoids opaque ESTIMATION_ERROR)
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const vaultAbi = [
      {
        inputs: [{ internalType: "uint8", name: "poolId", type: "uint8" }],
        name: "getPool",
        outputs: [
          { internalType: "uint256", name: "totalDeposits", type: "uint256" },
          { internalType: "uint256", name: "totalOutstanding", type: "uint256" },
          { internalType: "uint256", name: "availableLiquidity", type: "uint256" },
        ],
        stateMutability: "view",
        type: "function",
      },
    ];
    const vault = new ethers.Contract(SUGARC_POOL_VAULT_ADDRESS, vaultAbi, provider);
    const [, , availableLiquidity] = await vault.getPool(poolId);
    if (availableLiquidity < advanceAmount) {
      return NextResponse.json(
        {
          error: "Insufficient pool liquidity",
          details: `Pool ${intent.pricing.eligiblePool} has ${ethers.formatUnits(availableLiquidity, USDC_DECIMALS)} USDC available; need ${ethers.formatUnits(advanceAmount, USDC_DECIMALS)} USDC. LPs must deposit first.`,
        },
        { status: 400 }
      );
    }

    const client = initiateDeveloperControlledWalletsClient({
      apiKey,
      entitySecret,
    });

    const createRes = await client.createContractExecutionTransaction({
      idempotencyKey: crypto.randomUUID(),
      walletId,
      contractAddress: SUGARC_POOL_VAULT_ADDRESS,
      abiFunctionSignature:
        "fundInvoice(uint8,address,uint256,uint256,uint16,uint256,bytes32)",
      abiParameters: [
        poolId,
        intent.smbAddress,
        faceAmount.toString(),
        advanceAmount.toString(),
        feeBps,
        dueDate.toString(),
        refHashBytes32,
      ],
      fee: { type: "level", config: { feeLevel: "HIGH" } },
    });

    const transactionId = createRes.data?.id;
    if (!transactionId) {
      return NextResponse.json(
        { error: "Failed to create transaction", details: createRes },
        { status: 500 }
      );
    }

    const txHash = await pollForTxHash(client, transactionId);
    if (!txHash) {
      return NextResponse.json(
        { error: "Transaction did not complete in time" },
        { status: 504 }
      );
    }

    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return NextResponse.json(
        { error: "Receipt not found for txHash" },
        { status: 500 }
      );
    }

    const iface = new ethers.Interface(getInvoiceFundedEventAbi());
    let onchainInvoiceId: string | null = null;
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        if (parsed) {
          onchainInvoiceId = String(parsed.args.invoiceId);
          break;
        }
      } catch {
        // not our event
      }
    }

    if (onchainInvoiceId === null) {
      return NextResponse.json(
        { error: "InvoiceFunded event not found in receipt" },
        { status: 500 }
      );
    }

    await updateIntentFunded(intentId, txHash, onchainInvoiceId);

    return NextResponse.json({
      txHash,
      onchainInvoiceId,
    });
  } catch (err) {
    console.error("fund POST", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Funding failed", details: message },
      { status: 500 }
    );
  }
}
