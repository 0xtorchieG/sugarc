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

/** USDC balance per chain (Arc, Base Sepolia, Ethereum Sepolia) */
export type BalancesPerChain = {
  arc?: string;
  baseSepolia?: string;
  sepolia?: string;
};

/** Wallet per chain for Gateway flow (source chain selection) */
export type WalletsPerChain = {
  arc?: WalletInfo;
  baseSepolia?: WalletInfo;
  sepolia?: WalletInfo;
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
  /** USDC per chain for wallet modal */
  balancesPerChain: BalancesPerChain;
  /** Wallet per chain for Gateway flow */
  walletsPerChain: WalletsPerChain;
  isAuthenticated: boolean;
  isRestoring: boolean;
};

type AuthContextValue = AuthState & {
  setAuth: (params: {
    userToken: string;
    encryptionKey: string;
    wallet?: WalletInfo | null;
    balance?: string | null;
    balancesPerChain?: BalancesPerChain;
  }) => void;
  setWalletInfo: (
    wallet: WalletInfo | null,
    balance: string | null,
    balancesPerChain?: BalancesPerChain,
    walletsPerChain?: WalletsPerChain
  ) => void;
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

function loadStoredWallet(): {
  wallet: WalletInfo;
  balance: string;
  balancesPerChain?: BalancesPerChain;
  walletsPerChain?: WalletsPerChain;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(WALLET_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      wallet: WalletInfo;
      balance: string;
      balancesPerChain?: BalancesPerChain;
      walletsPerChain?: WalletsPerChain;
    };
    if (parsed?.wallet?.address) return parsed;
  } catch {
    // ignore
  }
  return null;
}

/** Map Circle blockchain ID to our chain key */
function chainKeyFromBlockchain(b: string): keyof BalancesPerChain | null {
  const u = (b ?? "").toUpperCase();
  if (u.includes("ARC")) return "arc";
  if (u.includes("BASE")) return "baseSepolia";
  if (u.includes("ETH") && u.includes("SEPOLIA")) return "sepolia";
  return null;
}

async function fetchWalletsAndBalance(userToken: string): Promise<{
  wallet: WalletInfo | null;
  balance: string | null;
  balancesPerChain: BalancesPerChain;
  walletsPerChain: WalletsPerChain;
}> {
  try {
    const res = await fetch("/api/endpoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "listWallets", userToken }),
    });
    const data = await res.json();
    if (!res.ok || !data.wallets?.length) {
      return {
        wallet: null,
        balance: null,
        balancesPerChain: {},
        walletsPerChain: {},
      };
    }

    const wallets = data.wallets as WalletInfo[];
    const primary = wallets[0];
    const balancesPerChain: BalancesPerChain = {};
    const walletsPerChain: WalletsPerChain = {};

    for (const w of wallets) {
      const key = chainKeyFromBlockchain(w.blockchain);
      if (!key) continue;
      walletsPerChain[key] = w;
      const balanceRes = await fetch("/api/endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "getTokenBalance",
          userToken,
          walletId: w.id,
        }),
      });
      const balanceData = await balanceRes.json();
      const balances =
        (balanceData.tokenBalances as {
          token?: { symbol?: string };
          amount?: string;
        }[]) || [];
      const usdc = balances.find(
        (b) =>
          (b.token?.symbol ?? "").startsWith("USDC") ||
          (b.token?.symbol ?? "").includes("USDC")
      );
      balancesPerChain[key] = usdc?.amount ?? "0";
    }

    const arcBalance = balancesPerChain.arc ?? "0";
    return {
      wallet: primary,
      balance: arcBalance,
      balancesPerChain,
      walletsPerChain,
    };
  } catch {
    return {
      wallet: null,
      balance: null,
      balancesPerChain: {},
      walletsPerChain: {},
    };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    userToken: null,
    encryptionKey: null,
    wallet: null,
    balance: null,
    balancesPerChain: {},
    walletsPerChain: {},
    isAuthenticated: false,
    isRestoring: true,
  });

  const setAuth = useCallback(
    (params: {
      userToken: string;
      encryptionKey: string;
      wallet?: WalletInfo | null;
      balance?: string | null;
      balancesPerChain?: BalancesPerChain;
    }) => {
      const {
        userToken,
        encryptionKey,
        wallet = null,
        balance = null,
        balancesPerChain = {},
      } = params;
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ userToken, encryptionKey })
        );
        if (wallet) {
          window.sessionStorage.setItem(
            WALLET_STORAGE_KEY,
            JSON.stringify({
              wallet,
              balance: balance ?? "0",
              balancesPerChain: balancesPerChain ?? {},
            })
          );
        }
      }
      setState({
        userToken,
        encryptionKey,
        wallet: wallet ?? null,
        balance: balance ?? null,
        balancesPerChain: params.balancesPerChain ?? {},
        walletsPerChain: {},
        isAuthenticated: true,
        isRestoring: false,
      });
    },
    []
  );

  const setWalletInfo = useCallback(
    (
      wallet: WalletInfo | null,
      balance: string | null,
      balancesPerChain?: BalancesPerChain,
      walletsPerChain?: WalletsPerChain
    ) => {
      if (wallet && typeof window !== "undefined") {
        window.sessionStorage.setItem(
          WALLET_STORAGE_KEY,
          JSON.stringify({
            wallet,
            balance: balance ?? "0",
            balancesPerChain: balancesPerChain ?? {},
            walletsPerChain: walletsPerChain ?? {},
          })
        );
      }
      setState((prev) => ({
        ...prev,
        wallet,
        balance,
        balancesPerChain: balancesPerChain ?? prev.balancesPerChain ?? {},
        walletsPerChain: walletsPerChain ?? prev.walletsPerChain ?? {},
      }));
    },
    []
  );

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
      balancesPerChain: {},
      walletsPerChain: {},
      isAuthenticated: false,
      isRestoring: false,
    });
  }, []);

  const refreshWallet = useCallback(async () => {
    const stored = loadStoredLogin();
    if (!stored?.userToken) return;
    const { wallet, balance, balancesPerChain, walletsPerChain } =
      await fetchWalletsAndBalance(stored.userToken);
    setWalletInfo(wallet, balance, balancesPerChain, walletsPerChain);
    if (wallet && typeof window !== "undefined") {
      window.sessionStorage.setItem(
        WALLET_STORAGE_KEY,
        JSON.stringify({
          wallet,
          balance: balance ?? "0",
          balancesPerChain: balancesPerChain ?? {},
          walletsPerChain: walletsPerChain ?? {},
        })
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
        balancesPerChain: cached.balancesPerChain ?? {},
        walletsPerChain: cached.walletsPerChain ?? {},
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

    void fetchWalletsAndBalance(stored.userToken).then(
      ({ wallet, balance, balancesPerChain, walletsPerChain }) => {
        setState((prev) => ({
          ...prev,
          wallet,
          balance,
          balancesPerChain: balancesPerChain ?? {},
          walletsPerChain: walletsPerChain ?? {},
        }));
        if (wallet && typeof window !== "undefined") {
          window.sessionStorage.setItem(
            WALLET_STORAGE_KEY,
            JSON.stringify({
              wallet,
              balance: balance ?? "0",
              balancesPerChain: balancesPerChain ?? {},
              walletsPerChain: walletsPerChain ?? {},
            })
          );
        }
      }
    );
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
