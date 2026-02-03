# 🍬 Sugarc 🍬

Tokenized invoice factoring on Arc — ETHGlobal Hack Money hackathon project.

Monorepo: **frontend** (Next.js + TypeScript + ShadcnUI + thirdweb), **contracts** (Solidity + Hardhat), **backend** (Node.js + TypeScript).

Run all commands below from this repo root (the folder that contains `package.json` and `frontend/`).

## Setup

```bash
npm install
```


## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Run all dev servers (frontend + backend) |
| `npm run dev:frontend` | Next.js dev (port 3000) |
| `npm run dev:backend` | Backend dev (port 3001) |
| `npm run build` | Build all packages |
| `npm run deploy` | Deploy contracts (default: localhost) |
| `npm run deploy:contracts` | Same as above |
| `npm run deploy:arc` | Deploy to Arc (from `contracts/`) |

## Deploy flow

1. **Local**: `cd contracts && npm run dev` (Hardhat node), then in another terminal `npm run deploy`.
2. **Arc**: set `PRIVATE_KEY` and `ARC_RPC`, then `npm run deploy:arc -w contracts`.

## Structure

```
sugarc/
├── frontend/   # Next.js, ShadcnUI, thirdweb SDK
├── contracts/  # Solidity, Hardhat
├── backend/    # Express, TypeScript
└── package.json
```

## Circle Mint: Bank Wire → Onchain Repayment (BE-008)

**This is the real production integration point** for invoice factoring: when a payer sends a bank wire, it settles the onchain repayment. Uses the same [Circle Mint quickstart](https://developers.circle.com/circle-mint/quickstart-deposit-via-funds-transfer#testing) mock wire flow.

### Testing on localhost

**One-time setup** (follow [Circle Mint quickstart](https://developers.circle.com/circle-mint/quickstart-deposit-via-funds-transfer) steps 1–3):

1. Get API key from [app-sandbox.circle.com](https://app-sandbox.circle.com/) → Settings.
2. Create a wire bank account:
   ```bash
   curl -X POST https://api-sandbox.circle.com/v1/businessAccount/banks/wires \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "billingDetails": {"name": "Satoshi Nakamoto", "city": "Boston", "country": "US", "line1": "100 Money Street", "district": "MA", "postalCode": "01234"},
       "bankAddress": {"bankName": "SAN FRANCISCO", "city": "SAN FRANCISCO", "country": "US", "line1": "100 Money Street", "district": "CA"},
       "idempotencyKey": "ba943ff1-ca16-49b2-ba55-1057e70ca5c7",
       "accountNumber": "12340010",
       "routingNumber": "121000248"
     }'
   ```
3. Get wire instructions (replace `WIRE_ACCOUNT_ID` with `id` from step 2):
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY" \
     "https://api-sandbox.circle.com/v1/businessAccount/banks/wires/WIRE_ACCOUNT_ID/instructions?currency=USD"
   ```
4. Add to `.env`:
   ```
   CIRCLE_API_KEY=your_sandbox_api_key
   CIRCLE_MINT_BENEFICIARY_ACCOUNT=123815146304
   ```
   (Use the `beneficiaryBank.accountNumber` from step 3. Sandbox example: `123815146304`.)

**Run the demo:**

```bash
# Start frontend
npm run dev:frontend
```

1. **Trigger mock wire** (simulates payer sending wire):
   ```bash
   curl -X POST http://localhost:3000/api/mint/mock-wire \
     -H "Content-Type: application/json" \
     -d '{"invoiceId": "0", "amountUsdc": "100.00"}'
   ```

2. **Settle onchain** — Sandbox processes wires in batches (up to 15 min). For instant demo, use `?force=true`:
   ```bash
   curl -X POST "http://localhost:3000/api/invoices/0/settle-from-mint?force=true"
   ```

The operator wallet must have USDC to repay. Ensure `ENTITY_SECRET` and `OPERATOR_WALLET_ID` are set (same as invoice funding).
