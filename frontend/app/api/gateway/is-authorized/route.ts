/**
 * Check if operator is authorized for a depositor's USDC balance on Gateway.
 * Used to skip addDelegate when already set.
 */
import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  GATEWAY_WALLET_ADDRESS,
  USDC_ADDRESSES,
} from "@/lib/gateway";
import { GATEWAY_IS_AUTHORIZED_ABI } from "@/lib/gateway-abi";
import type { SourceChain } from "@/lib/gateway-burn-intent";

const RPC_URLS: Record<SourceChain, string> = {
  baseSepolia: "https://sepolia.base.org",
  sepolia: "https://rpc.sepolia.org",
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const depositorAddress = searchParams.get("depositor");
    const operatorAddress = searchParams.get("operator");
    const chain = searchParams.get("chain") as SourceChain | null;

    if (!depositorAddress || !operatorAddress || !chain) {
      return NextResponse.json(
        { error: "Missing depositor, operator, or chain" },
        { status: 400 }
      );
    }

    if (chain !== "baseSepolia" && chain !== "sepolia") {
      return NextResponse.json(
        { error: "Unsupported chain" },
        { status: 400 }
      );
    }

    const rpcUrl = RPC_URLS[chain];
    const usdc = USDC_ADDRESSES[chain];
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const gateway = new ethers.Contract(
      GATEWAY_WALLET_ADDRESS,
      GATEWAY_IS_AUTHORIZED_ABI,
      provider
    );

    const authorized = await gateway.isAuthorizedForBalance(
      usdc,
      depositorAddress,
      operatorAddress
    );

    return NextResponse.json({ authorized: Boolean(authorized) });
  } catch (error) {
    console.error("[gateway/is-authorized]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
