import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

export type ParsedInvoiceFields = {
  customerEmail?: string;
  dueDate?: string;
  faceAmount?: number;
  invoiceNumber?: string;
  payerName?: string;
  currency?: string;
};

const EMAIL_REGEX =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const DATE_PATTERNS = [
  /\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/g,
  /\b(0?[1-9]|[12]\d|3[01])[-/](0?[1-9]|1[0-2])[-/](20\d{2})\b/g,
  /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+20\d{2}\b/gi,
  /\b\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+20\d{2}\b/gi,
];
const CURRENCY_AMOUNT_REGEX =
  /\$?\s*([1-9]\d{0,2}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)\s*(?:USD|USDC|usd|usdc)?/g;
const INVOICE_NUMBER_KEYWORDS = /(?:invoice\s*#?|inv\.?\s*#?|number\s*#?|no\.?)\s*[:#]?\s*([A-Z0-9-_]+)/gi;

function extractEmail(text: string): string | undefined {
  const match = text.match(EMAIL_REGEX);
  return match?.[0];
}

function extractDueDate(text: string): string | undefined {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[0]) {
      const raw = match[0];
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime()) && d.getTime() > Date.now()) {
        return d.toISOString().slice(0, 10);
      }
    }
  }
  return undefined;
}

function extractFaceAmount(text: string): number | undefined {
  const matches = [...text.matchAll(CURRENCY_AMOUNT_REGEX)];
  let best: number | undefined;
  for (const m of matches) {
    const num = parseFloat(m[1].replace(/,/g, ""));
    if (num > 0 && num < 1e9 && (!best || num > best)) {
      best = num;
    }
  }
  return best;
}

function extractInvoiceNumber(text: string): string | undefined {
  const match = INVOICE_NUMBER_KEYWORDS.exec(text);
  return match?.[1]?.trim();
}

function extractPayerName(text: string): string | undefined {
  const billTo = /(?:bill\s*to|customer|to)\s*:?\s*([^\n\r]+)/gi.exec(text);
  if (billTo?.[1]) return billTo[1].trim().slice(0, 200);
  return undefined;
}

/**
 * POST /api/invoices/parse-pdf
 * Accept multipart form with PDF file. Extract text, hash it, run heuristics for fields.
 * Returns { extractedTextHash, fields }.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") ?? formData.get("pdf");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "Missing file: send multipart field 'file' or 'pdf'" },
        { status: 400 }
      );
    }
    if (file.type !== "application/pdf" && !file.name?.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "File must be a PDF" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfParse = (await import("pdf-parse")).default;
    const { text } = await pdfParse(buffer);
    const rawText = (text || "").trim();
    const extractedTextHash = createHash("sha256").update(rawText, "utf8").digest("hex");

    const fields: ParsedInvoiceFields = {
      currency: "USD",
    };
    if (rawText) {
      fields.customerEmail = extractEmail(rawText);
      fields.dueDate = extractDueDate(rawText);
      fields.faceAmount = extractFaceAmount(rawText);
      fields.invoiceNumber = extractInvoiceNumber(rawText);
      fields.payerName = extractPayerName(rawText);
    }

    return NextResponse.json({ extractedTextHash, fields });
  } catch (err) {
    console.error("parse-pdf", err);
    const message = err instanceof Error ? err.message : "Parse failed";
    return NextResponse.json(
      { error: "Failed to parse PDF", details: message },
      { status: 500 }
    );
  }
}
