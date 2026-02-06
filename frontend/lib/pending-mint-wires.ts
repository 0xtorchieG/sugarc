/**
 * Pending Circle Mint wire → invoice mapping (BE-008).
 * Uses Redis on Vercel, JSON file locally.
 */

import fs from "fs/promises";
import path from "path";
import { useRedis, getRedisClient } from "./redis";

export type PendingMintWire = {
  invoiceId: string;
  amountUsdc: string;
  trackingRef: string;
  createDate: string;
};

const REDIS_KEY = "sugarc:pending-mint-wires";
const DATA_DIR = "data";
const FILE_NAME = "pending-mint-wires.json";

function dataPath(): string {
  return path.join(process.cwd(), DATA_DIR, FILE_NAME);
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(path.join(process.cwd(), DATA_DIR), { recursive: true });
}

async function readFromFile(): Promise<PendingMintWire[]> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(dataPath(), "utf-8");
    const data = JSON.parse(raw) as { wires?: PendingMintWire[] };
    return Array.isArray(data.wires) ? data.wires : [];
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return [];
    throw err;
  }
}

async function readFromRedis(): Promise<PendingMintWire[]> {
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

async function writeToFile(wires: PendingMintWire[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(
    dataPath(),
    JSON.stringify({ wires }, null, 2),
    "utf-8"
  );
}

async function writeToRedis(wires: PendingMintWire[]): Promise<void> {
  const redis = await getRedisClient();
  await redis.set(REDIS_KEY, JSON.stringify(wires));
}

async function readPending(): Promise<PendingMintWire[]> {
  return useRedis() ? readFromRedis() : readFromFile();
}

async function writePending(wires: PendingMintWire[]): Promise<void> {
  return useRedis() ? writeToRedis(wires) : writeToFile(wires);
}

export async function addPendingWire(wire: PendingMintWire): Promise<void> {
  const wires = await readPending();
  wires.push(wire);
  await writePending(wires);
}

export async function findPendingWireByInvoice(
  invoiceId: string
): Promise<PendingMintWire | null> {
  const wires = await readPending();
  return wires.find((w) => w.invoiceId === invoiceId) ?? null;
}

export async function removePendingWire(invoiceId: string): Promise<void> {
  const wires = await readPending();
  const filtered = wires.filter((w) => w.invoiceId !== invoiceId);
  if (filtered.length < wires.length) {
    await writePending(filtered);
  }
}
