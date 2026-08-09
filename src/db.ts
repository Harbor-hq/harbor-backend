import { DatabaseSync } from "node:sqlite";
import { mkdirSync, statSync } from "node:fs";
import { dirname } from "node:path";
import type { PayoutRecord } from "./types.js";

export interface PayoutFilters {
  batchId?: string;
  payee?: string;
  department?: string;
  limit: number;
  cursor?: number;
}

export interface PayoutPage {
  payouts: PayoutRecord[];
  nextCursor: number | null;
}

export interface ListenerHealth {
  lastLedger: number;
  payoutCount: number;
  /** Difference between the latest known on-chain ledger and the newest indexed payout. */
  backlog: number;
  /** Database file size in bytes. */
  sizeBytes: number;
}

const MOCK_CONTRACT_ID = "CD4U2T3X5K7G2J6L4A8B9Z1Y0W_MOCK_CONTRACT_ID";

export class Store {
  private db: DatabaseSync;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    if (dbPath !== ":memory:") {
      mkdirSync(dirname(dbPath), { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS payouts (
        tx_hash       TEXT    NOT NULL,
        log_index     INTEGER NOT NULL,
        batch_id      TEXT    NOT NULL,
        payee         TEXT    NOT NULL,
        amount_base   TEXT    NOT NULL,
        amount_display TEXT   NOT NULL,
        department    TEXT    NOT NULL DEFAULT '',
        ledger        INTEGER NOT NULL,
        created_at    TEXT    NOT NULL,
        PRIMARY KEY (tx_hash, log_index)
      );
      CREATE INDEX IF NOT EXISTS idx_payouts_batch  ON payouts (batch_id);
      CREATE INDEX IF NOT EXISTS idx_payouts_payee  ON payouts (payee);
      CREATE INDEX IF NOT EXISTS idx_payouts_ledger ON payouts (ledger);

      CREATE TABLE IF NOT EXISTS checkpoints (
        contract_id TEXT PRIMARY KEY,
        last_ledger INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS erp_outbox (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type  TEXT    NOT NULL,
        payload     TEXT    NOT NULL,
        status      TEXT    NOT NULL DEFAULT 'pending',
        created_at  TEXT    NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_outbox_status ON erp_outbox (status);
    `);
  }

  close(): void {
    this.db.close();
  }

  getCheckpoint(contractId: string): number | null {
    const row = this.db
      .prepare("SELECT last_ledger FROM checkpoints WHERE contract_id = ?")
      .get(contractId) as { last_ledger: number } | undefined;
    return row?.last_ledger ?? null;
  }

  setCheckpoint(contractId: string, ledger: number): void {
    this.db
      .prepare(
        `INSERT INTO checkpoints (contract_id, last_ledger) VALUES (?, ?)
         ON CONFLICT(contract_id) DO UPDATE SET last_ledger = excluded.last_ledger`
      )
      .run(contractId, ledger);
  }

  /** Insert a payout, ignoring duplicates keyed on (tx_hash, log_index). */
  insertPayout(payout: PayoutRecord): boolean {
    const res = this.db
      .prepare(
        `INSERT OR IGNORE INTO payouts
           (tx_hash, log_index, batch_id, payee, amount_base, amount_display, department, ledger, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        payout.txHash,
        payout.logIndex,
        payout.batchId,
        payout.payee,
        payout.amountBase,
        payout.amountDisplay,
        payout.department,
        payout.ledger,
        payout.createdAt
      );
    return res.changes > 0;
  }

  listPayouts(filters: PayoutFilters): PayoutPage {
    const clauses: string[] = [];
    const args: (string | number)[] = [];

    if (filters.batchId) {
      clauses.push("batch_id = ?");
      args.push(filters.batchId);
    }
    if (filters.payee) {
      clauses.push("payee = ?");
      args.push(filters.payee);
    }
    if (filters.department) {
      clauses.push("department = ?");
      args.push(filters.department);
    }
    if (filters.cursor) {
      clauses.push("rowid < ?");
      args.push(filters.cursor);
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.db
      .prepare(
        `SELECT rowid, tx_hash AS txHash, log_index AS logIndex, batch_id AS batchId,
                payee, amount_base AS amountBase, amount_display AS amountDisplay,
                department, ledger, created_at AS createdAt
         FROM payouts ${where}
         ORDER BY rowid DESC
         LIMIT ?`
      )
      .all(...args, filters.limit + 1) as unknown as Array<
      PayoutRecord & { rowid: number }
    >;

    const hasMore = rows.length > filters.limit;
    const pageRows = hasMore ? rows.slice(0, filters.limit) : rows;
    const payouts = pageRows.map(({ rowid: _rowid, ...rest }) => rest);
    const nextCursor = hasMore ? pageRows[pageRows.length - 1]?.rowid ?? null : null;

    return { payouts, nextCursor };
  }

  /** All payout events for a transaction hash, ordered by log index. */
  getPayouts(txHash: string): PayoutRecord[] {
    return this.db
      .prepare(
        `SELECT tx_hash AS txHash, log_index AS logIndex, batch_id AS batchId,
                payee, amount_base AS amountBase, amount_display AS amountDisplay,
                department, ledger, created_at AS createdAt
         FROM payouts WHERE tx_hash = ? ORDER BY log_index ASC`
      )
      .all(txHash) as unknown as PayoutRecord[];
  }

  health(latestOnChainLedger?: number): ListenerHealth {
    const lastLedger = this.db
      .prepare("SELECT MAX(ledger) AS l FROM payouts")
      .get() as { l: number | null };
    const payoutCount = this.db
      .prepare("SELECT COUNT(*) AS c FROM payouts")
      .get() as { c: number };
    const last = lastLedger.l ?? 0;
    const backlog =
      latestOnChainLedger !== undefined && latestOnChainLedger >= last
        ? latestOnChainLedger - last
        : 0;
    let sizeBytes = 0;
    if (this.dbPath !== ":memory:") {
      try {
        sizeBytes = statSync(this.dbPath).size;
      } catch {}
    }
    return {
      lastLedger: last,
      payoutCount: payoutCount.c,
      backlog,
      sizeBytes,
    };
  }

  isMockContract(contractId: string): boolean {
    return contractId === MOCK_CONTRACT_ID;
  }
}
