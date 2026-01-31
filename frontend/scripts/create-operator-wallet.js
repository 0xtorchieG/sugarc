/**
 * Create a Circle developer-controlled wallet set and operator wallet for Sugarc.
 * Run: node scripts/create-operator-wallet.js
 * Requires: CIRCLE_API_KEY and ENTITY_SECRET in .env
 */
const fs = require("fs");
const path = require("path");

// Load .env if present
try {
  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
} catch {}

const { initiateDeveloperControlledWalletsClient } = require("@circle-fin/developer-controlled-wallets");

const WALLET_SET_NAME = "Sugarc Operator";
const BLOCKCHAIN = "ARC-TESTNET";

async function main() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    console.error("Set CIRCLE_API_KEY and ENTITY_SECRET in .env");
    process.exit(1);
  }

  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });

  // 1. Create wallet set
  console.log("Creating wallet set...");
  const walletSetRes = await client.createWalletSet({
    name: WALLET_SET_NAME,
  });
  const walletSetId = walletSetRes.data?.walletSet?.id;
  if (!walletSetId) {
    throw new Error("Failed to create wallet set: " + JSON.stringify(walletSetRes));
  }
  console.log("Wallet set created:", walletSetId);

  // 2. Create wallet on ARC-TESTNET
  console.log("Creating wallet on ARC-TESTNET...");
  const walletsRes = await client.createWallets({
    accountType: "EOA",
    blockchains: [BLOCKCHAIN],
    count: 1,
    walletSetId,
  });
  const wallets = walletsRes.data?.wallets;
  if (!wallets?.length) {
    throw new Error("Failed to create wallet: " + JSON.stringify(walletsRes));
  }
  const wallet = wallets[0];
  console.log("\n--- Operator wallet created ---");
  console.log("Wallet ID (OPERATOR_WALLET_ID):", wallet.id);
  console.log("Address (set as operator on SugarcPoolVault):", wallet.address);
  console.log("\nAdd to .env:");
  console.log("OPERATOR_WALLET_ID=" + wallet.id);
  console.log("\nThen call setOperator(" + wallet.address + ") on SugarcPoolVault.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
