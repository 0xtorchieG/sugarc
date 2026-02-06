/**
 * Invoice intent storage: Upstash Redis on Vercel, JSON file locally.
 * Vercel serverless has a read-only filesystem, so we use Redis when
 * UPSTASH_REDIS_REST_URL is set (via Vercel Marketplace Upstash integration).
 */

import fs from "fs/promises";
import path from "path";

export type InvoiceIntentStatus = "pending" | "funded" | "settled" | "cancelled";

export interface InvoiceIntentRecord {
  intentId: string;
  refHash: string;
  status: InvoiceIntentStatus;
  smbAddress: string;
  /** Payer/customer email for payment instructions notification (FE/BE-014) */
  customerEmail?: string;
  /** Hash of extracted PDF text for stability (optional) */
  extractedTextHash?: string;
  /** Invoice number from PDF or manual (optional) */
  invoiceNumber?: string;
  /** Payer/customer name (optional) */
  payerName?: string;
  /** Set when funded onchain */
  txHash?: string;
  /** Set when funded onchain */
  onchainInvoiceId?: string;
  /** Set when repaid (simulate-paid or real); used for activity feed */
  repayTxHash?: string;
  input: {
    amountUsdc: number;
    dueDate: string;
    payerCreditRating: string;
  };
  pricing: {
    eligiblePool: string;
    eligiblePoolName: string;
    discountPercent: number;
    cashAdvancedUsdc: number;
    derivedAprPercent: number;
    tenorDays: number;
  };
  createdAt: string;
}

const REDIS_KEY = "sugarc:invoice-intents";
const DATA_DIR = "data";
const FILE_NAME = "invoice-intents.json";

/** On Vercel, always use Redis (filesystem is read-only). Locally, use Redis if configured else file. */
function useRedis(): boolean {
  const hasRedis =
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  if (process.env.VERCEL) {
    if (!hasRedis) {
      throw new Error(
        "On Vercel, Redis is required. Add Upstash Redis from Storage/Integrations and ensure UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set for Production."
      );
    }
    return true;
  }
  return !!hasRedis;
}

function dataPath(): string {
  return path.join(process.cwd(), DATA_DIR, FILE_NAME);
}

async function ensureDataDir(): Promise<void> {
  const dir = path.join(process.cwd(), DATA_DIR);
  await fs.mkdir(dir, { recursive: true });
}

async function readFromFile(): Promise<InvoiceIntentRecord[]> {
  await ensureDataDir();
  const filePath = dataPath();
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(raw) as { intents?: InvoiceIntentRecord[] };
    return Array.isArray(data.intents) ? data.intents : [];
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return [];
    throw err;
  }
}

async function getRedisClient() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error("Redis URL or token not set");
  }
  const { Redis } = await import("@upstash/redis");
  return new Redis({ url, token });
}

async function readFromRedis(): Promise<InvoiceIntentRecord[]> {
  const redis = await getRedisClient();
  const raw = await redis.get<string>(REDIS_KEY);
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeToFile(intents: InvoiceIntentRecord[]): Promise<void> {
  await ensureDataDir();
  const filePath = dataPath();
  await fs.writeFile(
    filePath,
    JSON.stringify({ intents }, null, 2),
    "utf-8"
  );
}

async function writeToRedis(intents: InvoiceIntentRecord[]): Promise<void> {
  const redis = await getRedisClient();
  await redis.set(REDIS_KEY, JSON.stringify(intents));
}

export async function readIntents(): Promise<InvoiceIntentRecord[]> {
  return useRedis() ? readFromRedis() : readFromFile();
}

export async function writeIntents(intents: InvoiceIntentRecord[]): Promise<void> {
  return useRedis() ? writeToRedis(intents) : writeToFile(intents);
}

export async function addIntent(record: InvoiceIntentRecord): Promise<void> {
  const intents = await readIntents();
  intents.push(record);
  await writeIntents(intents);
}

export async function findIntentById(intentId: string): Promise<InvoiceIntentRecord | null> {
  const intents = await readIntents();
  return intents.find((i) => i.intentId === intentId) ?? null;
}

export async function findIntentsByWallet(smbAddress: string): Promise<InvoiceIntentRecord[]> {
  const intents = await readIntents();
  const normalized = smbAddress.toLowerCase();
  return intents.filter((i) => i.smbAddress.toLowerCase() === normalized);
}

export async function existsByRefHash(refHash: string): Promise<boolean> {
  const intents = await readIntents();
  return intents.some((i) => i.refHash === refHash);
}

export async function updateIntentFunded(
  intentId: string,
  txHash: string,
  onchainInvoiceId: string
): Promise<void> {
  const intents = await readIntents();
  const idx = intents.findIndex((i) => i.intentId === intentId);
  if (idx < 0) return;
  intents[idx] = {
    ...intents[idx],
    status: "funded",
    txHash,
    onchainInvoiceId,
  };
  await writeIntents(intents);
}

export async function findIntentByOnchainInvoiceId(
  onchainInvoiceId: string
): Promise<InvoiceIntentRecord | null> {
  const intents = await readIntents();
  return intents.find((i) => i.onchainInvoiceId === onchainInvoiceId) ?? null;
}

export async function updateIntentSettled(
  intentId: string,
  repayTxHash: string
): Promise<void> {
  const intents = await readIntents();
  const idx = intents.findIndex((i) => i.intentId === intentId);
  if (idx < 0) return;
  intents[idx] = {
    ...intents[idx],
    status: "settled",
    repayTxHash,
  };
  await writeIntents(intents);
}
