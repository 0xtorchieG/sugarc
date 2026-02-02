import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import type { ParsedInvoiceFields } from "./types";

const EXTRACTION_PROMPT = `Extract invoice fields from this PDF document. Return ONLY a valid JSON object with these exact keys (use null for missing values):
{
  "customerEmail": "string or null - payer/customer email address",
  "dueDate": "string or null - in YYYY-MM-DD format",
  "faceAmount": number or null - total invoice amount (largest amount if multiple)",
  "invoiceNumber": "string or null - invoice/reference number",
  "payerName": "string or null - customer/payer/bill-to name",
  "currency": "string or null - e.g. USD (default USD if not specified)"
}

Rules:
- dueDate must be YYYY-MM-DD. If you see "Due: Jan 15, 2025" output "2025-01-15".
- faceAmount is the total amount due (not subtotal, tax, or line items). Use the main invoice total.
- customerEmail: look for "email", "e-mail", contact email, or any valid email in the document.
- Return ONLY the JSON object, no markdown, no explanation.`;

// Heuristic extraction (fallback when Gemini rate limited)
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const DATE_PATTERNS = [
  /\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/g,
  /\b(0?[1-9]|[12]\d|3[01])[-/](0?[1-9]|1[0-2])[-/](20\d{2})\b/g,
  /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+20\d{2}\b/gi,
  /\b\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+20\d{2}\b/gi,
];
const CURRENCY_AMOUNT_REGEX =
  /\$?\s*([1-9]\d{0,2}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)\s*(?:USD|USDC|usd|usdc)?/g;
const INVOICE_NUMBER_KEYWORDS =
  /(?:invoice\s*#?|inv\.?\s*#?|number\s*#?|no\.?)\s*[:#]?\s*([A-Z0-9-_]+)/gi;

function extractFieldsFromText(rawText: string): ParsedInvoiceFields {
  const fields: ParsedInvoiceFields = { currency: "USD" };
  if (!rawText) return fields;
  const email = rawText.match(EMAIL_REGEX)?.[0];
  if (email) fields.customerEmail = email;
  for (const pattern of DATE_PATTERNS) {
    const match = rawText.match(pattern)?.[0];
    if (match) {
      const d = new Date(match);
      if (!Number.isNaN(d.getTime())) {
        fields.dueDate = d.toISOString().slice(0, 10);
        break;
      }
    }
  }
  const amountMatches = [...rawText.matchAll(CURRENCY_AMOUNT_REGEX)];
  let best: number | undefined;
  for (const m of amountMatches) {
    const num = parseFloat(m[1].replace(/,/g, ""));
    if (num > 0 && num < 1e9 && (!best || num > best)) best = num;
  }
  if (best) fields.faceAmount = best;
  const invMatch = INVOICE_NUMBER_KEYWORDS.exec(rawText);
  if (invMatch?.[1]) fields.invoiceNumber = invMatch[1].trim();
  const billTo = /(?:bill\s*to|customer|to)\s*:?\s*([^\n\r]+)/gi.exec(rawText);
  if (billTo?.[1]) fields.payerName = billTo[1].trim().slice(0, 200);
  return fields;
}

async function extractWithGemini(
  pdfBase64: string,
  apiKey: string,
  retries = 2
): Promise<ParsedInvoiceFields | null> {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = Math.min(5000 * Math.pow(2, attempt - 1), 15000);
        await new Promise((r) => setTimeout(r, delay));
      }
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          { text: EXTRACTION_PROMPT },
          { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
        ],
      });
      const text = response.text?.trim();
      if (!text) continue;
      const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      const parsed = JSON.parse(cleaned) as Record<string, unknown>;
      const fields: ParsedInvoiceFields = { currency: "USD" };
      if (typeof parsed.customerEmail === "string" && parsed.customerEmail)
        fields.customerEmail = parsed.customerEmail;
      if (typeof parsed.dueDate === "string" && parsed.dueDate) fields.dueDate = parsed.dueDate;
      if (typeof parsed.faceAmount === "number" && parsed.faceAmount > 0)
        fields.faceAmount = parsed.faceAmount;
      if (typeof parsed.invoiceNumber === "string" && parsed.invoiceNumber)
        fields.invoiceNumber = parsed.invoiceNumber;
      if (typeof parsed.payerName === "string" && parsed.payerName)
        fields.payerName = parsed.payerName;
      if (typeof parsed.currency === "string" && parsed.currency)
        fields.currency = parsed.currency;
      return fields;
    } catch (e) {
      lastErr = e;
      const is429 =
        (e as { status?: number })?.status === 429 ||
        String((e as { message?: string })?.message ?? "").includes("429") ||
        String((e as { message?: string })?.message ?? "").includes("RESOURCE_EXHAUSTED");
      if (!is429 || attempt === retries) break;
    }
  }
  if (lastErr) console.warn("Gemini extraction failed, trying OpenAI fallback:", lastErr);
  return null;
}

