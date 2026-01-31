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
| `npm run deploy:sepolia` | Deploy to Sepolia (from `contracts/`) |

## Deploy flow

1. **Local**: `cd contracts && npm run dev` (Hardhat node), then in another terminal `npm run deploy`.
2. **Sepolia**: set `PRIVATE_KEY` and `SEPOLIA_RPC`, then `npm run deploy:sepolia -w contracts`.

## Structure

```
sugarc/
├── frontend/   # Next.js, ShadcnUI, thirdweb SDK
├── contracts/  # Solidity, Hardhat
├── backend/    # Express, TypeScript
└── package.json
```
