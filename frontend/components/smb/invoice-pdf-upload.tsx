"use client";

import { useCallback, useState } from "react";
import { Upload, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SmbInvoiceInput } from "./types";

export type ParsedInvoiceFields = {
  customerEmail?: string;
  dueDate?: string;
  faceAmount?: number;
  invoiceNumber?: string;
  payerName?: string;
  currency?: string;
};

export type ParseResult = {
  extractedTextHash: string;
  fields: ParsedInvoiceFields;
};

interface InvoicePdfUploadProps {
  onParsed: (result: ParseResult) => void;
  className?: string;
}

function getDefaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export function InvoicePdfUpload({ onParsed, className }: InvoicePdfUploadProps) {
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        setErrorMessage("Please upload a PDF file.");
        setStatus("error");
        return;
      }
      setStatus("uploading");
      setErrorMessage(null);
      try {
        const formData = new FormData();
        formData.set("file", file);
        const res = await fetch("/api/invoices/parse-pdf", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMessage(data.error ?? data.details ?? "Parse failed");
          setStatus("error");
          return;
        }
        onParsed({
          extractedTextHash: data.extractedTextHash,
          fields: data.fields ?? {},
        });
        setStatus("done");
      } catch {
        setErrorMessage("Upload failed");
        setStatus("error");
      }
    },
    [onParsed]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [handleFile]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
      e.target.value = "";
    },
    [handleFile]
  );

  return (
    <div className={cn("space-y-2", className)}>
      <label
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={cn(
          "flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
          dragOver && "border-primary bg-primary/5",
          status === "uploading" && "pointer-events-none opacity-80",
          status === "error" && "border-destructive/50",
          status === "idle" && !dragOver && "border-muted-foreground/25 hover:border-muted-foreground/50"
        )}
      >
        <input
          type="file"
          accept=".pdf,application/pdf"
          onChange={onInputChange}
          className="sr-only"
        />
        {status === "uploading" ? (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Parsing PDF…</p>
          </>
        ) : status === "done" ? (
          <>
            <CheckCircle2 className="h-10 w-10 text-green-600" />
            <p className="mt-2 text-sm font-medium text-green-700">Parsed successfully</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Drop another PDF to replace</p>
          </>
        ) : (
          <>
            <Upload className="h-10 w-10 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">
              Drop your invoice PDF here or click to browse
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Accepts .pdf only</p>
          </>
        )}
      </label>
      {status === "error" && errorMessage && (
        <p className="text-sm text-destructive">{errorMessage}</p>
      )}
    </div>
  );
}

/** Map parsed PDF fields to SmbInvoiceInput (merge with existing defaults). */
export function parsedFieldsToInput(
  fields: ParsedInvoiceFields,
  existing: Partial<SmbInvoiceInput> = {}
): Partial<SmbInvoiceInput> {
  const dueDate =
    fields.dueDate ?? existing.dueDate ?? getDefaultDueDate();
  const amountUsdc = fields.faceAmount ?? existing.amountUsdc ?? 0;
  return {
    ...existing,
    amountUsdc,
    dueDate,
    customerEmail: fields.customerEmail ?? existing.customerEmail,
    invoiceNumber: fields.invoiceNumber ?? existing.invoiceNumber,
    payerName: fields.payerName ?? existing.payerName,
  };
}
