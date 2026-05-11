export interface PayoutRecord {
  /** Stellar transaction hash. */
  txHash: string;
  /** Index of the event within the transaction (for idempotency). */
  logIndex: number;
  batchId: string;
  payee: string;
  /** Amount in base units as a decimal string (avoids BigInt precision loss in SQLite). */
  amountBase: string;
  /** Human-readable amount, e.g. "250.50". */
  amountDisplay: string;
  department: string;
  ledger: number;
  createdAt: string;
}

/** Shape returned by the API, aligned with what harbor-frontend consumes. */
export interface PayoutApiItem {
  txHash: string;
  index: number;
  batchId: string;
  payee: string;
  amount: string;
  token: string;
  date: string;
  ledger: number;
}

export interface PayoutEventRaw {
  txHash: string;
  logIndex: number;
  ledger: number;
  topic: string[];
  data: unknown;
}
