"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";
import type { SmbInvoiceRecord, SmbInvoiceStatus } from "./types";
import { EmptyStateTable } from "@/components/lp/empty-state";
import { cn } from "@/lib/utils";

interface SmbInvoiceListProps {
  invoices: SmbInvoiceRecord[] | null;
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

export function SmbInvoiceList({ invoices, className }: SmbInvoiceListProps) {
  const hasRows = invoices && invoices.length > 0;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          Factored invoices
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Active and recent settled. Data from chain (mock for now).
        </p>
      </CardHeader>
      <CardContent>
        {!hasRows ? (
          <EmptyStateTable
            title="No invoices yet"
            description="Factored invoices will appear here (from your wallet on chain)."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead>Pool</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((row) => {
                const status = statusConfig[row.status];
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
