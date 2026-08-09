import { test } from "node:test";
import assert from "node:assert/strict";
import { Store, type PayoutFilters } from "./db.js";
import type { PayoutRecord } from "./types.js";

function makePayout(overrides: Partial<PayoutRecord> = {}): PayoutRecord {
  return {
    txHash: "deadbeef",
    logIndex: 0,
    batchId: "7",
    payee: "GA5G2RG6KJBDXHLR4DCKOER7P4GR7356O2HKFEJTSVUIVYJZUYX5LPMH",
    amountBase: "250500000",
    amountDisplay: "250.5",
    department: "eng",
    ledger: 100,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("insertPayout is idempotent on (tx_hash, log_index)", () => {
  const store = new Store(":memory:");
  const payout = makePayout();
  assert.equal(store.insertPayout(payout), true);
  assert.equal(store.insertPayout(payout), false);
  assert.equal(store.health().payoutCount, 1);
  store.close();
});

test("listPayouts filters by batchId, payee and department", () => {
  const store = new Store(":memory:");
  store.insertPayout(makePayout({ txHash: "a", batchId: "1", payee: "GA", department: "eng" }));
  store.insertPayout(makePayout({ txHash: "b", batchId: "1", payee: "GB", department: "mkt" }));
  store.insertPayout(makePayout({ txHash: "c", batchId: "2", payee: "GA", department: "eng" }));

  const byBatch = store.listPayouts({ batchId: "1", limit: 10 });
  assert.equal(byBatch.payouts.length, 2);

  const byPayee = store.listPayouts({ payee: "GA", limit: 10 });
  assert.equal(byPayee.payouts.length, 2);

  const byDept = store.listPayouts({ department: "eng", limit: 10 });
  assert.equal(byDept.payouts.length, 2);

  const both = store.listPayouts({ batchId: "1", payee: "GA", department: "eng", limit: 10 });
  assert.equal(both.payouts.length, 1);
  store.close();
});

test("getPayouts returns all events for a tx hash ordered by log index", () => {
  const store = new Store(":memory:");
  store.insertPayout(makePayout({ logIndex: 1, ledger: 101 }));
  store.insertPayout(makePayout({ logIndex: 0, ledger: 100 }));

  const payouts = store.getPayouts("deadbeef");
  assert.equal(payouts.length, 2);
  assert.deepEqual(payouts.map((p) => p.logIndex), [0, 1]);
  assert.equal(store.getPayouts("nope").length, 0);
  store.close();
});

test("health reports backlog from the latest on-chain ledger", () => {
  const store = new Store(":memory:");
  store.insertPayout(makePayout({ ledger: 100 }));
  store.insertPayout(makePayout({ txHash: "b", ledger: 105 }));

  const h = store.health(120);
  assert.equal(h.payoutCount, 2);
  assert.equal(h.lastLedger, 105);
  assert.equal(h.backlog, 15);
  assert.equal(typeof h.sizeBytes, "number");

  // Without a known on-chain ledger, backlog defaults to 0.
  assert.equal(store.health().backlog, 0);
  store.close();
});

test("checkpoints are upserted per contract", () => {
  const store = new Store(":memory:");
  assert.equal(store.getCheckpoint("C1"), null);
  store.setCheckpoint("C1", 100);
  store.setCheckpoint("C1", 150);
  assert.equal(store.getCheckpoint("C1"), 150);
  store.close();
});

test("listPayouts paginates with nextCursor and stops at the end", () => {
  const store = new Store(":memory:");
  for (let i = 0; i < 5; i++) {
    store.insertPayout(makePayout({ txHash: `tx${i}`, ledger: 100 + i }));
  }

  const filters: PayoutFilters = { limit: 2 };
  const page1 = store.listPayouts(filters);
  assert.equal(page1.payouts.length, 2);
  assert.ok(page1.nextCursor);

  const page2 = store.listPayouts({ ...filters, cursor: page1.nextCursor ?? undefined });
  assert.equal(page2.payouts.length, 2);
  assert.ok(page2.nextCursor);

  const page3 = store.listPayouts({ ...filters, cursor: page2.nextCursor ?? undefined });
  assert.equal(page3.payouts.length, 1);
  assert.equal(page3.nextCursor, null);
  store.close();
});
