/**
 * Circle Gateway configuration and helpers.
 * @see https://developers.circle.com/gateway
 */

/** Gateway API base URL (testnet). Use GATEWAY_API_URL env for override. */
export const GATEWAY_API_URL =
  process.env.GATEWAY_API_URL ?? "https://gateway-api-testnet.circle.com";

/** Gateway contract addresses (same across supported EVM chains) */
export const GATEWAY_WALLET_ADDRESS =
  "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" as const;
export const GATEWAY_MINTER_ADDRESS =
  "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B" as const;

/** Domain IDs for supported chains */
export const GATEWAY_DOMAINS = {
  /** Ethereum Sepolia */
  sepolia: 0,
  /** Base Sepolia */
  baseSepolia: 6,
  /** Arc Testnet */
  arcTestnet: 26,
} as const;

/** USDC addresses per chain (testnet) */
export const USDC_ADDRESSES = {
  sepolia: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as const,
  baseSepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const,
  arcTestnet: "0x3600000000000000000000000000000000000000" as const,
} as const;
