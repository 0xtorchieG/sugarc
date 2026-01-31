import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt } from "lucide-react";
import type { LpPayout } from "./types";
import { EmptyStateTable } from "./empty-state";

interface RecentPayoutsProps {
  payouts: LpPayout[] | null;
  className?: string;
}

export function RecentPayouts({ payouts, className }: RecentPayoutsProps) {
  const hasRows = payouts && payouts.length > 0;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-muted-foreground" />
          Recent Payouts
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasRows ? (
          <EmptyStateTable
            title="No payouts yet"
            description="Recent payouts will appear here."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Pool</TableHead>
                <TableHead>Tx</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-muted-foreground">
                    {row.date}
                  </TableCell>
                  <TableCell className="font-medium tabular-nums">
                    {row.amount}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.pool}
                  </TableCell>
                  <TableCell>
                    {row.txHash ? (
                      <span
                        className="max-w-[8rem] truncate font-mono text-xs text-muted-foreground"
                        title={row.txHash}
                      >
                        {row.txHash.slice(0, 8)}…
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
