import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { SUGARC_POOL_VAULT_ADDRESS } from "@/lib/contracts";

const USDC_DECIMALS = 6;
const VAULT_ABI = [
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

/** InvoiceStatus: Funded = 0, Repaid = 1 */
const STATUS_FUNDED = 0;
const STATUS_REPAID = 1;

/**
 * GET /api/invoices/[id]/public
 * Returns public invoice info for the pay page. id = onchain invoice ID.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } =
      context.params instanceof Promise ? await context.params : context.params;
    const invoiceId = BigInt(id);
    if (invoiceId < BigInt(0)) {
      return NextResponse.json({ error: "Invalid invoice ID" }, { status: 400 });
    }

    const rpcUrl = process.env.ARC_RPC ?? "https://rpc.testnet.arc.network";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const vault = new ethers.Contract(
      SUGARC_POOL_VAULT_ADDRESS,
      VAULT_ABI,
      provider
    );

    const inv = await vault.getInvoice(invoiceId);
    const faceAmount = inv[2] as bigint;
    const repaidAmount = inv[4] as bigint;
    const statusEnum = Number(inv[7]);

    const remaining = faceAmount - repaidAmount;
    const faceAmountUsdc = ethers.formatUnits(faceAmount, USDC_DECIMALS);
    const remainingUsdc = ethers.formatUnits(
      remaining > 0n ? remaining : 0n,
      USDC_DECIMALS
    );

    return NextResponse.json({
      invoiceId: id,
      faceAmountUsdc,
      repaidAmountUsdc: ethers.formatUnits(repaidAmount, USDC_DECIMALS),
      remainingUsdc,
      status: statusEnum === STATUS_REPAID ? "repaid" : "funded",
      canPay: statusEnum === STATUS_FUNDED && remaining > 0n,
    });
  } catch (err) {
    console.error("GET /api/invoices/[id]/public", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch invoice", details: message },
      { status: 500 }
    );
  }
}
