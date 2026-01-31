import { NextRequest, NextResponse } from "next/server";

/**
 * Create invoice intent (API stub).
 * SMB must explicitly accept offer before funding.
 * POST body: SmbLockedOffer (input + pricing).
 * Returns: { invoiceId }.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { input, pricing } = body as { input?: unknown; pricing?: unknown };

    if (!input || !pricing) {
      return NextResponse.json(
        { error: "Missing input or pricing" },
        { status: 400 }
      );
    }

    // Stub: validate shape minimally, return mock invoiceId
    const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    return NextResponse.json({ invoiceId });
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
