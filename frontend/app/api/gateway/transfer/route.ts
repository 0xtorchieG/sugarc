/**
 * Circle Gateway transfer attestation proxy.
 * Receives signed burn intents from the frontend and forwards to the Gateway API.
 * @see https://developers.circle.com/api-reference/gateway/all/create-transfer-attestation
 */
import { NextResponse } from "next/server";
import { GATEWAY_API_URL } from "@/lib/gateway";

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

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!Array.isArray(body) || body.length === 0) {
      return NextResponse.json(
        { error: "Request body must be a non-empty array of signed burn intents" },
        { status: 400 }
      );
    }

    for (let i = 0; i < body.length; i++) {
      const item = body[i];
      if (
        !item ||
        typeof item !== "object" ||
        !("burnIntent" in item) ||
        !("signature" in item)
      ) {
        return NextResponse.json(
          { error: `Item ${i}: must have burnIntent and signature` },
          { status: 400 }
        );
      }
    }

    const serialized = serializeForGateway(body) as object;
    const response = await fetch(`${GATEWAY_API_URL}/v1/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(serialized),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        data ?? { error: "Gateway API error" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[gateway/transfer]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