async function extractWithOpenAI(
  rawText: string,
  apiKey: string,
  retries = 2
): Promise<ParsedInvoiceFields | null> {
  if (!rawText?.trim()) return null;
  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey });
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = Math.min(5000 * Math.pow(2, attempt - 1), 15000);
        await new Promise((r) => setTimeout(r, delay));
      }
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: `${EXTRACTION_PROMPT}\n\n---\n\nExtract from this invoice text:\n\n${rawText.slice(0, 12000)}`,
          },
        ],
        response_format: { type: "json_object" },
      });
      const text = response.choices?.[0]?.message?.content?.trim();
      if (!text) continue;
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const fields: ParsedInvoiceFields = { currency: "USD" };
      if (typeof parsed.customerEmail === "string" && parsed.customerEmail)
        fields.customerEmail = parsed.customerEmail;
      if (typeof parsed.dueDate === "string" && parsed.dueDate) fields.dueDate = parsed.dueDate;
      if (typeof parsed.faceAmount === "number" && parsed.faceAmount > 0)
        fields.faceAmount = parsed.faceAmount;
      if (typeof parsed.invoiceNumber === "string" && parsed.invoiceNumber)
        fields.invoiceNumber = parsed.invoiceNumber;
      if (typeof parsed.payerName === "string" && parsed.payerName)
        fields.payerName = parsed.payerName;
      if (typeof parsed.currency === "string" && parsed.currency)
        fields.currency = parsed.currency;
      return fields;
    } catch (e) {
      lastErr = e;
      const is429 =
        (e as { status?: number })?.status === 429 ||
        String((e as { message?: string })?.message ?? "").includes("429") ||
        String((e as { message?: string })?.message ?? "").includes("rate limit");
      if (!is429 || attempt === retries) break;
    }
  }
  if (lastErr) console.warn("OpenAI extraction failed, using heuristic fallback:", lastErr);
  return null;
}

/**
 * POST /api/invoices/parse-pdf
 * Use Gemini to extract invoice fields. Falls back to OpenAI, then heuristic extraction.
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
      return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdfBase64 = Buffer.from(arrayBuffer).toString("base64");
    const extractedTextHash = createHash("sha256")
      .update(new Uint8Array(arrayBuffer))
      .digest("hex");

    let fields: ParsedInvoiceFields = { currency: "USD" };
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (geminiKey) {
      const geminiFields = await extractWithGemini(pdfBase64, geminiKey);
      if (geminiFields) {
        fields = geminiFields;
        return NextResponse.json({ extractedTextHash, fields });
      }
    }

    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
    const { text } = await extractText(pdf, { mergePages: true });
    const rawText = (text || "").trim();

    if (openaiKey && rawText) {
      const openaiFields = await extractWithOpenAI(rawText, openaiKey);
      if (openaiFields) {
        fields = openaiFields;
        return NextResponse.json({ extractedTextHash, fields });
      }
    }

    fields = extractFieldsFromText(rawText);
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
