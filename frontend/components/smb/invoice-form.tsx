"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Calendar, BadgeCheck } from "lucide-react";
import type { CreditRating, SmbInvoiceInput } from "./types";
import { cn } from "@/lib/utils";

const CREDIT_OPTIONS: { value: CreditRating; label: string }[] = [
  { value: "AAA", label: "AAA" },
  { value: "AA", label: "AA" },
  { value: "A", label: "A" },
  { value: "BBB", label: "BBB" },
  { value: "BB", label: "BB" },
  { value: "B", label: "B" },
  { value: "Unknown", label: "Unknown" },
];

interface InvoiceFormProps {
  value: SmbInvoiceInput;
  onChange: (value: SmbInvoiceInput) => void;
  className?: string;
}

function getMinDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function getMaxDate() {
  const d = new Date();
  d.setDate(d.getDate() + 90);
  return d.toISOString().slice(0, 10);
}

export function InvoiceForm({ value, onChange, className }: InvoiceFormProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <Label htmlFor="smb-amount" className="flex items-center gap-2 text-muted-foreground">
          <FileText className="h-4 w-4" />
          Invoice amount (USDC)
        </Label>
        <Input
          id="smb-amount"
          type="number"
          min={1}
          step={0.01}
          placeholder="e.g. 10000"
          value={value.amountUsdc || ""}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            onChange({ ...value, amountUsdc: Number.isNaN(v) ? 0 : v });
          }}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="smb-due-date" className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-4 w-4" />
          Due date
        </Label>
        <Input
          id="smb-due-date"
          type="date"
          min={getMinDate()}
          max={getMaxDate()}
          value={value.dueDate}
          onChange={(e) => onChange({ ...value, dueDate: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="smb-rating" className="flex items-center gap-2 text-muted-foreground">
          <BadgeCheck className="h-4 w-4" />
          Payer credit rating
        </Label>
        <select
          id="smb-rating"
          value={value.payerCreditRating}
          onChange={(e) =>
            onChange({
              ...value,
              payerCreditRating: e.target.value as CreditRating,
            })
          }
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {CREDIT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
