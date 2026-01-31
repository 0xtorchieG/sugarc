import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { SUGARC_POOL_VAULT_ADDRESS, SUGARC_POOL_VAULT_ABI } from "@/lib/contracts";

const USDC_DECIMALS = 6;
const NUM_POOLS = 3;
const CACHE_TTL_MS = 8_000; // 8 seconds to stay under ~20 req/s on rapid refresh

const POOL_META: { kind: string; name: string; riskTier: string; targetApr: string; description: string }[] = [
  { kind: "prime", name: "Prime", riskTier: "low", targetApr: "4–6%", description: "Payer AAA–A · Tenor 7–45 days · LTV up to 95%. Tight concentration limits." },
  { kind: "standard", name: "Standard", riskTier: "medium", targetApr: "7–10%", description: "Payer BBB–BB or A with longer tenor · Tenor 30–60 days · LTV up to 90%." },
  { kind: "highYield", name: "High Yield", riskTier: "high", targetApr: "11–14%", description: "Payer B or Unknown (not flagged) · Tenor up to 90 days · LTV 80–85%. Stronger caps + bigger reserve." },
];

const cache = new Map<string, { data: { pools: unknown[]; kpis?: unknown }; expires: number }>();

function formatUsdc(raw: bigint): string {
  const n = Number(raw) / 10 ** USDC_DECIMALS;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M USDC`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K USDC`;
  return `${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USDC`;
}

/**
 * GET /api/lp/pools?wallet=0x... (optional)
 * Returns on-chain pool data from SugarcPoolVault. If wallet is provided, includes user deposits for KPIs.
 * Response cached briefly to avoid RPC rate limits.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletParam = searchParams.get("wallet");
    const cacheKey = walletParam && ethers.isAddress(walletParam) ? walletParam.toLowerCase() : "default";

    const now = Date.now();
    const hit = cache.get(cacheKey);
    if (hit && hit.expires > now) {
      return NextResponse.json(hit.data);
    }

    const rpcUrl = process.env.ARC_RPC ?? "https://rpc.testnet.arc.network";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const vault = new ethers.Contract(SUGARC_POOL_VAULT_ADDRESS, SUGARC_POOL_VAULT_ABI as ethers.InterfaceAbi, provider);

    const pools: {
      id: string;
      name: string;
      kind: string;
      description: string;
      riskTier: string;
      targetApr: string;
      tvl: string;
      utilization: string;
      avgTenor: string;
      reserveProtection: string;
      totalDeposits: string;
      totalOutstanding: string;
      availableLiquidity: string;
    }[] = [];

    // Single loop: getPool once per pool (3 RPC calls)
    for (let poolId = 0; poolId < NUM_POOLS; poolId++) {
      const [totalDeposits, totalOutstanding, availableLiquidity] = await vault.getPool(poolId);
      const meta = POOL_META[poolId];
      const totalDepositsNum = Number(totalDeposits);
      const utilizationPct =
        totalDepositsNum > 0
          ? Math.round((Number(totalOutstanding) / totalDepositsNum) * 100)
          : 0;

      pools.push({
        id: `pool-${meta.kind}`,
        name: meta.name,
        kind: meta.kind,
        description: meta.description,
        riskTier: meta.riskTier,
        targetApr: meta.targetApr,
        tvl: formatUsdc(totalDeposits),
        utilization: `${utilizationPct}%`,
        avgTenor: "—",
        reserveProtection: "Coming soon",
        totalDeposits: totalDeposits.toString(),
        totalOutstanding: totalOutstanding.toString(),
        availableLiquidity: availableLiquidity.toString(),
      });
    }

    let kpis: { totalDeposited: string; availableLiquidity: string; earnedFees: string } | undefined;

    if (walletParam && ethers.isAddress(walletParam)) {
      // Only getUserDeposits (3 more RPC calls); reuse pool data for total available liquidity
      let userTotalDeposits = 0n;
      const totalAvailableLiquidity = pools.reduce(
        (sum, p) => sum + BigInt(p.availableLiquidity),
        0n
      );
      for (let poolId = 0; poolId < NUM_POOLS; poolId++) {
        const dep = await vault.getUserDeposits(walletParam, poolId);
        userTotalDeposits += dep;
      }
      kpis = {
        totalDeposited: (Number(userTotalDeposits) / 10 ** USDC_DECIMALS).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " USDC",
        availableLiquidity: formatUsdc(totalAvailableLiquidity),
        earnedFees: "—",
      };
    }

    const data = { pools, kpis };
    cache.set(cacheKey, { data, expires: now + CACHE_TTL_MS });
    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /api/lp/pools", err);
    return NextResponse.json({ error: "Failed to fetch pools" }, { status: 500 });
  }
}
