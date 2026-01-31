/**
 * Arc Testnet (and mainnet) addresses.
 * @see https://docs.arc.network/arc/references/connect-to-arc
 */

/** Arc Testnet chain ID */
export const ARC_TESTNET_CHAIN_ID = 5042002;

/**
 * USDC on Arc Testnet.
 * Optional ERC-20 interface for the native USDC balance.
 * - ERC-20 (this contract): 6 decimals (transferFrom, approve, allowance).
 * - Native balance (gas): 18 decimals of precision per Arc docs.
 */
export const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000" as const;
