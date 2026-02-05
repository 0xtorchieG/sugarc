/**
 * Gateway transfer with operator-delegate signing.
 * Backend builds the burn intent, signs with Circle developer-controlled wallet, and forwards to Gateway API.
 * Uses Circle's signTypedData API (no private key needed).
 * @see docs/GATEWAY_DELEGATE_FLOW.md
 * @see https://developers.circle.com/wallets/sign-tx-evm
 */
import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import {
  GATEWAY_API_URL,
  GATEWAY_WALLET_ADDRESS,
  USDC_ADDRESSES,
} from "@/lib/gateway";
import { GATEWAY_IS_AUTHORIZED_ABI } from "@/lib/gateway-abi";
import {
  createBurnIntent,
  buildBurnIntentTypedData,
} from "@/lib/gateway-burn-intent";
import type { SourceChain } from "@/lib/gateway-burn-intent";

const RPC_URLS: Record<SourceChain, string> = {
  baseSepolia: "https://sepolia.base.org",
  sepolia: "https://rpc.sepolia.org",
};

/** Recursively convert bigint to string for JSON serialization */
function serializeForGateway(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return obj.toString();
  if (Array.isArray(obj)) return obj.map(serializeForGateway);
  if (typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, serializeForGateway(v)])
    );
  }
  return obj;
}

/** Serialize typed data for Circle signTypedData (bigints → strings) */
function serializeTypedDataForSigning(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return obj.toString();
  if (Array.isArray(obj)) return obj.map(serializeTypedDataForSigning);
  if (typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, serializeTypedDataForSigning(v)])
    );
  }
  return obj;
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.CIRCLE_API_KEY;
    const entitySecret = process.env.ENTITY_SECRET;
    const walletId = process.env.OPERATOR_WALLET_ID;

    if (!apiKey || !entitySecret) {
      return NextResponse.json(
        { error: "CIRCLE_API_KEY and ENTITY_SECRET required for operator wallet" },
        { status: 500 }
      );
    }
    if (!walletId) {
      return NextResponse.json(
        { error: "OPERATOR_WALLET_ID required (Circle developer-controlled wallet for delegate signing)" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      depositorAddress,
      recipientAddress,
      amountRaw,
      sourceChain,
    } = body as {
      depositorAddress: string;
      recipientAddress?: string;
      amountRaw: string;
      sourceChain: SourceChain;
    };

    if (!depositorAddress || !amountRaw || !sourceChain) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: depositorAddress, amountRaw, sourceChain",
        },
        { status: 400 }
      );
    }

    const client = initiateDeveloperControlledWalletsClient({
      apiKey,
      entitySecret,
    });

    const walletRes = await client.getWallet({ id: walletId });
    const operatorAddress = walletRes.data?.wallet?.address;
    if (!operatorAddress) {
      return NextResponse.json(
        { error: "Operator wallet not found" },
        { status: 500 }
      );
    }

    const burnIntent = createBurnIntent({
      sourceChain,
      depositorAddress,
      amountRaw: BigInt(amountRaw),
      recipientAddress: recipientAddress ?? depositorAddress,
      signerAddress: operatorAddress,
    });

    const typedData = buildBurnIntentTypedData(burnIntent);
    const dataForSign = {
      types: typedData.types,
      domain: typedData.domain,
      primaryType: typedData.primaryType,
      message: serializeTypedDataForSigning(typedData.message),
    };

    const signRes = await client.signTypedData({
      walletId,
      data: JSON.stringify(dataForSign),
      memo: "Gateway burn intent",
    });
    let signature = signRes.data?.signature;
    if (!signature) {
      return NextResponse.json(
        { error: "Failed to sign burn intent" },
        { status: 500 }
      );
    }

    // Ensure signature is hex (Gateway expects 0x-prefixed hex)
    if (!signature.startsWith("0x")) {
      try {
        const bytes = Buffer.from(signature, "base64");
        signature = "0x" + bytes.toString("hex");
      } catch {
        signature = "0x" + signature;
      }
    }

    // Verify signature recovers to operator address
    try {
      const recovered = ethers.verifyTypedData(
        typedData.domain,
        { BurnIntent: [...typedData.types.BurnIntent], TransferSpec: [...typedData.types.TransferSpec] },
        dataForSign.message as Record<string, unknown>,
        signature
      );
      if (recovered.toLowerCase() !== operatorAddress.toLowerCase()) {
        return NextResponse.json(
          {
            error: "Signature verification failed",
            message: `Recovered address ${recovered} does not match operator ${operatorAddress}`,
            operatorAddress,
          },
          { status: 500 }
        );
      }
    } catch (verifyErr) {
      console.error("[gateway/transfer-delegate] verifyTypedData", verifyErr);
      return NextResponse.json(
        {
          error: "Signature verification failed",
          message: verifyErr instanceof Error ? verifyErr.message : "Invalid signature format",
          operatorAddress,
        },
        { status: 500 }
      );
    }

    // Pre-check: operator must be authorized on-chain before Gateway API accepts
    const rpcUrl = RPC_URLS[sourceChain];
    const usdc = USDC_ADDRESSES[sourceChain];
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
    if (!authorized) {
      return NextResponse.json(
        {
          error: "Operator not authorized for depositor",
          message:
            "Call addDelegate(USDC, operatorAddress) from the depositor's wallet on the source chain first. Wait for confirmation before retrying.",
          operatorAddress,
          depositorAddress,
          sourceChain,
        },
        { status: 400 }
      );
    }

    const serialized = serializeForGateway({
      burnIntent,
      signature,
    }) as { burnIntent: object; signature: string };

    const response = await fetch(`${GATEWAY_API_URL}/v1/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([serialized]),
    });

    const data = await response.json();

    if (!response.ok) {
      const msg = data?.message ?? data?.error ?? "Gateway API error";
      const isAuthError =
        typeof msg === "string" &&
        msg.toLowerCase().includes("not authorized");
      return NextResponse.json(
        {
          ...data,
          ...(isAuthError && {
            operatorAddress,
            hint: "Operator wallet must be EOA. Verify addDelegate was confirmed on-chain.",
          }),
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[gateway/transfer-delegate]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
