import type { SmbStats, SmbInvoiceRecord } from "./types";

/**
 * Mock SMB stats (read from chain by wallet later). Invoices in hundreds.
 */
export const mockSmbStats: SmbStats = {
  totalFactoredUsdc: "1,287.50",
  totalReceivedUsdc: "1,237.20",
  activeInvoicesCount: 3,
  settledInvoicesCount: 12,
};

/**
 * Mock factored invoices (active + recent settled). Amounts in hundreds. Chain-derived later.
 */
export const mockSmbInvoices: SmbInvoiceRecord[] = [
  {
    id: "inv_001",
    amountUsdc: "450.00",
    receivedUsdc: "429.75",
    status: "active",
    dueDate: "2025-02-15",
    factoredAt: "2025-01-10",
    pool: "Prime",
  },
  {
    id: "inv_002",
    amountUsdc: "285.00",
    receivedUsdc: "270.68",
    status: "active",
    dueDate: "2025-02-28",
    factoredAt: "2025-01-18",
    pool: "Standard",
  },
  {
    id: "inv_003",
    amountUsdc: "150.00",
    receivedUsdc: "135.00",
    status: "active",
    dueDate: "2025-03-05",
    factoredAt: "2025-01-22",
    pool: "High Yield",
  },
  {
    id: "inv_004",
    amountUsdc: "320.00",
    receivedUsdc: "307.20",
    status: "settled",
    dueDate: "2025-01-25",
    factoredAt: "2024-12-01",
    pool: "Prime",
  },
  {
    id: "inv_005",
    amountUsdc: "182.00",
    receivedUsdc: "172.90",
    status: "settled",
    dueDate: "2025-01-10",
    factoredAt: "2024-12-15",
    pool: "Standard",
  },
];
