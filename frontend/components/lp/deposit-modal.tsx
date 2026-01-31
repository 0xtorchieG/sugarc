"use client";

import { useState, useCallback } from "react";
import { X, Wallet, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { SUGARC_POOL_VAULT_ADDRESS, ARC_USDC_ADDRESS } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import type { LpPool } from "./types";

const POOL_ID_MAP: Record<string, number> = {
  prime: 0,
  standard: 1,
  highYield: 2,
};

const CIRCLE_LOGIN_KEY = "circle_login_result";

interface DepositModalProps {
  pool: LpPool;
  onClose: () => void;
  onSuccess?: () => void;
}

export function DepositModal({ pool, onClose, onSuccess }: DepositModalProps) {
  const { wallet } = useAuth();
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "approving" | "depositing" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const poolId = POOL_ID_MAP[pool.kind];
  const amountRaw = amount ? Math.floor(parseFloat(amount) * 1e6) : 0;

  const executeChallenge = useCallback(async (challengeId: string): Promise<boolean> => {
    const stored = typeof window !== "undefined" ? window.sessionStorage.getItem(CIRCLE_LOGIN_KEY) : null;
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
    sdk.setAuthentication({ userToken: creds.userToken, encryptionKey: creds.encryptionKey });
    return new Promise((resolve) => {
      sdk.execute(challengeId, (err) => {
        if (err) {
          setError((err as { message?: string })?.message ?? "Transaction failed");
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }, []);

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
    setStatus("approving");

    try {
      // Always approve first (Circle contract query for allowance is unreliable on ARC-TESTNET)
      const approveRes = await fetch("/api/endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createContractExecutionChallenge",
          userToken: JSON.parse(window.sessionStorage.getItem(CIRCLE_LOGIN_KEY) ?? "{}").userToken,
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
          userToken: JSON.parse(window.sessionStorage.getItem(CIRCLE_LOGIN_KEY) ?? "{}").userToken,
          walletId: wallet.id,
          contractAddress: SUGARC_POOL_VAULT_ADDRESS,
          abiFunctionSignature: "deposit(uint8,uint256)",
          abiParameters: [poolId, amountRaw.toString()],
          feeLevel: "MEDIUM",
        }),
      });
      const depositData = await depositRes.json();
      if (!depositRes.ok || !depositData.challengeId) {
        setError(depositData.message ?? depositData.error ?? "Failed to create deposit");
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
            Approve USDC spend, then deposit into the pool. You will sign twice with your Circle wallet.
          </p>
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
              disabled={status === "approving" || status === "depositing"}
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
              disabled={!wallet?.address || !amount || amountRaw <= 0 || status === "approving" || status === "depositing"}
            >
              {status === "approving" && (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Approving…
                </>
              )}
              {status === "depositing" && (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Depositing…
                </>
              )}
              {status === "idle" && (
                <>
                  <Wallet className="mr-2 h-4 w-4" />
                  Deposit
                </>
              )}
              {status === "success" && "Done"}
              {status === "error" && "Retry"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
