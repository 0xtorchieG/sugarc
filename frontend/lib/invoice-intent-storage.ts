/**
 * Hackathon-fast JSON file store for invoice intents.
 * Path: data/invoice-intents.json (relative to process.cwd()).
 */

import fs from "fs/promises";
import path from "path";

export type InvoiceIntentStatus = "pending" | "funded" | "settled" | "cancelled";

export interface InvoiceIntentRecord {
  intentId: string;
  refHash: string;
  status: InvoiceIntentStatus;
  smbAddress: string;
  /** Set when funded onchain */
  txHash?: string;
  /** Set when funded onchain */
  onchainInvoiceId?: string;
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

const DATA_DIR = "data";
const FILE_NAME = "invoice-intents.json";

function dataPath(): string {
  return path.join(process.cwd(), DATA_DIR, FILE_NAME);
}

async function ensureDataDir(): Promise<void> {
  const dir = path.join(process.cwd(), DATA_DIR);
  await fs.mkdir(dir, { recursive: true });
}

export async function readIntents(): Promise<InvoiceIntentRecord[]> {
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

export async function writeIntents(intents: InvoiceIntentRecord[]): Promise<void> {
  await ensureDataDir();
  const filePath = dataPath();
  await fs.writeFile(
    filePath,
    JSON.stringify({ intents }, null, 2),
    "utf-8"
  );
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
