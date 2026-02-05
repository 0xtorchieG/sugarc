/**
 * Gateway contract ABIs for approve, deposit, addDelegate, isAuthorizedForBalance, gatewayMint.
 * @see https://developers.circle.com/gateway/references/contract-interfaces-and-events
 */

/** GatewayWallet: addDelegate(token, delegate) */
export const GATEWAY_ADD_DELEGATE_ABI = [
  "function addDelegate(address token, address delegate) external",
] as const;

/** GatewayWallet: isAuthorizedForBalance(token, depositor, addr) */
export const GATEWAY_IS_AUTHORIZED_ABI = [
  "function isAuthorizedForBalance(address token, address depositor, address addr) public view returns (bool)",
] as const;

/** GatewayMinter: gatewayMint(attestationPayload, signature) */
export const GATEWAY_MINT_ABI = [
  "function gatewayMint(bytes memory attestationPayload, bytes memory signature) external",
] as const;
