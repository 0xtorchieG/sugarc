/**
 * Build EIP-712 burn intent for Circle Gateway transfer.
 * @see https://developers.circle.com/gateway/quickstarts/unified-balance-evm
 */
import {
  GATEWAY_WALLET_ADDRESS,
  GATEWAY_MINTER_ADDRESS,
  GATEWAY_DOMAINS,
  USDC_ADDRESSES,
} from "./gateway";

/** Pad EVM address to 32 bytes (bytes32) */
function addressToBytes32(address: string): `0x${string}` {
  const clean = address.startsWith("0x") ? address.slice(2).toLowerCase() : address.toLowerCase();
  return `0x${clean.padStart(64, "0")}` as `0x${string}`;
}

export type SourceChain = "baseSepolia" | "sepolia";

export interface BurnIntentParams {
  sourceChain: SourceChain;
  depositorAddress: string;
  amountRaw: bigint;
  /** Recipient on Arc (default: depositor) */
  recipientAddress?: string;
  /** Signer address (for delegate flow; default: depositor) */
  signerAddress?: string;
}

/** Create burn intent for Gateway transfer (source chain → Arc) */
export function createBurnIntent(params: BurnIntentParams) {
  const {
    sourceChain,
    depositorAddress,
    amountRaw,
    recipientAddress = depositorAddress,
    signerAddress = depositorAddress,
  } = params;

  const sourceDomain = GATEWAY_DOMAINS[sourceChain];
  const destDomain = GATEWAY_DOMAINS.arcTestnet;
  const sourceUsdc = USDC_ADDRESSES[sourceChain];
  const destUsdc = USDC_ADDRESSES.arcTestnet;

  const salt = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}` as `0x${string}`;

  const maxBlockHeight = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
  const maxFee = BigInt(2_010_000); // ~2 USDC max fee (6 decimals)

  return {
    maxBlockHeight,
    maxFee,
    spec: {
      version: 1,
      sourceDomain,
      destinationDomain: destDomain,
      sourceContract: addressToBytes32(GATEWAY_WALLET_ADDRESS),
      destinationContract: addressToBytes32(GATEWAY_MINTER_ADDRESS),
      sourceToken: addressToBytes32(sourceUsdc),
      destinationToken: addressToBytes32(destUsdc),
      sourceDepositor: addressToBytes32(depositorAddress),
      destinationRecipient: addressToBytes32(recipientAddress),
      sourceSigner: addressToBytes32(signerAddress),
      destinationCaller: addressToBytes32("0x0000000000000000000000000000000000000000"),
      value: amountRaw,
      salt,
      hookData: "0x" as `0x${string}`,
    },
  };
}

/** EIP-712 domain and types for Gateway burn intent */
const domain = { name: "GatewayWallet", version: "1" };

const EIP712Domain = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
] as const;

const TransferSpec = [
  { name: "version", type: "uint32" },
  { name: "sourceDomain", type: "uint32" },
  { name: "destinationDomain", type: "uint32" },
  { name: "sourceContract", type: "bytes32" },
  { name: "destinationContract", type: "bytes32" },
  { name: "sourceToken", type: "bytes32" },
  { name: "destinationToken", type: "bytes32" },
  { name: "sourceDepositor", type: "bytes32" },
  { name: "destinationRecipient", type: "bytes32" },
  { name: "sourceSigner", type: "bytes32" },
  { name: "destinationCaller", type: "bytes32" },
  { name: "value", type: "uint256" },
  { name: "salt", type: "bytes32" },
  { name: "hookData", type: "bytes" },
] as const;

const BurnIntent = [
  { name: "maxBlockHeight", type: "uint256" },
  { name: "maxFee", type: "uint256" },
  { name: "spec", type: "TransferSpec" },
] as const;

/** Build EIP-712 typed data for signing (Circle signTypedData expects JSON string) */
export function buildBurnIntentTypedData(burnIntent: ReturnType<typeof createBurnIntent>) {
  return {
    types: {
      EIP712Domain,
      TransferSpec,
      BurnIntent,
    },
    domain,
    primaryType: "BurnIntent" as const,
    message: burnIntent,
  };
}
