/**
 * Deployed contract addresses and ABIs for the frontend.
 * Source: sugarc/deployments/
 */

import arcTestnetDeployment from "@deployments/arc-testnet.json";

/** Arc Testnet chain ID */
export const ARC_TESTNET_CHAIN_ID = 5042002;

type Deployment = {
  chainId: number;
  networkName: string;
  contracts: {
    SugarcPoolVault: {
      address: `0x${string}`;
      abi: readonly unknown[];
    };
  };
};

const arcTestnet = arcTestnetDeployment as Deployment;

/** SugarcPoolVault address on Arc Testnet */
export const SUGARC_POOL_VAULT_ADDRESS = arcTestnet.contracts.SugarcPoolVault
  .address as `0x${string}`;

/** USDC on Arc Testnet (6 decimals) */
export const ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as `0x${string}`;

/** SugarcPoolVault ABI (for ethers, viem, wagmi) */
export const SUGARC_POOL_VAULT_ABI = arcTestnet.contracts.SugarcPoolVault.abi;

/** Deployment info for Arc Testnet */
export const arcTestnetDeployments = {
  chainId: arcTestnet.chainId,
  networkName: arcTestnet.networkName,
  SugarcPoolVault: {
    address: arcTestnet.contracts.SugarcPoolVault.address,
    abi: arcTestnet.contracts.SugarcPoolVault.abi,
  },
};
