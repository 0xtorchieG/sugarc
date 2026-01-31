# Deployed contracts

This folder stores deployment addresses and ABIs per network for use by the frontend, backend, and scripts.

## Format

- **`arc-testnet.json`** – Arc Testnet (chain ID 5042002)
  - `chainId`, `networkName`
  - `contracts.<ContractName>.address` – deployed contract address
  - `contracts.<ContractName>.abi` – contract ABI (for ethers/viem)

## Usage

- **Frontend:** `import poolVaultDeployment from '@/../deployments/arc-testnet.json'` or use `frontend/lib/contracts.ts`.
- **Backend / scripts:** Read the JSON or import from a shared path.
- **Adding a network:** Create e.g. `mainnet.json` with the same structure.

## Arc Testnet

- **SugarcPoolVault:** `0x0af25C76bE552fe334BD2684DF3d64bb1E1baCF1`
- **Explorer:** https://testnet.arcscan.app
