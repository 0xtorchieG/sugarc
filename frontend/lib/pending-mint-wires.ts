/**
 * Pending Circle Mint wire → invoice mapping (BE-008).
 * Hackathon-fast JSON file store.
 */

import fs from "fs/promises";
import path from "path";

export type PendingMintWire = {
  invoiceId: string;
  amountUsdc: string;
  trackingRef: string;
  createDate: string;
};

const DATA_DIR = "data";
const FILE_NAME = "pending-mint-wires.json";

function dataPath(): string {
  return path.join(process.cwd(), DATA_DIR, FILE_NAME);
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(path.join(process.cwd(), DATA_DIR), { recursive: true });
}

async function readPending(): Promise<PendingMintWire[]> {
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

async function writePending(wires: PendingMintWire[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(
    dataPath(),
    JSON.stringify({ wires }, null, 2),
    "utf-8"
  );
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
