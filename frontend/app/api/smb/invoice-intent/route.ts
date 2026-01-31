import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { keccak256 } from "ethereum-cryptography/keccak";
import { utf8ToBytes } from "ethereum-cryptography/utils";
import {
  addIntent,
  findIntentById,
  findIntentsByWallet,
  existsByRefHash,
  type InvoiceIntentRecord,
  type InvoiceIntentStatus,
} from "@/lib/invoice-intent-storage";

const creditRatingSchema = z.enum([
  "AAA",
  "AA",
  "A",
  "BBB",
  "BB",
  "B",
  "Unknown",
]);

const poolKindSchema = z.enum(["prime", "standard", "highYield"]);

const inputSchema = z.object({
  amountUsdc: z.number().positive(),
  dueDate: z.string().min(1),
  payerCreditRating: creditRatingSchema,
});

const pricingSchema = z.object({
  eligiblePool: poolKindSchema,
  eligiblePoolName: z.string(),
  discountPercent: z.number(),
  cashAdvancedUsdc: z.number(),
  derivedAprPercent: z.number(),
  tenorDays: z.number(),
});

const postBodySchema = z.object({
  input: inputSchema,
  pricing: pricingSchema,
  smbAddress: z.string().optional(),
});

function toBytes32Hex(bytes: Uint8Array): string {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return "0x" + hex;
}

function computeRefHash(
  intentId: string,
  smbAddress: string,
  faceAmount: number,
  dueDate: string,
  poolId: string
): string {
  const payload =
    intentId + smbAddress + String(faceAmount) + dueDate + poolId;
  const hash = keccak256(utf8ToBytes(payload));
  return toBytes32Hex(hash);
}

/**
 * Create invoice intent (BE-002).
 * POST body: { input, pricing, smbAddress? }.
 * Returns: { intentId, refHash, status } (+ optional full object).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = postBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { input, pricing, smbAddress = "" } = parsed.data;

    const intentId = `intent_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const poolId = pricing.eligiblePool;
    const refHash = computeRefHash(
      intentId,
      smbAddress,
      input.amountUsdc,
      input.dueDate,
      poolId
    );

    // Optional duplicate prevention: reject if same refHash already exists
    const duplicate = await existsByRefHash(refHash);
    if (duplicate) {
      return NextResponse.json(
        { error: "Duplicate intent: same refHash already exists" },
        { status: 409 }
      );
    }

    const status: InvoiceIntentStatus = "pending";
    const record: InvoiceIntentRecord = {
      intentId,
      refHash,
      status,
      smbAddress,
      input: {
        amountUsdc: input.amountUsdc,
        dueDate: input.dueDate,
        payerCreditRating: input.payerCreditRating,
      },
      pricing: {
        eligiblePool: pricing.eligiblePool,
        eligiblePoolName: pricing.eligiblePoolName,
        discountPercent: pricing.discountPercent,
        cashAdvancedUsdc: pricing.cashAdvancedUsdc,
        derivedAprPercent: pricing.derivedAprPercent,
        tenorDays: pricing.tenorDays,
      },
      createdAt: new Date().toISOString(),
    };

    await addIntent(record);

    return NextResponse.json({
      intentId,
      refHash,
      status,
      ...(request.nextUrl.searchParams.get("full") === "true" ? { intent: record } : {}),
    });
  } catch (err) {
    console.error("invoice-intent POST", err);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}

/**
 * GET: fetch intent by intentId (?intentId=...) or list intents for wallet (?wallet=...).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const intentId = searchParams.get("intentId");
    const wallet = searchParams.get("wallet");

    if (intentId) {
      const intent = await findIntentById(intentId);
      if (!intent) {
        return NextResponse.json({ error: "Intent not found" }, { status: 404 });
      }
      return NextResponse.json(intent);
    }

    if (wallet) {
      const intents = await findIntentsByWallet(wallet);
      return NextResponse.json({ intents });
    }

    return NextResponse.json(
      { error: "Provide intentId or wallet query parameter" },
      { status: 400 }
    );
  } catch (err) {
    console.error("invoice-intent GET", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
