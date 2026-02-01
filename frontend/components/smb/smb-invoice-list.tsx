"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Search } from "lucide-react";
import type { SmbInvoiceRecord, SmbInvoiceStatus } from "./types";
import { EmptyStateTable } from "@/components/lp/empty-state";
import { cn } from "@/lib/utils";

type SortKey = "status" | "amountUsdc" | "receivedUsdc" | "dueDate" | "pool";
type SortDir = "asc" | "desc";

interface SmbInvoiceListProps {
  invoices: SmbInvoiceRecord[] | null;
  onRefresh?: () => void;
  className?: string;
}

const statusConfig: Record<
  SmbInvoiceStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Active",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  settled: {
    label: "Settled",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
  pending: {
    label: "Pending",
    className: "bg-muted text-muted-foreground",
  },
};

function formatDate(iso: string) {
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

const STATUS_ORDER: Record<SmbInvoiceStatus, number> = {
  pending: 0,
  active: 1,
  settled: 2,
};

function compareRow(a: SmbInvoiceRecord, b: SmbInvoiceRecord, key: SortKey, dir: SortDir): number {
  let cmp = 0;
  switch (key) {
    case "status":
      cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      break;
    case "amountUsdc":
      cmp = parseFloat(a.amountUsdc) - parseFloat(b.amountUsdc);
      break;
    case "receivedUsdc":
      cmp = parseFloat(a.receivedUsdc) - parseFloat(b.receivedUsdc);
      break;
    case "dueDate":
      cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      break;
    case "pool":
      cmp = (a.pool ?? "").localeCompare(b.pool ?? "");
      break;
    default:
      return 0;
  }
  return dir === "asc" ? cmp : -cmp;
}

export function SmbInvoiceList({ invoices, onRefresh, className }: SmbInvoiceListProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [simulatingId, setSimulatingId] = useState<string | null>(null);

  const filteredAndSorted = useMemo(() => {
    const list = invoices ?? [];
    const q = search.trim().toLowerCase();
    const filtered = q
      ? list.filter(
          (row) =>
            row.id.toLowerCase().includes(q) ||
            row.amountUsdc.toLowerCase().includes(q) ||
            row.receivedUsdc.toLowerCase().includes(q) ||
            row.status.toLowerCase().includes(q) ||
            row.dueDate.toLowerCase().includes(q) ||
            (row.pool ?? "").toLowerCase().includes(q)
        )
      : list;
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => compareRow(a, b, sortKey, sortDir));
  }, [invoices, search, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const hasRows = filteredAndSorted.length > 0;

  async function handleSimulatePaid(row: SmbInvoiceRecord) {
    const onchainId = row.onchainInvoiceId;
    if (!onchainId || row.status !== "active") return;
    setSimulatingId(row.id);
    try {
      const res = await fetch(`/api/invoices/${onchainId}/simulate-paid`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.details ?? err.error ?? "Simulate paid failed");
      }
      await onRefresh?.();
    } catch (e) {
      console.error("Simulate paid", e);
      alert(e instanceof Error ? e.message : "Simulate paid failed");
    } finally {
      setSimulatingId(null);
    }
  }

  // Show "Simulate paid" when we have any active funded invoice (so the action is discoverable)
  const showDemoButton =
    !!onRefresh &&
    (invoices?.some((i) => i.status === "active" && i.onchainInvoiceId) ?? false);

  const emptyMessage =
    (invoices?.length ?? 0) === 0
      ? "Factored invoices will appear here (from your wallet on chain)."
      : "No invoices match your search.";

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          Factored invoices
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Active and recent settled. Data from chain. Use{" "}
          <strong>Simulate paid</strong> on active invoices to demo the full
          repayment cycle.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {invoices && invoices.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by status, amount, date, pool…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        )}
        {!hasRows ? (
          <EmptyStateTable
            title={search.trim() ? "No matches" : "No invoices yet"}
            description={emptyMessage}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => handleSort("status")}
                    className="inline-flex items-center gap-1.5 font-medium hover:text-foreground"
                  >
                    Status
                    {sortKey === "status" ? (
                      sortDir === "asc" ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : (
                        <ArrowDown className="h-4 w-4" />
                      )
                    ) : (
                      <ArrowUpDown className="h-4 w-4 opacity-50" />
                    )}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => handleSort("amountUsdc")}
                    className="inline-flex items-center gap-1.5 font-medium hover:text-foreground"
                  >
                    Amount
                    {sortKey === "amountUsdc" ? (
                      sortDir === "asc" ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : (
                        <ArrowDown className="h-4 w-4" />
                      )
                    ) : (
                      <ArrowUpDown className="h-4 w-4 opacity-50" />
                    )}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => handleSort("receivedUsdc")}
                    className="inline-flex items-center gap-1.5 font-medium hover:text-foreground"
                  >
                    Received
                    {sortKey === "receivedUsdc" ? (
                      sortDir === "asc" ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : (
                        <ArrowDown className="h-4 w-4" />
                      )
                    ) : (
                      <ArrowUpDown className="h-4 w-4 opacity-50" />
                    )}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => handleSort("dueDate")}
                    className="inline-flex items-center gap-1.5 font-medium hover:text-foreground"
                  >
                    Due date
                    {sortKey === "dueDate" ? (
                      sortDir === "asc" ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : (
                        <ArrowDown className="h-4 w-4" />
                      )
                    ) : (
                      <ArrowUpDown className="h-4 w-4 opacity-50" />
                    )}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => handleSort("pool")}
                    className="inline-flex items-center gap-1.5 font-medium hover:text-foreground"
                  >
                    Pool
                    {sortKey === "pool" ? (
                      sortDir === "asc" ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : (
                        <ArrowDown className="h-4 w-4" />
                      )
                    ) : (
                      <ArrowUpDown className="h-4 w-4 opacity-50" />
                    )}
                  </button>
                </TableHead>
                {showDemoButton && (
                  <TableHead className="min-w-[7rem] whitespace-nowrap">
                    Actions
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSorted.map((row) => {
                const status = statusConfig[row.status];
                const canSimulate =
                  showDemoButton &&
                  row.status === "active" &&
                  row.onchainInvoiceId != null;
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          status.className
                        )}
                      >
                        {status.label}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium tabular-nums">
                      {row.amountUsdc} USDC
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {row.receivedUsdc} USDC
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(row.dueDate)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.pool}
                    </TableCell>
                    {showDemoButton && (
                      <TableCell className="whitespace-nowrap">
                        {canSimulate ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={simulatingId === row.id}
                            onClick={() => handleSimulatePaid(row)}
                            title="Demo: marks invoice as repaid on-chain (approve USDC + repay)"
                            className="min-w-0 shrink-0"
                          >
                            {simulatingId === row.id ? (
                              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                            ) : (
                              <span className="truncate">Simulate paid</span>
                            )}
                          </Button>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
