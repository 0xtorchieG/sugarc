"use client";

import { useState, useCallback } from "react";
import { X, Wallet, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import {
  SUGARC_POOL_VAULT_ADDRESS,
  ARC_USDC_ADDRESS,
} from "@/lib/contracts";
import {
  GATEWAY_WALLET_ADDRESS,
  GATEWAY_MINTER_ADDRESS,
  USDC_ADDRESSES,
} from "@/lib/gateway";
import {
  createBurnIntent,
  buildBurnIntentTypedData,
  type SourceChain,
} from "@/lib/gateway-burn-intent";
import type { LpPool } from "./types";

const POOL_ID_MAP: Record<string, number> = {
  prime: 0,
  standard: 1,
  highYield: 2,
};

const CIRCLE_LOGIN_KEY = "circle_login_result";

/** Circle blockchain IDs */
const CHAIN_TO_BLOCKCHAIN: Record<string, string> = {
  arc: "ARC-TESTNET",
  baseSepolia: "BASE-SEPOLIA",
  sepolia: "ETH-SEPOLIA",
};

interface DepositModalProps {
  pool: LpPool;
  onClose: () => void;
  onSuccess?: () => void;
}

type DepositChain = "arc" | "baseSepolia" | "sepolia";

export function DepositModal({ pool, onClose, onSuccess }: DepositModalProps) {
  const { wallet } = useAuth();
  const [amount, setAmount] = useState("");
  const [sourceChain, setSourceChain] = useState<DepositChain>("arc");
  const [status, setStatus] = useState<
    | "idle"
    | "creating_wallet"
    | "gateway_approving"
    | "gateway_depositing"
    | "signing_burn"
    | "fetching_attestation"
    | "minting"
    | "approving"
    | "depositing"
    | "success"
    | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  const poolId = POOL_ID_MAP[pool.kind];
  const amountRaw = amount ? Math.floor(parseFloat(amount) * 1e6) : 0;
  const useGateway = sourceChain !== "arc";

  const executeChallenge = useCallback(
    async (challengeId: string): Promise<boolean> => {
      const stored =
        typeof window !== "undefined"
          ? window.sessionStorage.getItem(CIRCLE_LOGIN_KEY)
          : null;
      if (!stored) {
        setError("Not signed in");
        return false;
      }
      let creds: { userToken?: string; encryptionKey?: string };
      try {
        creds = JSON.parse(stored);
      } catch {
        setError("Session expired");
        return false;
      }
      if (!creds?.userToken || !creds?.encryptionKey) {
        setError("Session expired");
        return false;
      }
      const appId = process.env.NEXT_PUBLIC_CIRCLE_APP_ID;
      if (!appId) {
        setError("App not configured");
        return false;
      }
      const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");
      const sdk = new W3SSdk({ appSettings: { appId } }, () => {});
      sdk.setAuthentication({
        userToken: creds.userToken,
        encryptionKey: creds.encryptionKey,
      });
      return new Promise((resolve) => {
        sdk.execute(challengeId, (err) => {
          if (err) {
            setError(
              (err as { message?: string })?.message ?? "Transaction failed"
            );
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    },
    []
  );

  async function getCreds() {
    const stored =
      typeof window !== "undefined"
        ? window.sessionStorage.getItem(CIRCLE_LOGIN_KEY)
        : null;
    if (!stored) throw new Error("Not signed in");
    const creds = JSON.parse(stored) as {
      userToken?: string;
      encryptionKey?: string;
    };
    if (!creds?.userToken) throw new Error("Session expired");
    return creds;
  }

  async function getWalletForChain(chain: DepositChain): Promise<{
    id: string;
    address: string;
    blockchain: string;
  } | null> {
    const creds = await getCreds();
    const res = await fetch("/api/endpoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "listWallets", userToken: creds.userToken }),
    });
    const data = await res.json();
    if (!res.ok || !data.wallets?.length) return null;
    const wallets = data.wallets as {
      id: string;
      address: string;
      blockchain: string;
    }[];
    const target = CHAIN_TO_BLOCKCHAIN[chain];
    const found = wallets.find((w) => {
      const b = (w.blockchain ?? "").toUpperCase();
      return b === target || b.includes(target.replace("-TESTNET", ""));
    });
    return found ?? (chain === "arc" ? wallets[0] : null);
  }

  async function ensureWalletForChain(
    chain: DepositChain
  ): Promise<{ id: string; address: string }> {
    let w = await getWalletForChain(chain);
    if (w) return w;

    const creds = await getCreds();
    const blockchain = CHAIN_TO_BLOCKCHAIN[chain];
    setStatus("creating_wallet");
    const createRes = await fetch("/api/endpoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "createUserWallet",
        userToken: creds.userToken,
        blockchains: [blockchain],
      }),
    });
    const createData = await createRes.json();
    if (!createRes.ok || !createData.challengeId) {
      throw new Error(createData.message ?? createData.error ?? "Failed to create wallet");
    }
    const ok = await executeChallenge(createData.challengeId);
    if (!ok) throw new Error("Wallet creation cancelled");

    await new Promise((r) => setTimeout(r, 1500));
    w = await getWalletForChain(chain);
    if (!w) throw new Error("Wallet not found after creation");
    return w;
  }

  async function pollChallengeForSignature(
    challengeId: string
  ): Promise<string | null> {
    const creds = await getCreds();
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const res = await fetch("/api/endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "getChallenge",
          userToken: creds.userToken,
          challengeId,
        }),
      });
      const data = await res.json();
      const ch = data.challenge ?? data.data?.challenge ?? data;
      if (ch?.status === "COMPLETE") {
        const sig =
          ch.signature ??
          ch.data?.signature ??
          ch.result?.signature ??
          ch.result ??
          data.signature ??
          data.data?.signature;
        if (typeof sig === "string" && sig.startsWith("0x")) return sig;
      }
      if (ch?.status === "FAILED" || ch?.status === "EXPIRED") return null;
    }
    return null;
  }

  async function handleSubmit() {
    if (!wallet?.id || !wallet?.address) {
      setError("Connect your wallet first");
      return;
    }
    if (!amount || amountRaw <= 0) {
      setError("Enter a valid amount");
      return;
    }

    setError(null);

    try {
      if (useGateway) {
        const sourceChainKey = sourceChain as SourceChain;
        const sourceWallet = await ensureWalletForChain(sourceChain);
        const sourceUsdc =
          USDC_ADDRESSES[sourceChainKey as keyof typeof USDC_ADDRESSES];

        setStatus("gateway_approving");
        const approveRes = await fetch("/api/endpoints", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "createContractExecutionChallenge",
            userToken: (await getCreds()).userToken,
            walletId: sourceWallet.id,
            contractAddress: sourceUsdc,
            abiFunctionSignature: "approve(address,uint256)",
            abiParameters: [
              GATEWAY_WALLET_ADDRESS,
              amountRaw.toString(),
            ],
            feeLevel: "MEDIUM",
          }),
        });
        const approveData = await approveRes.json();
        if (!approveRes.ok || !approveData.challengeId) {
          setError(approveData.message ?? approveData.error ?? "Failed to approve");
          setStatus("error");
          return;
        }
        const approved = await executeChallenge(approveData.challengeId);
        if (!approved) {
          setStatus("error");
          return;
        }

        setStatus("gateway_depositing");
        const gatewayDepositRes = await fetch("/api/endpoints", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "createContractExecutionChallenge",
            userToken: (await getCreds()).userToken,
            walletId: sourceWallet.id,
            contractAddress: GATEWAY_WALLET_ADDRESS,
            abiFunctionSignature: "deposit(address,uint256)",
            abiParameters: [sourceUsdc, amountRaw.toString()],
            feeLevel: "MEDIUM",
          }),
        });
        const gatewayDepositData = await gatewayDepositRes.json();
        if (!gatewayDepositRes.ok || !gatewayDepositData.challengeId) {
          setError(
            gatewayDepositData.message ??
              gatewayDepositData.error ??
              "Failed to deposit to Gateway"
          );
          setStatus("error");
          return;
        }
        const gatewayDeposited = await executeChallenge(
          gatewayDepositData.challengeId
        );
        if (!gatewayDeposited) {
          setStatus("error");
          return;
        }

        setStatus("signing_burn");
        const burnIntent = createBurnIntent({
          sourceChain: sourceChainKey,
          depositorAddress: sourceWallet.address,
          amountRaw: BigInt(amountRaw),
          recipientAddress: wallet.address,
        });
        const typedData = buildBurnIntentTypedData(burnIntent);

        const signRes = await fetch("/api/endpoints", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "signTypedData",
            userToken: (await getCreds()).userToken,
            walletId: sourceWallet.id,
            typedData: JSON.stringify(typedData),
            memo: "Gateway transfer to Arc",
          }),
        });
        const signData = await signRes.json();
        if (!signRes.ok || !signData.challengeId) {
          setError(signData.message ?? signData.error ?? "Failed to create sign challenge");
          setStatus("error");
          return;
        }
        const signed = await executeChallenge(signData.challengeId);
        if (!signed) {
          setStatus("error");
          return;
        }

        const signature = await pollChallengeForSignature(signData.challengeId);
        if (!signature) {
          setError("Could not retrieve signature after signing");
          setStatus("error");
          return;
        }

        setStatus("fetching_attestation");
        const transferPayload = [
          {
            burnIntent: {
              maxBlockHeight: burnIntent.maxBlockHeight.toString(),
              maxFee: burnIntent.maxFee.toString(),
              spec: {
                ...burnIntent.spec,
                value: burnIntent.spec.value.toString(),
              },
            },
            signature,
          },
        ];
        const gatewayRes = await fetch("/api/gateway/transfer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(transferPayload),
        });
        const gatewayResult = await gatewayRes.json();
        if (!gatewayRes.ok || !gatewayResult.attestation || !gatewayResult.signature) {
          setError(
            gatewayResult.error ??
              gatewayResult.message ??
              "Gateway attestation failed"
          );
          setStatus("error");
          return;
        }

        setStatus("minting");
        const mintRes = await fetch("/api/endpoints", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "createContractExecutionChallenge",
            userToken: (await getCreds()).userToken,
            walletId: wallet.id,
            contractAddress: GATEWAY_MINTER_ADDRESS,
            abiFunctionSignature: "gatewayMint(bytes,bytes)",
            abiParameters: [
              gatewayResult.attestation,
              gatewayResult.signature,
            ],
            feeLevel: "MEDIUM",
          }),
        });
        const mintData = await mintRes.json();
        if (!mintRes.ok || !mintData.challengeId) {
          setError(mintData.message ?? mintData.error ?? "Failed to mint on Arc");
          setStatus("error");
          return;
        }
        const minted = await executeChallenge(mintData.challengeId);
        if (!minted) {
          setStatus("error");
          return;
        }
      }

      setStatus("approving");
      const approveRes = await fetch("/api/endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createContractExecutionChallenge",
          userToken: (await getCreds()).userToken,
          walletId: wallet.id,
          contractAddress: ARC_USDC_ADDRESS,
          abiFunctionSignature: "approve(address,uint256)",
          abiParameters: [SUGARC_POOL_VAULT_ADDRESS, amountRaw.toString()],
          feeLevel: "MEDIUM",
        }),
      });
      const approveData = await approveRes.json();
      if (!approveRes.ok || !approveData.challengeId) {
        setError(approveData.message ?? approveData.error ?? "Failed to create approve");
        setStatus("error");
        return;
      }
      const approved = await executeChallenge(approveData.challengeId);
      if (!approved) {
        setStatus("error");
        return;
      }

      setStatus("depositing");
      const depositRes = await fetch("/api/endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createContractExecutionChallenge",
          userToken: (await getCreds()).userToken,
          walletId: wallet.id,
          contractAddress: SUGARC_POOL_VAULT_ADDRESS,
          abiFunctionSignature: "deposit(uint8,uint256)",
          abiParameters: [poolId, amountRaw.toString()],
          feeLevel: "MEDIUM",
        }),
      });
      const depositData = await depositRes.json();
      if (!depositRes.ok || !depositData.challengeId) {
        setError(
          depositData.message ?? depositData.error ?? "Failed to create deposit"
        );
        setStatus("error");
        return;
      }
      const deposited = await executeChallenge(depositData.challengeId);
      if (!deposited) {
        setStatus("error");
        return;
      }

      setStatus("success");
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  }

  const statusLabel =
    status === "creating_wallet"
      ? "Creating wallet…"
      : status === "gateway_approving"
        ? "Approving Gateway…"
        : status === "gateway_depositing"
          ? "Depositing to Gateway…"
          : status === "signing_burn"
            ? "Sign transfer…"
            : status === "fetching_attestation"
              ? "Getting attestation…"
              : status === "minting"
                ? "Minting on Arc…"
                : status === "approving"
                  ? "Approving…"
                  : status === "depositing"
                    ? "Depositing…"
                    : status === "idle"
                      ? "Deposit"
                      : status === "success"
                        ? "Done"
                        : status === "error"
                          ? "Retry"
                          : "Processing…";

  const isProcessing =
    status !== "idle" && status !== "success" && status !== "error";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg">Add USDC to {pool.name}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {useGateway
              ? "Deposit from another chain via Circle Gateway, then add to the pool. Multiple signatures required."
              : "Approve USDC spend, then deposit into the pool. You will sign twice with your Circle wallet."}
          </p>

          {useGateway && (
            <div className="flex flex-col gap-1 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
              <p className="text-xs font-medium text-foreground">
                Multichain via Circle Gateway
              </p>
              <p className="text-xs text-muted-foreground">
                USDC from {sourceChain === "baseSepolia" ? "Base Sepolia" : "Ethereum Sepolia"} → Arc → pool. Deposit finality may take ~15 min before transfer.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Source chain</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={sourceChain}
              onChange={(e) => setSourceChain(e.target.value as DepositChain)}
              disabled={isProcessing}
            >
              <option value="arc">Arc (direct)</option>
              <option value="baseSepolia">Base Sepolia</option>
              <option value="sepolia">Ethereum Sepolia</option>
            </select>
          </div>

          {!wallet?.address && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              Connect your Circle wallet to add liquidity.
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (USDC)</Label>
            <Input
              id="amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isProcessing}
            />
          </div>
          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </p>
          )}
          {status === "success" && (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
              Deposit successful!
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={
                !wallet?.address ||
                !amount ||
                amountRaw <= 0 ||
                isProcessing
              }
            >
              {isProcessing && (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {statusLabel}
                </>
              )}
              {!isProcessing && (
                <>
                  <Wallet className="mr-2 h-4 w-4" />
                  {statusLabel}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
