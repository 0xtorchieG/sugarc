/**
 * Register your Entity Secret with Circle.
 * Run: CIRCLE_API_KEY=xxx ENTITY_SECRET=xxx node scripts/register-entity-secret.js
 * Or ensure .env has CIRCLE_API_KEY and ENTITY_SECRET, then run from frontend dir.
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

const { registerEntitySecretCiphertext } = require("@circle-fin/developer-controlled-wallets");

async function main() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    console.error("Set CIRCLE_API_KEY and ENTITY_SECRET in .env");
    process.exit(1);
  }

  const recoveryDir = path.join(__dirname, "..");
  const response = await registerEntitySecretCiphertext({
    apiKey,
    entitySecret,
    recoveryFileDownloadPath: recoveryDir,
  });

  console.log("Registered! Recovery file saved to", recoveryDir);
  console.log("Store the recovery file securely - you need it to reset the entity secret if lost.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
