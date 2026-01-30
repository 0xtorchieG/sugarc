"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "circle_login_result";
const WALLET_STORAGE_KEY = "sugarc_wallet";

export type WalletInfo = {
  id: string;
  address: string;
  blockchain: string;
};

type StoredAuth = {
  userToken: string;
  encryptionKey: string;
};

type AuthState = {
  userToken: string | null;
  encryptionKey: string | null;
  wallet: WalletInfo | null;
  balance: string | null;
  isAuthenticated: boolean;
  isRestoring: boolean;
};

type AuthContextValue = AuthState & {
  setAuth: (params: {
    userToken: string;
    encryptionKey: string;
    wallet?: WalletInfo | null;
    balance?: string | null;
  }) => void;
  setWalletInfo: (wallet: WalletInfo | null, balance: string | null) => void;
  logout: () => void;
  refreshWallet: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function loadStoredLogin(): StoredAuth | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    if (parsed?.userToken && parsed?.encryptionKey) return parsed;
  } catch {
    // ignore
  }
  return null;
}

function loadStoredWallet(): { wallet: WalletInfo; balance: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(WALLET_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { wallet: WalletInfo; balance: string };
    if (parsed?.wallet?.address) return parsed;
  } catch {
    // ignore
  }
  return null;
}

async function fetchWalletsAndBalance(userToken: string): Promise<{
  wallet: WalletInfo | null;
  balance: string | null;
}> {
  try {
    const res = await fetch("/api/endpoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "listWallets", userToken }),
    });
    const data = await res.json();
    if (!res.ok || !data.wallets?.length) return { wallet: null, balance: null };

    const wallet = data.wallets[0] as WalletInfo;

    const balanceRes = await fetch("/api/endpoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "getTokenBalance",
        userToken,
        walletId: wallet.id,
      }),
    });
    const balanceData = await balanceRes.json();
    const balances =
      (balanceData.tokenBalances as { token?: { symbol?: string }; amount?: string }[]) || [];
    const usdc = balances.find(
      (b) =>
        (b.token?.symbol ?? "").startsWith("USDC") ||
        (b.token?.symbol ?? "").includes("USDC")
    );
    const balance = usdc?.amount ?? "0";

    return { wallet, balance };
  } catch {
    return { wallet: null, balance: null };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    userToken: null,
    encryptionKey: null,
    wallet: null,
    balance: null,
    isAuthenticated: false,
    isRestoring: true,
  });

  const setAuth = useCallback(
    (params: {
      userToken: string;
      encryptionKey: string;
      wallet?: WalletInfo | null;
      balance?: string | null;
    }) => {
      const { userToken, encryptionKey, wallet = null, balance = null } = params;
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ userToken, encryptionKey })
        );
        if (wallet) {
          window.sessionStorage.setItem(
            WALLET_STORAGE_KEY,
            JSON.stringify({ wallet, balance: balance ?? "0" })
          );
        }
      }
      setState({
        userToken,
        encryptionKey,
        wallet: wallet ?? null,
        balance: balance ?? null,
        isAuthenticated: true,
        isRestoring: false,
      });
    },
    []
  );

  const setWalletInfo = useCallback((wallet: WalletInfo | null, balance: string | null) => {
    if (wallet && typeof window !== "undefined") {
      window.sessionStorage.setItem(
        WALLET_STORAGE_KEY,
        JSON.stringify({ wallet, balance: balance ?? "0" })
      );
    }
    setState((prev) => ({
      ...prev,
      wallet,
      balance,
    }));
  }, []);

  const logout = useCallback(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(STORAGE_KEY);
      window.sessionStorage.removeItem(WALLET_STORAGE_KEY);
    }
    setState({
      userToken: null,
      encryptionKey: null,
      wallet: null,
      balance: null,
      isAuthenticated: false,
      isRestoring: false,
    });
  }, []);

  const refreshWallet = useCallback(async () => {
    const stored = loadStoredLogin();
    if (!stored?.userToken) return;
    const { wallet, balance } = await fetchWalletsAndBalance(stored.userToken);
    setWalletInfo(wallet, balance);
    if (wallet && typeof window !== "undefined") {
      window.sessionStorage.setItem(
        WALLET_STORAGE_KEY,
        JSON.stringify({ wallet, balance: balance ?? "0" })
      );
    }
  }, [setWalletInfo]);

  useEffect(() => {
    const stored = loadStoredLogin();
    if (!stored) {
      setState((prev) => ({ ...prev, isRestoring: false }));
      return;
    }

    const cached = loadStoredWallet();
    if (cached) {
      setState({
        userToken: stored.userToken,
        encryptionKey: stored.encryptionKey,
        wallet: cached.wallet,
        balance: cached.balance,
        isAuthenticated: true,
        isRestoring: false,
      });
      return;
    }

    setState((prev) => ({
      ...prev,
      userToken: stored.userToken,
      encryptionKey: stored.encryptionKey,
      isAuthenticated: true,
      isRestoring: false,
    }));

    void fetchWalletsAndBalance(stored.userToken).then(({ wallet, balance }) => {
      setState((prev) => ({
        ...prev,
        wallet,
        balance,
      }));
      if (wallet && typeof window !== "undefined") {
        window.sessionStorage.setItem(
          WALLET_STORAGE_KEY,
          JSON.stringify({ wallet, balance: balance ?? "0" })
        );
      }
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      setAuth,
      setWalletInfo,
      logout,
      refreshWallet,
    }),
    [state, setAuth, setWalletInfo, logout, refreshWallet]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
