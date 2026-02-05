"use client";

/**
 * Circle "Create User Wallets with Social Login" — single-click flow.
 * Sign in with Google: device token, SSO, init user, and create wallet (if needed) run automatically.
 * Docs: https://developers.circle.com/wallets/user-controlled/create-user-wallets-with-social-login
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { setCookie, getCookie } from "cookies-next";
import { SocialLoginProvider } from "@circle-fin/w3s-pw-web-sdk/dist/src/types";
import type { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/layout/container";
import { useAuth } from "@/contexts/auth-context";
import type { WalletInfo, BalancesPerChain, WalletsPerChain } from "@/contexts/auth-context";

const appId = process.env.NEXT_PUBLIC_CIRCLE_APP_ID as string;
const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID as string;

type LoginResult = { userToken: string; encryptionKey: string; refreshToken?: string };

type Wallet = { id: string; address: string; blockchain: string; [key: string]: unknown };

const ALLOWED_RETURN_TO = ["/smb", "/lp"];
const RETURN_TO_KEY = "sugarc_auth_return_to";

function isAllowedReturnTo(path: string | null): path is string {
  if (!path || typeof path !== "string") return false;
  return ALLOWED_RETURN_TO.includes(path);
}

function getReturnTo(urlParam: string | null): string | null {
  if (isAllowedReturnTo(urlParam)) return urlParam;
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem(RETURN_TO_KEY);
  if (isAllowedReturnTo(stored)) return stored;
  return null;
}

function clearReturnTo() {
  if (typeof window !== "undefined") sessionStorage.removeItem(RETURN_TO_KEY);
}

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const { setAuth, setWalletInfo, isAuthenticated, wallet } = useAuth();
  const sdkRef = useRef<W3SSdk | null>(null);
  const acceptingLoginRef = useRef(true);

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
  const [signInLoading, setSignInLoading] = useState(false);
  const [initUserLoading, setInitUserLoading] = useState(false);
  const [createWalletLoading, setCreateWalletLoading] = useState(false);
  const initUserRunRef = useRef(false);
  const executeChallengeRunRef = useRef(false);

  useEffect(() => {
    acceptingLoginRef.current = true;
    let cancelled = false;

    // Persist returnTo across OAuth redirect (Google strips URL params on callback)
    if (typeof window !== "undefined" && isAllowedReturnTo(returnTo)) {
      sessionStorage.setItem(RETURN_TO_KEY, returnTo);
    }

    const stored =
      typeof window !== "undefined" ? window.sessionStorage.getItem("circle_login_result") : null;
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as LoginResult;
        if (parsed?.userToken && parsed?.encryptionKey) {
          setLoginResult(parsed);
          setStatus("Login successful. Credentials received from Google.");
        }
      } catch {
        // ignore
      }
    }

    const initSdk = async () => {
      try {
        const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");
        const onLoginComplete = (error: unknown, result?: { userToken?: string; encryptionKey?: string; refreshToken?: string }) => {
          if (error) {
            const err = error as { message?: string };
            if (acceptingLoginRef.current) {
              setLoginError(err?.message || "Login failed");
              setLoginResult(null);
              setStatus("Login failed");
            }
            if (typeof window !== "undefined") window.sessionStorage.removeItem("circle_login_result");
            return;
          }
          const userToken = result?.userToken;
          const encryptionKey = result?.encryptionKey;
          const refreshToken = result?.refreshToken;
          if (!userToken || !encryptionKey) return;
          const toStore = { userToken, encryptionKey, ...(refreshToken && { refreshToken }) };
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem("circle_login_result", JSON.stringify(toStore));
          }
          if (acceptingLoginRef.current) {
            setLoginResult({ userToken, encryptionKey, ...(refreshToken && { refreshToken }) });
            setLoginError(null);
            setStatus("Login successful. Credentials received from Google.");
          }
        };

        const restoredAppId = (getCookie("appId") as string) || appId || "";
        const restoredGoogleClientId = (getCookie("google.clientId") as string) || googleClientId || "";
        const restoredDeviceToken = (getCookie("deviceToken") as string) || "";
        const restoredDeviceEncryptionKey = (getCookie("deviceEncryptionKey") as string) || "";

        const initialConfig = {
          appSettings: { appId: restoredAppId },
          loginConfigs: {
            deviceToken: restoredDeviceToken,
            deviceEncryptionKey: restoredDeviceEncryptionKey,
            google: {
              clientId: restoredGoogleClientId,
              redirectUri: typeof window !== "undefined" ? `${window.location.origin}/auth` : "",
              selectAccountPrompt: true,
            },
          },
        };

        const sdk = new W3SSdk(initialConfig, onLoginComplete);
        sdkRef.current = sdk;

        if (!cancelled) {
          setSdkReady(true);
          if (restoredDeviceToken && restoredDeviceEncryptionKey) {
            setDeviceToken(restoredDeviceToken);
            setDeviceEncryptionKey(restoredDeviceEncryptionKey);
            const hasCallback =
              typeof window !== "undefined" &&
              (!!window.location.hash || window.location.search.includes("code="));
            if (hasCallback) {
              setStatus("Completing sign-in… Waiting for verification.");
            } else {
              setStatus("SDK initialized. Ready to create device token.");
            }
          } else {
            setStatus("SDK initialized. Ready to create device token.");
          }
        }
      } catch (err) {
        if (!cancelled) setStatus("Failed to initialize Web SDK");
      }
    };

    void initSdk();
    return () => {
      cancelled = true;
      acceptingLoginRef.current = false;
    };
  }, []);

  useEffect(() => {
    const sdk = sdkRef.current;
    if (!sdk) return;
    const run = async () => {
      try {
        const cached = typeof window !== "undefined" ? window.localStorage.getItem("deviceId") : null;
        if (cached) {
          setDeviceId(cached);
          return;
        }
        setDeviceIdLoading(true);
        const id = await sdk.getDeviceId();
        setDeviceId(id);
        if (typeof window !== "undefined") window.localStorage.setItem("deviceId", id);
      } catch {
        setStatus("Failed to get deviceId");
      } finally {
        setDeviceIdLoading(false);
      }
    };
    if (sdkReady) void run();
  }, [sdkReady]);

  useEffect(() => {
    if (!loginResult) initUserRunRef.current = false;
  }, [loginResult]);

  useEffect(() => {
    if (!challengeId) executeChallengeRunRef.current = false;
  }, [challengeId]);

  /** Auto-run initialize user when we have loginResult and no wallets yet (merge step 3 into flow). */
  useEffect(() => {
    if (!loginResult?.userToken || wallets.length > 0 || initUserRunRef.current) return;
    initUserRunRef.current = true;
    setInitUserLoading(true);
    setStatus("Initializing your account…");
    fetch("/api/endpoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "initializeUser", userToken: loginResult.userToken }),
    })
      .then((res) => res.json())
      .then(async (data) => {
        if (!data.code && data.challengeId) {
          setChallengeId(data.challengeId);
          setStatus("Creating your wallet…");
          return;
        }
        if (data.code === 155106) {
          await loadWallets(loginResult.userToken, { source: "alreadyInitialized" });
          setChallengeId(null);
          return;
        }
        setStatus("Failed to initialize user: " + (data.error || data.message || ""));
      })
      .catch(() => setStatus("Failed to initialize user."))
      .finally(() => {
        setInitUserLoading(false);
      });
  }, [loginResult?.userToken, wallets.length]);

  /** Auto-execute challenge when we have challengeId (new user, no wallet yet) — merge "Create wallet" into flow. */
  useEffect(() => {
    const sdk = sdkRef.current;
    if (!challengeId || !loginResult?.userToken || !loginResult?.encryptionKey || wallets.length > 0 || executeChallengeRunRef.current || !sdk) return;
    executeChallengeRunRef.current = true;
    setCreateWalletLoading(true);
    setStatus("Creating your wallet…");
    const userToken = loginResult.userToken;
    const encryptionKey = loginResult.encryptionKey;
    sdk.setAuthentication({ userToken, encryptionKey });
    sdk.execute(challengeId, (error) => {
      const err = (error || {}) as { message?: string };
      if (error) {
        setStatus("Failed to create wallet: " + (err?.message ?? "Unknown error"));
        setChallengeId(null);
        setCreateWalletLoading(false);
        executeChallengeRunRef.current = false;
        return;
      }
      setStatus("Wallet created. Loading details…");
      setChallengeId(null);
      setCreateWalletLoading(false);
      void loadWallets(userToken, { source: "afterCreate" }).catch(() => {
        setStatus("Wallet created, but failed to load wallet details.");
      });
    });
  }, [challengeId, loginResult?.userToken, loginResult?.encryptionKey, wallets.length]);

  function chainKeyFromBlockchain(b: string): keyof BalancesPerChain | null {
    const u = (b ?? "").toUpperCase();
    if (u.includes("ARC")) return "arc";
    if (u.includes("BASE")) return "baseSepolia";
    if (u.includes("ETH") && u.includes("SEPOLIA")) return "sepolia";
    return null;
  }

  async function loadUsdcBalance(userToken: string, walletId: string) {
    try {
      const response = await fetch("/api/endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getTokenBalance", userToken, walletId }),
      });
      const data = await response.json();
      if (!response.ok) return null;
      const balances = (data.tokenBalances as { token?: { symbol?: string; name?: string }; amount?: string }[]) || [];
      const usdcEntry = balances.find(
        (t) => (t.token?.symbol ?? "").startsWith("USDC") || (t.token?.name ?? "").includes("USDC")
      ) ?? null;
      const amount = usdcEntry?.amount ?? "0";
      setUsdcBalance(amount);
      return amount;
    } catch {
      return null;
    }
  }

  const loadWallets = async (
    userToken: string,
    options?: { source?: "afterCreate" | "alreadyInitialized" }
  ) => {
    try {
      setStatus("Loading wallet details…");
      setUsdcBalance(null);
      const response = await fetch("/api/endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "listWallets", userToken }),
      });
      const data = await response.json();
      if (!response.ok) {
        setStatus("Failed to load wallet details");
        return;
      }
      const walletList = (data.wallets as Wallet[]) || [];
      setWallets(walletList);
      if (walletList.length > 0) {
        const balancesPerChain: BalancesPerChain = {};
        const walletsPerChain: WalletsPerChain = {};
        for (const w of walletList) {
          const key = chainKeyFromBlockchain(w.blockchain);
          if (!key) continue;
          walletsPerChain[key] = { id: w.id, address: w.address, blockchain: w.blockchain };
          const res = await fetch("/api/endpoints", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "getTokenBalance", userToken, walletId: w.id }),
          });
          const balData = await res.json();
          const balList = (balData.tokenBalances as { token?: { symbol?: string }; amount?: string }[]) || [];
          const usdc = balList.find(
            (b) => (b.token?.symbol ?? "").startsWith("USDC") || (b.token?.symbol ?? "").includes("USDC")
          );
          balancesPerChain[key] = usdc?.amount ?? "0";
        }
        const primary = walletList[0];
        const balance = balancesPerChain.arc ?? "0";
        setUsdcBalance(balance);
        const walletInfo = { id: primary.id, address: primary.address, blockchain: primary.blockchain };
        if (options?.source === "afterCreate" || options?.source === "alreadyInitialized") {
          setAuth({
            userToken,
            encryptionKey: loginResult?.encryptionKey ?? "",
            wallet: walletInfo,
            balance,
            balancesPerChain,
          });
          setWalletInfo(walletInfo, balance, balancesPerChain, walletsPerChain);
        }
        setStatus(
          options?.source === "afterCreate"
            ? "Wallet created successfully. Wallet details and USDC balance loaded."
            : options?.source === "alreadyInitialized"
              ? "User already initialized. Wallet details and USDC balance loaded."
              : "Wallet details and USDC balance loaded."
        );
      } else {
        setStatus("No wallets found for this user.");
      }
    } catch {
      setStatus("Failed to load wallet details");
    }
  };

  /** Merged step 1 + 2: always create a fresh device token first, then redirect to Google. */
  const handleSignInWithGoogle = async () => {
    const sdk = sdkRef.current;
    if (!sdk) {
      setStatus("SDK not ready");
      return;
    }
    if (!deviceId) {
      if (deviceIdLoading) setStatus("Preparing…");
      else setStatus("Preparing… Please wait a moment and try again.");
      return;
    }
    setSignInLoading(true);
    try {
      setStatus("Creating device token…");
      const response = await fetch("/api/endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "createDeviceToken", deviceId }),
      });
      const data = await response.json();
      if (!response.ok) {
        setStatus("Failed to create device token");
        setSignInLoading(false);
        return;
      }
      const token = data.deviceToken;
      const key = data.deviceEncryptionKey;
      setDeviceToken(token);
      setDeviceEncryptionKey(key);
      setCookie("appId", appId);
      setCookie("google.clientId", googleClientId);
      setCookie("deviceToken", token);
      setCookie("deviceEncryptionKey", key);
      sdk.updateConfigs({
        appSettings: { appId },
        loginConfigs: {
          deviceToken: token,
          deviceEncryptionKey: key,
          google: {
            clientId: googleClientId,
            redirectUri: `${window.location.origin}/auth`,
            selectAccountPrompt: true,
          },
        },
      });
      setStatus("Redirecting to Google…");
      sdk.performLogin(SocialLoginProvider.GOOGLE);
    } catch {
      setStatus("Something went wrong");
      setSignInLoading(false);
    }
  };

  const primaryWallet = wallets[0];

  // Redirect after login: use returnTo from URL or sessionStorage (persisted across OAuth), else default to /lp
  useEffect(() => {
    if (!isAuthenticated || !wallet) return;
    const target = getReturnTo(returnTo) ?? "/lp";
    clearReturnTo();
    router.replace(target);
  }, [isAuthenticated, wallet, returnTo, router]);

  if (isAuthenticated && wallet) {
    return (
      <Container>
        <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-12 text-center">
          <p className="text-muted-foreground">Taking you to your dashboard…</p>
        </div>
      </Container>
    );
  }

  const justBackFromGoogle = !!loginResult && wallets.length === 0;

  return (
    <Container>
      <div className="mx-auto max-w-md py-12 px-4">
        <div className="mb-6 flex items-center justify-between">
          <Button variant="outline" size="sm" asChild>
            <Link href="/">← Back to home</Link>
          </Button>
        </div>

        <Card>
          <CardHeader className="text-center space-y-1">
            <div className="mx-auto mb-2 flex justify-center">
              <Image
                src="/icon.png"
                alt=""
                width={48}
                height={48}
                className="h-12 w-12"
                aria-hidden
              />
            </div>
            <CardTitle className="text-2xl">Welcome to Sugarc</CardTitle>
            <CardDescription>
              Sign in with Google to create your wallet. We&apos;ll set everything up automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {justBackFromGoogle && (initUserLoading || createWalletLoading) && (
              <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                Welcome back. Setting up your wallet…
              </p>
            )}

            <div className="space-y-3">
              <Button
                className="w-full justify-center"
                size="lg"
                onClick={handleSignInWithGoogle}
                disabled={!sdkReady || !deviceId || deviceIdLoading || signInLoading}
              >
                {signInLoading
                  ? status.includes("Redirecting")
                    ? "Redirecting…"
                    : "Preparing…"
                  : "Sign in with Google"}
              </Button>
            </div>

            <p className="text-sm text-muted-foreground border-l-2 border-muted pl-3">
              {status}
            </p>

            {loginError && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {loginError}
              </p>
            )}

            {primaryWallet && (
              <div className="rounded-lg border border-input/40 bg-muted/30 p-4 space-y-2">
                <h3 className="font-semibold text-sm">Wallet</h3>
                <p className="text-sm font-mono text-muted-foreground break-all">
                  {primaryWallet.address}
                </p>
                {usdcBalance !== null && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">USDC balance:</span> {usdcBalance}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
