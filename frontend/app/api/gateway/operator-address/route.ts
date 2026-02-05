/**
 * Returns the operator delegate address from the Circle developer-controlled wallet.
 * Used by frontend for addDelegate(USDC, operatorAddress).
 * @see https://developers.circle.com/wallets/sign-tx-evm
 */
import { NextResponse } from "next/server";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.ENTITY_SECRET;
  const walletId = process.env.OPERATOR_WALLET_ID;

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

  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });
  const res = await client.getWallet({ id: walletId });
  const address = res.data?.wallet?.address;
  if (!address) {
    return NextResponse.json(
      { error: "Operator wallet not found" },
      { status: 500 }
    );
  }
  return NextResponse.json({ address });
}
