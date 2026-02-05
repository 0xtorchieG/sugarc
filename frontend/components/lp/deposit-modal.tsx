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
import type { LpPool } from "./types";

const POOL_ID_MAP: Record<string, number> = {
  prime: 0,
  standard: 1,
  highYield: 2,
};

const CIRCLE_LOGIN_KEY = "circle_login_result";

type SourceChain = "arc" | "baseSepolia";

interface DepositModalProps {
  pool: LpPool;
  onClose: () => void;
  onSuccess?: () => void;
}

export function DepositModal({ pool, onClose, onSuccess }: DepositModalProps) {
  const { wallet, walletsPerChain, logout, refreshWallet } = useAuth();
  const [amount, setAmount] = useState("");
  const [sourceChain, setSourceChain] = useState<SourceChain>("arc");
  const [status, setStatus] = useState<
    | "idle"
    | "creating_wallet"
    | "approving"
    | "depositing"
    | "adding_delegate"
    | "confirming_delegate"
    | "transferring"
    | "minting"
    | "success"
    | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  const poolId = POOL_ID_MAP[pool.kind];
  const amountRaw = amount ? Math.floor(parseFloat(amount) * 1e6) : 0;

  const executeChallenge = useCallback(
    async (challengeId: string): Promise<boolean> => {
      const stored =
        typeof window !== "undefined"
          ? window.sessionStorage.getItem(CIRCLE_LOGIN_KEY)
          : null;
      if (!stored) {
        setError("Not signed in. Please log in again.");
        return false;
      }
      let creds: { userToken?: string; encryptionKey?: string };
      try {
        creds = JSON.parse(stored);
      } catch {
        setError("Session expired. Please log out and log back in.");
        return false;
      }
      if (!creds?.userToken || !creds?.encryptionKey) {
        setError("Session expired. Please log out and log back in.");
        return false;
      }
      const appId = process.env.NEXT_PUBLIC_CIRCLE_APP_ID;
      if (!appId) {
        setError("App not configured");
        return false;
      }

      const tryExecute = async (): Promise<boolean> => {
        const current =
          typeof window !== "undefined"
            ? window.sessionStorage.getItem(CIRCLE_LOGIN_KEY)
            : null;
        const c = current
          ? (JSON.parse(current) as { userToken?: string; encryptionKey?: string })
          : creds;
        const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");
        const sdk = new W3SSdk({ appSettings: { appId } }, () => {});
        sdk.setAuthentication({
          userToken: (c.userToken ?? creds.userToken)!,
          encryptionKey: (c.encryptionKey ?? creds.encryptionKey)!,
        });
        return new Promise((resolve) => {
          sdk.execute(challengeId, (err) => {
            if (err) {
              const msg = (err as { message?: string })?.message ?? "";
              const isTokenError =
                msg.includes("user token") ||
                msg.includes("userToken") ||
                msg.includes("Cannot find");
              if (isTokenError) {
                setError(
                  "Session expired. Please log out and log back in to continue."
                );
              } else {
                setError(msg || "Transaction failed");
              }
              resolve(false);
            } else {
              resolve(true);
            }
          });
        });
      };

      let result = await tryExecute();
      if (!result) {
        const refreshed = await refreshTokenIfNeeded();
        if (refreshed) {
          setError(null);
          result = await tryExecute();
        }
      }
      return result;
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
      refreshToken?: string;
    };
    if (!creds?.userToken) throw new Error("Session expired");
    return creds;
  }

  async function refreshTokenIfNeeded(): Promise<boolean> {
    const creds = await getCreds();
    if (!creds.refreshToken) return false;
    const deviceId =
      typeof window !== "undefined" ? window.localStorage.getItem("deviceId") : null;
    if (!deviceId) return false;
    const res = await fetch("/api/endpoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "refreshUserToken",
        userToken: creds.userToken,
        refreshToken: creds.refreshToken,
        deviceId,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.userToken || !data.encryptionKey) return false;
    const updated = {
      ...creds,
      userToken: data.userToken,
      encryptionKey: data.encryptionKey,
      refreshToken: data.refreshToken ?? creds.refreshToken,
    };
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(CIRCLE_LOGIN_KEY, JSON.stringify(updated));
    }
    return true;
  }

  async function ensureBaseSepoliaWallet(): Promise<{
    id: string;
    address: string;
  } | null> {
    const baseWallet = walletsPerChain.baseSepolia;
    if (baseWallet) return baseWallet;

    setStatus("creating_wallet");
    const creds = await getCreds();
    const res = await fetch("/api/endpoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "createUserWallet",
        userToken: creds.userToken,
        blockchains: ["BASE-SEPOLIA"],
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      const errMsg =
        data.code === 155508
          ? "Circle does not allow multiple wallets. Use Arc deposit."
          : data.message ?? data.error ?? JSON.stringify(data);
      setError(errMsg);
      setStatus("error");
      return null;
    }

    const challengeId = data.challengeId ?? data.data?.challengeId;
    if (challengeId) {
      const ok = await executeChallenge(challengeId);
      if (!ok) {
        setStatus("error");
        return null;
      }
    }

    await refreshWallet();
    const updated = (await fetch("/api/endpoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "listWallets", userToken: creds.userToken }),
    }).then((r) => r.json())) as { wallets?: { id: string; address: string; blockchain: string }[] };
    const newWallet = updated.wallets?.find((w: { blockchain: string }) =>
      w.blockchain.toUpperCase().includes("BASE")
    );
    if (!newWallet) {
      setError("Base Sepolia wallet not found after creation");
      setStatus("error");
      return null;
    }
    return newWallet;
  }

  async function runContractChallenge(
    walletId: string,
    contractAddress: string,
    abiFunctionSignature: string,
    abiParameters: string[]
  ): Promise<boolean> {
    const creds = await getCreds();
    const res = await fetch("/api/endpoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "createContractExecutionChallenge",
        userToken: creds.userToken,
        walletId,
        contractAddress,
        abiFunctionSignature,
        abiParameters,
        feeLevel: "MEDIUM",
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.challengeId) {
      setError(data.message ?? data.error ?? "Challenge failed");
      return false;
    }
    return executeChallenge(data.challengeId);
  }

  async function handleSubmit() {
    // Arc flow: use connected wallet (Arc-initialized users have Arc as primary). Base Sepolia flow: need Arc wallet for final deposit.
    const arcWallet = walletsPerChain.arc ?? wallet;
    if (!arcWallet?.id || !arcWallet?.address) {
      setError(
        sourceChain === "arc"
          ? "No Arc wallet found. Connect your Circle wallet."
          : "No Arc wallet found for final deposit. Ensure you have an Arc wallet."
      );
      return;
    }
    if (!amount || amountRaw <= 0) {
      setError("Enter a valid amount");
      return;
    }

    setError(null);

    try {
      if (sourceChain === "arc") {
        setStatus("approving");
        const approved = await runContractChallenge(
          arcWallet.id,
          ARC_USDC_ADDRESS,
          "approve(address,uint256)",
          [SUGARC_POOL_VAULT_ADDRESS, amountRaw.toString()]
        );
        if (!approved) {
          setStatus("error");
          return;
        }

        setStatus("depositing");
        const deposited = await runContractChallenge(
          arcWallet.id,
          SUGARC_POOL_VAULT_ADDRESS,
          "deposit(uint8,uint256)",
          [poolId.toString(), amountRaw.toString()]
        );
        if (!deposited) {
          setStatus("error");
          return;
        }
      } else {
        const sourceWallet = await ensureBaseSepoliaWallet();
        if (!sourceWallet) return;

        const usdc = USDC_ADDRESSES.baseSepolia;

        setStatus("approving");
        const approved = await runContractChallenge(
          sourceWallet.id,
          usdc,
          "approve(address,uint256)",
          [GATEWAY_WALLET_ADDRESS, amountRaw.toString()]
        );
        if (!approved) {
          setStatus("error");
          return;
        }

        setStatus("depositing");
        const deposited = await runContractChallenge(
          sourceWallet.id,
          GATEWAY_WALLET_ADDRESS,
          "deposit(address,uint256)",
          [usdc, amountRaw.toString()]
        );
        if (!deposited) {
          setStatus("error");
          return;
        }

        const opRes = await fetch("/api/gateway/operator-address");
        if (!opRes.ok) {
          setError("Operator not configured");
          setStatus("error");
          return;
        }
        const { address: operatorAddress } = await opRes.json();

        const authRes = await fetch(
          `/api/gateway/is-authorized?depositor=${sourceWallet.address}&operator=${operatorAddress}&chain=baseSepolia`
        );
        const { authorized } = (await authRes.json()) as { authorized?: boolean };
        if (!authorized) {
          setStatus("adding_delegate");
          const delegateOk = await runContractChallenge(
            sourceWallet.id,
            GATEWAY_WALLET_ADDRESS,
            "addDelegate(address,address)",
            [usdc, operatorAddress]
          );
          if (!delegateOk) {
            setStatus("error");
            return;
          }
          // Wait for addDelegate tx to be mined before transfer-delegate
          for (let i = 0; i < 30; i++) {
            setStatus("confirming_delegate");
            await new Promise((r) => setTimeout(r, 2000));
            const checkRes = await fetch(
              `/api/gateway/is-authorized?depositor=${sourceWallet.address}&operator=${operatorAddress}&chain=baseSepolia`
            );
            const { authorized: nowAuthorized } = (await checkRes.json()) as {
              authorized?: boolean;
            };
            if (nowAuthorized) break;
            if (i === 29) {
              setError("addDelegate not confirmed in time. Please retry.");
              setStatus("error");
              return;
            }
          }
        }

        setStatus("transferring");
        const transferRes = await fetch("/api/gateway/transfer-delegate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            depositorAddress: sourceWallet.address,
            recipientAddress: arcWallet.address,
            amountRaw: amountRaw.toString(),
            sourceChain: "baseSepolia",
          }),
        });
        const transferData = await transferRes.json();
        if (!transferRes.ok) {
          const errMsg = transferData.message ?? transferData.error ?? "Transfer failed";
          const hint = transferData.hint;
          const opAddr = transferData.operatorAddress;
          setError(
            [errMsg, hint, opAddr && `Operator: ${opAddr}`]
              .filter(Boolean)
              .join(" ")
          );
          setStatus("error");
          return;
        }

        const { attestation, signature } = transferData;
        if (!attestation || !signature) {
          setError("Invalid attestation response");
          setStatus("error");
          return;
        }

        setStatus("minting");
        const attestationHex = attestation.startsWith("0x") ? attestation : `0x${attestation}`;
        const signatureHex = signature.startsWith("0x") ? signature : `0x${signature}`;

        const minted = await runContractChallenge(
          arcWallet.id,
          GATEWAY_MINTER_ADDRESS,
          "gatewayMint(bytes,bytes)",
          [attestationHex, signatureHex]
        );
        if (!minted) {
          setStatus("error");
          return;
        }

        setStatus("approving");
        const poolApproved = await runContractChallenge(
          arcWallet.id,
          ARC_USDC_ADDRESS,
          "approve(address,uint256)",
          [SUGARC_POOL_VAULT_ADDRESS, amountRaw.toString()]
        );
        if (!poolApproved) {
          setStatus("error");
          return;
        }

        setStatus("depositing");
        const poolDeposited = await runContractChallenge(
          arcWallet.id,
          SUGARC_POOL_VAULT_ADDRESS,
          "deposit(uint8,uint256)",
          [poolId.toString(), amountRaw.toString()]
        );
        if (!poolDeposited) {
          setStatus("error");
          return;
        }
      }

      setStatus("success");
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  }

  const statusLabels: Record<string, string> = {
    creating_wallet: "Creating wallet…",
    approving: "Approving…",
    depositing: "Depositing…",
    adding_delegate: "Adding delegate…",
    confirming_delegate: "Confirming delegate…",
    transferring: "Transferring…",
    minting: "Minting…",
    idle: "Deposit",
    success: "Done",
    error: "Retry",
  };
  const statusLabel = statusLabels[status] ?? "Processing…";

  const isProcessing =
    status !== "idle" && status !== "success" && status !== "error";

  const effectiveWallet = walletsPerChain.arc ?? wallet;
  const canDepositFromBaseSepolia = sourceChain === "baseSepolia";

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
            {sourceChain === "arc"
              ? "Approve USDC spend, then deposit into the pool. You will sign twice with your Circle wallet."
              : "Deposit from Base Sepolia via Gateway. Approve, deposit to Gateway, then mint on Arc and deposit to the pool."}
          </p>

          <div className="space-y-2">
            <Label htmlFor="source-chain">Source chain</Label>
            <select
              id="source-chain"
              value={sourceChain}
              onChange={(e) => setSourceChain(e.target.value as SourceChain)}
              disabled={isProcessing}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="arc">Arc (direct)</option>
              <option value="baseSepolia">Base Sepolia (Gateway)</option>
            </select>
          </div>

          {!effectiveWallet?.address && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              Connect your Circle wallet to add liquidity.
            </p>
          )}
          {canDepositFromBaseSepolia && !walletsPerChain.baseSepolia && (
            <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
              A Base Sepolia wallet will be created if you don&apos;t have one.
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
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
              <p>{error}</p>
              {(error.includes("Session expired") ||
                error.includes("log back in")) && (
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    onClose();
                    window.location.href = "/auth";
                  }}
                  className="mt-2 font-medium underline hover:no-underline"
                >
                  Log out and sign in again →
                </button>
              )}
            </div>
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
                !effectiveWallet?.address ||
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
