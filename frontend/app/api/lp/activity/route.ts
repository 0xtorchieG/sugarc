import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { SUGARC_POOL_VAULT_ADDRESS } from "@/lib/contracts";

const USDC_DECIMALS = 6;
const POOL_NAMES: Record<number, string> = {
  0: "Prime",
  1: "Standard",
  2: "High Yield",
};
const INVOICE_REPAID_ABI = [
  "event InvoiceRepaid(uint256 indexed invoiceId, uint8 indexed poolId, address indexed payer, uint256 amountApplied, bool fullyRepaid, uint256 amountExcess)",
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

const CACHE_TTL_MS = 25_000; // 25s to stay under 20 req/s when LP page loads pools + activity
const EMPTY_CACHE_TTL_MS = 10_000; // after error, avoid retries for 10s
const MAX_GET_INVOICE_FOR_FEES = 5; // cap getInvoice calls for earned-fees calc (rate limit)
let cache: {
  data: { repayments: unknown[]; totalEarnedFeesUsdc?: string };
  expires: number;
} | null = null;

/**
 * GET /api/lp/activity
 * Returns recent InvoiceRepaid events from chain. Response cached to avoid RPC rate limits.
 */
export async function GET() {
  const now = Date.now();
  if (cache && cache.expires > now) {
    return NextResponse.json(cache.data);
  }

  try {
    const rpcUrl = process.env.ARC_RPC ?? "https://rpc.testnet.arc.network";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const vault = new ethers.Contract(
      SUGARC_POOL_VAULT_ADDRESS,
      INVOICE_REPAID_ABI,
      provider
    );

    // RPC limit: eth_getLogs is typically limited to 10,000 blocks
    const blockRange = 10_000;
    const latest = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latest - blockRange);

    const logs = await vault.queryFilter(
      vault.filters.InvoiceRepaid(),
      fromBlock,
      latest
    );

    const fullyRepaidInvoiceIds: bigint[] = [];
    const repayments = logs
      .map((log) => {
        const parsed = vault.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        if (!parsed) return null;
        const { invoiceId, poolId, amountApplied, fullyRepaid } = parsed.args;
        if (fullyRepaid) fullyRepaidInvoiceIds.push(invoiceId);
        const block = log.blockNumber;
        return {
          id: `repay-${invoiceId}-${log.transactionHash}`,
          date: "", // filled below from block
          amount: `${Number(amountApplied) / 10 ** USDC_DECIMALS} USDC`,
          pool: POOL_NAMES[Number(poolId)] ?? "—",
          txHash: log.transactionHash ?? undefined,
          type: "repayment" as const,
          block,
        };
      })
      .filter(Boolean) as {
      id: string;
      date: string;
      amount: string;
      pool: string;
      txHash?: string;
      type: "repayment";
      block: number;
    }[];

    // Earned fees = sum over fully-repaid invoices of (faceAmount - advanceAmount); contract holds this in the vault
    let totalFeesNum = 0;
    const uniqueRepaidIds = [...new Set(fullyRepaidInvoiceIds)];
    const toQuery = uniqueRepaidIds.slice(0, MAX_GET_INVOICE_FOR_FEES);
    for (const invoiceId of toQuery) {
      try {
        const inv = await vault.getInvoice(invoiceId);
        const faceAmount = inv[2] as bigint;
        const advanceAmount = inv[3] as bigint;
        const feeWei = faceAmount - advanceAmount;
        totalFeesNum += Number(feeWei) / 10 ** USDC_DECIMALS;
      } catch {
        // skip if getInvoice fails (e.g. reorg)
      }
    }
    let totalEarnedFeesUsdc = totalFeesNum.toFixed(2);
    if (uniqueRepaidIds.length > MAX_GET_INVOICE_FOR_FEES) {
      totalEarnedFeesUsdc += "+"; // indicate more fees exist
    }

    // Fetch block timestamps only for first 5 to reduce RPC calls (rate limit)
    const toFetch = repayments.slice(0, 5);
    const blocks = await Promise.all(
      toFetch.map((r) => provider.getBlock(r.block))
    );
    toFetch.forEach((r, i) => {
      const b = blocks[i];
      r.date = b?.timestamp
        ? new Date(b.timestamp * 1000).toISOString().slice(0, 10)
        : "—";
    });
    repayments.slice(5).forEach((r) => {
      r.date = "—";
    });

    // Newest first
    repayments.sort((a, b) => b.block - a.block);

    const data = {
      repayments: repayments.map(({ block, ...rest }) => rest),
      totalEarnedFeesUsdc,
    };
    cache = { data, expires: now + CACHE_TTL_MS };
    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /api/lp/activity", err);
    // Cache empty result so we don't hammer RPC on retries (e.g. rate limit)
    cache = {
      data: { repayments: [], totalEarnedFeesUsdc: "0.00" },
      expires: now + EMPTY_CACHE_TTL_MS,
    };
    return NextResponse.json(
      { error: "Failed to fetch activity", repayments: [], totalEarnedFeesUsdc: "0.00" },
      { status: 200 }
    );
  }
}
