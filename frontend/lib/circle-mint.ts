/**
 * Circle Mint API client for wire deposits (BE-008).
 * Sandbox: https://api-sandbox.circle.com
 * Production: https://api.circle.com
 */

const MINT_BASE =
  process.env.CIRCLE_MINT_BASE_URL ?? "https://api-sandbox.circle.com";

export type MockWireRequest = {
  amount: string;
  currency?: string;
  beneficiaryBank: { accountNumber: string };
  trackingRef?: string;
};

export type MockWireResponse = {
  trackingRef: string;
  amount: { amount: string; currency: string };
  beneficiaryBank: { accountNumber: string };
  status: "pending" | "complete" | "failed";
};

export type WireAccount = {
  id: string;
  status: string;
  trackingRef: string;
  description: string;
};

export type WireInstructions = {
  trackingRef: string;
  beneficiary?: { name?: string; address1?: string; address2?: string };
  beneficiaryBank?: {
    name?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    country?: string;
    swiftCode?: string;
    routingNumber?: string;
    accountNumber: string;
    currency: string;
  };
};

export type Deposit = {
  id: string;
  amount: { amount: string; currency: string };
  status: string;
  createDate: string;
  updateDate: string;
  customerExternalRef?: string;
};

async function mintFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey =
    process.env.CIRCLE_SAND_API_KEY ??
    process.env.CIRCLE_MINT_API_KEY ??
    process.env.CIRCLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "CIRCLE_SAND_API_KEY, CIRCLE_MINT_API_KEY, or CIRCLE_API_KEY required for Circle Mint"
    );
  }
  const url = `${MINT_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.message ?? json?.error ?? res.statusText;
    throw new Error(`Circle Mint ${path}: ${msg}`);
  }
  return json as T;
}

/** List wire bank accounts. Returns accounts with status "complete". */
export async function listWireAccounts(): Promise<WireAccount[]> {
  const data = await mintFetch<{ data: WireAccount[] }>(
    "/v1/businessAccount/banks/wires"
  );
  return data.data ?? [];
}

/** Get wire instructions (account number for mock wire). */
export async function getWireInstructions(
  wireAccountId: string,
  currency = "USD"
): Promise<WireInstructions> {
  const data = await mintFetch<{ data: WireInstructions }>(
    `/v1/businessAccount/banks/wires/${wireAccountId}/instructions?currency=${currency}`
  );
  return data.data!;
}

/** Create mock wire payment (sandbox only). */
export async function createMockWirePayment(
  req: MockWireRequest
): Promise<MockWireResponse> {
  const body = {
    amount: { amount: req.amount, currency: req.currency ?? "USD" },
    beneficiaryBank: req.beneficiaryBank,
    ...(req.trackingRef && { trackingRef: req.trackingRef }),
  };
  const data = await mintFetch<{ data: MockWireResponse }>(
    "/v1/mocks/payments/wire",
    { method: "POST", body: JSON.stringify(body) }
  );
  return data.data!;
}

/** List wire deposits. Poll until status is "complete". */
export async function listWireDeposits(options?: {
  from?: string;
  to?: string;
  pageSize?: number;
}): Promise<Deposit[]> {
  const params = new URLSearchParams();
  params.set("type", "wire");
  if (options?.from) params.set("from", options.from);
  if (options?.to) params.set("to", options.to);
  if (options?.pageSize) params.set("pageSize", String(options.pageSize));
  const data = await mintFetch<{ data: Deposit[] }>(
    `/v1/businessAccount/deposits?${params}`
  );
  return data.data ?? [];
}

/** Get beneficiary account number for mock wire. */
export async function getBeneficiaryAccountNumber(): Promise<string> {
  const override = process.env.CIRCLE_MINT_BENEFICIARY_ACCOUNT;
  if (override?.trim()) return override.trim();

  const wireAccountId =
    process.env.CIRCLE_MINT_WIRE_ACCOUNT_ID ??
    (await listWireAccounts()).find((a) => a.status === "complete")?.id;
  if (!wireAccountId) {
    throw new Error(
      "No wire account. Set CIRCLE_MINT_WIRE_ACCOUNT_ID or CIRCLE_MINT_BENEFICIARY_ACCOUNT, or create a wire account via Circle Mint API."
    );
  }
  const instructions = await getWireInstructions(wireAccountId);
  const accountNumber = instructions.beneficiaryBank?.accountNumber;
  if (!accountNumber || accountNumber.includes("*")) {
    throw new Error(
      "Wire account number not available (masked). Set CIRCLE_MINT_BENEFICIARY_ACCOUNT with the full account number from Circle console."
    );
  }
  return accountNumber;
}
