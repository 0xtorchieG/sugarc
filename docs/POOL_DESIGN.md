# Pool design: tokenized invoice factoring (buckets)

How liquidity pools (buckets) are set up so LPs can choose where to add USDC. Dead simple for MVP.

---

## Pools (buckets)

### Pool A — Prime (lowest risk)

| Criterion | Rule |
|-----------|------|
| **Payer rating** | AAA–A |
| **Tenor** | 7–45 days |
| **Advance (LTV)** | up to 95% |
| **Target APR** | low |
| **Concentration** | Tight limits |

### Pool B — Standard

| Criterion | Rule |
|-----------|------|
| **Payer rating** | BBB–BB, or A with longer tenor |
| **Tenor** | 30–60 days |
| **LTV** | up to 90% |
| **Target APR** | medium |

### Pool C — Growth / High Yield

| Criterion | Rule |
|-----------|------|
| **Payer rating** | B or Unknown (but not flagged) |
| **Tenor** | up to 90 days |
| **LTV** | up to 80–85% |
| **Target APR** | high |
| **Protection** | Stronger caps + bigger reserve |

### Pool D — Special Situations (optional, hidden in MVP)

- Anything that fails rules but can be **manually approved** later.
- **Hide in MVP**; can surface later.

---

## Deterministic scoring (MVP-friendly)

No ML. Simple **points model**:

**Score = credit + tenor + amount**

### Credit rating points

| Rating | Points |
|--------|--------|
| AAA | 0 |
| AA | 1 |
| A | 2 |
| BBB | 4 |
| BB | 6 |
| B | 8 |
| Unknown | 7 |

### Tenor points

| Tenor | Points |
|-------|--------|
| 0–30 days | 0 |
| 31–60 days | 2 |
| 61–90 days | 4 |
| >90 days | **reject** (MVP) |

### Amount points (concentration proxy)

| Amount | Points |
|--------|--------|
| <10k | 0 |
| 10–50k | 1 |
| 50–200k | 2 |
| >200k | 4 (or require manual) |

Use score (and any hard rules) to assign an invoice to **Prime**, **Standard**, or **High Yield**. Special Situations (D) = manual approval path; hide in MVP.

---

## UI: pool cards

Each pool card shows:

| Field | Description |
|-------|-------------|
| **Pool name** | Prime / Standard / High Yield |
| **Target APR** | Range is fine in MVP (e.g. 4–6%, 7–10%, 11–14%) |
| **Risk badge** | Low / Med / High |
| **Utilization** | outstanding / total liquidity (e.g. 68%) |
| **Avg tenor** | e.g. 41 days |
| **Reserve / protection** | “Coming soon” ok in MVP |
| **CTA** | “Add USDC” (later: Withdraw, View holdings, Claim rewards) |

---

## Data model (frontend)

- **LpPool**: `id`, `name`, `kind` (prime | standard | highYield), `riskTier`, `targetApr`, `tvl`, `utilization`, `avgTenor`, `reserveProtection`.
- **POOL_SCORING** (in `types.ts`): reference for credit/tenor/amount points when backend implements assignment.

---

## Summary

| Pool | Risk | Target APR | Payer | Tenor | LTV |
|------|------|------------|-------|-------|-----|
| **Prime** | Low | low | AAA–A | 7–45d | up to 95% |
| **Standard** | Med | medium | BBB–BB or A (longer) | 30–60d | up to 90% |
| **High Yield** | High | high | B or Unknown (not flagged) | up to 90d | 80–85% |
| **Special Situations** | — | — | Manual approval | — | — (MVP: hidden) |
