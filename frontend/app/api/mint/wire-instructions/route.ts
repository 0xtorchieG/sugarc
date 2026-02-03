import { NextResponse } from "next/server";
import {
  listWireAccounts,
  getWireInstructions,
  type WireInstructions,
} from "@/lib/circle-mint";

/**
 * GET /api/mint/wire-instructions
 * Returns full wire instructions for the pay page (beneficiary, bank details).
 */
export async function GET() {
  try {
    const wireAccountId =
      process.env.CIRCLE_MINT_WIRE_ACCOUNT_ID ??
      (await listWireAccounts()).find(
        (a) => a.status === "complete" || a.status === "pending"
      )?.id;
    if (!wireAccountId) {
      return NextResponse.json(
        { error: "No wire account configured" },
        { status: 500 }
      );
    }
    const instructions = await getWireInstructions(wireAccountId);
    return NextResponse.json({
      trackingRef: instructions.trackingRef,
      beneficiary: instructions.beneficiary,
      beneficiaryBank: instructions.beneficiaryBank,
    } as WireInstructions);
  } catch (err) {
    console.error("GET /api/mint/wire-instructions", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch wire instructions", details: message },
      { status: 500 }
    );
  }
}
