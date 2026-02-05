"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

const CIRCLE_LOGIN_KEY = "circle_login_result";

/**
 * Test button to validate createUserWallet for Base Sepolia.
 * Creates the wallet and executes the challenge via Circle SDK.
 */
export function CreateUserWalletTestButton() {
  const { refreshWallet } = useAuth();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleTest() {
    setStatus("loading");
    setMessage(null);

    try {
      const stored =
        typeof window !== "undefined" ? window.sessionStorage.getItem(CIRCLE_LOGIN_KEY) : null;
      if (!stored) {
        setMessage("Not signed in");
        setStatus("error");
        return;
      }

      const creds = JSON.parse(stored) as { userToken?: string; encryptionKey?: string };
      if (!creds?.userToken || !creds?.encryptionKey) {
        setMessage("No userToken or encryptionKey in session");
        setStatus("error");
        return;
      }

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
            ? "155508: Circle does not allow multiple SCA wallets across chains (createUserWallet)"
            : data.message ?? data.error ?? JSON.stringify(data);
        setMessage(errMsg);
        setStatus("error");
        return;
      }

      const challengeId = data.challengeId ?? data.data?.challengeId;
      if (!challengeId) {
        setMessage(`Success (no challenge): ${JSON.stringify(data).slice(0, 80)}…`);
        setStatus("success");
        return;
      }

      setMessage("Executing challenge…");

      const appId = process.env.NEXT_PUBLIC_CIRCLE_APP_ID;
      if (!appId) {
        setMessage("NEXT_PUBLIC_CIRCLE_APP_ID not set");
        setStatus("error");
        return;
      }

      const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");
      const sdk = new W3SSdk({ appSettings: { appId } }, () => {});
      sdk.setAuthentication({
        userToken: creds.userToken!,
        encryptionKey: creds.encryptionKey!,
      });

      await new Promise<void>((resolve) => {
        sdk.execute(challengeId, (err) => {
          if (err) {
            setMessage((err as { message?: string })?.message ?? "Challenge failed");
            setStatus("error");
          } else {
            setMessage("Base Sepolia wallet created successfully.");
            setStatus("success");
            void refreshWallet();
          }
          resolve();
        });
      });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <Button
        variant="outline"
        size="sm"
        onClick={handleTest}
        disabled={status === "loading"}
        className="shrink-0"
      >
        {status === "loading" ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Testing…
          </>
        ) : (
          "Test: Add Base Sepolia wallet"
        )}
      </Button>
      {message && (
        <p
          className={`text-xs ${
            status === "success"
              ? "text-emerald-600 dark:text-emerald-400"
              : status === "error"
                ? "text-red-600 dark:text-red-400"
                : "text-muted-foreground"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
