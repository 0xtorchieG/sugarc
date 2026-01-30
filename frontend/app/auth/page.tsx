"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { setCookie, getCookie } from "cookies-next";
import { SocialLoginProvider } from "@circle-fin/w3s-pw-web-sdk/dist/src/types";
import type { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";

const appId = process.env.NEXT_PUBLIC_CIRCLE_APP_ID as string;
const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID as string;

type LoginResult = {
  userToken: string;
  encryptionKey: string;
};

type Wallet = {
  id: string;
  address: string;
  blockchain: string;
  [key: string]: unknown;
};

export default function AuthPage() {
  const sdkRef = useRef<W3SSdk | null>(null);

  const [sdkReady, setSdkReady] = useState(false);
  const [deviceId, setDeviceId] = useState<string>("");
  const [deviceIdLoading, setDeviceIdLoading] = useState(false);

  const [deviceToken, setDeviceToken] = useState<string>("");
  const [deviceEncryptionKey, setDeviceEncryptionKey] = useState<string>("");

  const [loginResult, setLoginResult] = useState<LoginResult | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Ready");

  useEffect(() => {
    let cancelled = false;

    const initSdk = async () => {
      try {
        const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");

        const onLoginComplete = (error: unknown, result: { userToken: string; encryptionKey: string }) => {
          if (cancelled) return;

          if (error) {
            const err = error as { message?: string };
            console.log("Login failed:", err);
            setLoginError(err.message || "Login failed");
            setLoginResult(null);
            setStatus("Login failed");
            return;
          }

          setLoginResult({
            userToken: result.userToken,
            encryptionKey: result.encryptionKey,
          });
          setLoginError(null);
          setStatus("Login successful. Credentials received from Google.");
        };

        const restoredAppId = (getCookie("appId") as string) || appId || "";
        const restoredGoogleClientId =
          (getCookie("google.clientId") as string) || googleClientId || "";
        const restoredDeviceToken = (getCookie("deviceToken") as string) || "";
        const restoredDeviceEncryptionKey =
          (getCookie("deviceEncryptionKey") as string) || "";

        const initialConfig = {
          appSettings: { appId: restoredAppId },
          loginConfigs: {
            deviceToken: restoredDeviceToken,
            deviceEncryptionKey: restoredDeviceEncryptionKey,
            google: {
              clientId: restoredGoogleClientId,
              redirectUri:
                typeof window !== "undefined" ? window.location.origin : "",
              selectAccountPrompt: true,
            },
          },
        };

        const sdk = new W3SSdk(initialConfig, onLoginComplete);
        sdkRef.current = sdk;

        if (!cancelled) {
          setSdkReady(true);
          setStatus("SDK initialized. Ready to create device token.");
        }
      } catch (err) {
        console.log("Failed to initialize Web SDK:", err);
        if (!cancelled) {
          setStatus("Failed to initialize Web SDK");
        }
      }
    };

    void initSdk();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const fetchDeviceId = async () => {
      if (!sdkRef.current) return;

      try {
        const cached =
          typeof window !== "undefined"
            ? window.localStorage.getItem("deviceId")
            : null;

        if (cached) {
          setDeviceId(cached);
          return;
        }

        setDeviceIdLoading(true);
        const id = await sdkRef.current.getDeviceId();
        setDeviceId(id);

        if (typeof window !== "undefined") {
          window.localStorage.setItem("deviceId", id);
        }
      } catch (error) {
        console.log("Failed to get deviceId:", error);
        setStatus("Failed to get deviceId");
      } finally {
        setDeviceIdLoading(false);
      }
    };

    if (sdkReady) {
      void fetchDeviceId();
    }
  }, [sdkReady]);

  async function loadUsdcBalance(userToken: string, walletId: string) {
    try {
      const response = await fetch("/api/endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "getTokenBalance",
          userToken,
          walletId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.log("Failed to load USDC balance:", data);
        setStatus("Failed to load USDC balance");
        return null;
      }

      const balances = (data.tokenBalances as { token?: { symbol?: string; name?: string }; amount?: string }[]) || [];
      const usdcEntry =
        balances.find((t) => {
          const symbol = t.token?.symbol || "";
          const name = t.token?.name || "";
          return symbol.startsWith("USDC") || name.includes("USDC");
        }) ?? null;

      const amount = usdcEntry?.amount ?? "0";
      setUsdcBalance(amount);
      return amount;
    } catch (err) {
      console.log("Failed to load USDC balance:", err);
      setStatus("Failed to load USDC balance");
      return null;
    }
  }

  const loadWallets = async (
    userToken: string,
    options?: { source?: "afterCreate" | "alreadyInitialized" },
  ) => {
    try {
      setStatus("Loading wallet details...");
      setUsdcBalance(null);

      const response = await fetch("/api/endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "listWallets",
          userToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.log("List wallets failed:", data);
        setStatus("Failed to load wallet details");
        return;
      }

      const walletList = (data.wallets as Wallet[]) || [];
      setWallets(walletList);

      if (walletList.length > 0) {
        await loadUsdcBalance(userToken, walletList[0].id);

        if (options?.source === "afterCreate") {
          setStatus(
            "Wallet created successfully! Wallet details and USDC balance loaded.",
          );
        } else if (options?.source === "alreadyInitialized") {
          setStatus(
            "User already initialized. Wallet details and USDC balance loaded.",
          );
        } else {
          setStatus("Wallet details and USDC balance loaded.");
        }
      } else {
        setStatus("No wallets found for this user.");
      }
    } catch (err) {
      console.log("Failed to load wallet details:", err);
      setStatus("Failed to load wallet details");
    }
  };

  const handleCreateDeviceToken = async () => {
    if (!deviceId) {
      setStatus("Missing deviceId");
      return;
    }

    try {
      setStatus("Creating device token...");
      const response = await fetch("/api/endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createDeviceToken",
          deviceId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.log("Create device token failed:", data);
        setStatus("Failed to create device token");
        return;
      }

      setDeviceToken(data.deviceToken);
      setDeviceEncryptionKey(data.deviceEncryptionKey);

      setCookie("deviceToken", data.deviceToken);
      setCookie("deviceEncryptionKey", data.deviceEncryptionKey);

      setStatus("Device token created");
    } catch (err) {
      console.log("Error creating device token:", err);
      setStatus("Failed to create device token");
    }
  };

  const handleLoginWithGoogle = () => {
    const sdk = sdkRef.current;
    if (!sdk) {
      setStatus("SDK not ready");
      return;
    }

    if (!deviceToken || !deviceEncryptionKey) {
      setStatus("Missing deviceToken or deviceEncryptionKey");
      return;
    }

    setCookie("appId", appId);
    setCookie("google.clientId", googleClientId);
    setCookie("deviceToken", deviceToken);
    setCookie("deviceEncryptionKey", deviceEncryptionKey);

    sdk.updateConfigs({
      appSettings: { appId },
      loginConfigs: {
        deviceToken,
        deviceEncryptionKey,
        google: {
          clientId: googleClientId,
          redirectUri: window.location.origin,
          selectAccountPrompt: true,
        },
      },
    });

    setStatus("Redirecting to Google...");
    sdk.performLogin(SocialLoginProvider.GOOGLE);
  };

  const handleInitializeUser = async () => {
    if (!loginResult?.userToken) {
      setStatus("Missing userToken. Please login with Google first.");
      return;
    }

    try {
      setStatus("Initializing user...");

      const response = await fetch("/api/endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "initializeUser",
          userToken: loginResult.userToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === 155106) {
          await loadWallets(loginResult.userToken, {
            source: "alreadyInitialized",
          });
          setChallengeId(null);
          return;
        }

        const errorMsg = data.code
          ? `[${data.code}] ${data.error || data.message}`
          : data.error || data.message;
        setStatus("Failed to initialize user: " + errorMsg);
        return;
      }

      setChallengeId(data.challengeId);
      setStatus(`User initialized. challengeId: ${data.challengeId}`);
    } catch (err) {
      const error = err as { code?: number; message?: string };

      if (error?.code === 155106 && loginResult?.userToken) {
        await loadWallets(loginResult.userToken, {
          source: "alreadyInitialized",
        });
        setChallengeId(null);
        return;
      }

      const errorMsg = error?.code
        ? `[${error.code}] ${error.message}`
        : error?.message || "Unknown error";
      setStatus("Failed to initialize user: " + errorMsg);
    }
  };

  const handleExecuteChallenge = () => {
    const sdk = sdkRef.current;
    if (!sdk) {
      setStatus("SDK not ready");
      return;
    }

    if (!challengeId) {
      setStatus("Missing challengeId. Initialize user first.");
      return;
    }

    if (!loginResult?.userToken || !loginResult?.encryptionKey) {
      setStatus("Missing login credentials. Please login again.");
      return;
    }

    sdk.setAuthentication({
      userToken: loginResult.userToken,
      encryptionKey: loginResult.encryptionKey,
    });

    setStatus("Executing challenge...");

    sdk.execute(challengeId, (error) => {
      const err = (error || {}) as { message?: string };

      if (error) {
        console.log("Execute challenge failed:", err);
        setStatus(
          "Failed to execute challenge: " + (err?.message ?? "Unknown error"),
        );
        return;
      }

      setStatus("Challenge executed. Loading wallet details...");

      void (async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        setChallengeId(null);
        await loadWallets(loginResult!.userToken, { source: "afterCreate" });
      })().catch((e) => {
        console.log("Post-execute follow-up failed:", e);
        setStatus("Wallet created, but failed to load wallet details.");
      });
    });
  };

  const primaryWallet = wallets[0];

  return (
    <Container>
      <div className="mx-auto max-w-xl space-y-6 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Connect wallet</h1>
          <Button variant="outline" size="sm" asChild>
            <Link href="/">Back to home</Link>
          </Button>
        </div>
        <p className="text-muted-foreground">
          Sign in with Google to create a user-owned wallet on Arc Testnet.
        </p>

        <div className="flex flex-col gap-3">
          <Button
            onClick={handleCreateDeviceToken}
            disabled={!sdkReady || !deviceId || deviceIdLoading}
          >
            1. Create device token
          </Button>
          <Button
            variant="outline"
            onClick={handleLoginWithGoogle}
            disabled={!deviceToken || !deviceEncryptionKey}
          >
            2. Login with Google
          </Button>
          <Button
            variant="outline"
            onClick={handleInitializeUser}
            disabled={!loginResult || wallets.length > 0}
          >
            3. Initialize user (get challenge)
          </Button>
          <Button
            variant="outline"
            onClick={handleExecuteChallenge}
            disabled={!challengeId || wallets.length > 0}
          >
            4. Create wallet (execute challenge)
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          <strong>Status:</strong> {status}
        </p>

        {loginError && (
          <p className="text-sm text-red-600">
            <strong>Error:</strong> {loginError}
          </p>
        )}

        {primaryWallet && (
          <div className="rounded-lg border border-input/40 bg-muted/30 p-4 space-y-2">
            <h2 className="font-semibold">Wallet details</h2>
            <p className="text-sm">
              <strong>Address:</strong>{" "}
              <span className="break-all font-mono text-xs">
                {primaryWallet.address}
              </span>
            </p>
            <p className="text-sm">
              <strong>Blockchain:</strong> {primaryWallet.blockchain}
            </p>
            {usdcBalance !== null && (
              <p className="text-sm">
                <strong>USDC balance:</strong> {usdcBalance}
              </p>
            )}
          </div>
        )}
      </div>
    </Container>
  );
}
