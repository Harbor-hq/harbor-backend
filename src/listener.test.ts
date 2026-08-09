import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePayoutEvent, startListener } from "./listener.js";
import { Store } from "./db.js";
import type { PayoutEventRaw } from "./types.js";

const config = {
  rpcUrl: "https://soroban-testnet.stellar.org",
  contractId: "CD4U2T3X5K7G2J6L4A8B9Z1Y0W_MOCK_CONTRACT_ID",
  tokenSymbol: "USDC",
  tokenDecimals: 6,
  host: "0.0.0.0",
  port: 8787,
  pollIntervalMs: 5000,
  startLedgerBack: 10,
  dbPath: ":memory:",
  corsAllowedOrigins: ["http://localhost:3000"],
};

test("parses a payout event", () => {
  const event: PayoutEventRaw = {
    txHash: "deadbeef",
    logIndex: 3,
    ledger: 123456,
    topic: ["payout", "7", "GA5G2RG6KJBDXHLR4DCKOER7P4GR7356O2HKFEJTSVUIVYJZUYX5LPMH"],
    data: [250500000n, "eng"],
  };
  const record = parsePayoutEvent(event, config);
  assert.ok(record);
  assert.equal(record.txHash, "deadbeef");
  assert.equal(record.logIndex, 3);
  assert.equal(record.batchId, "7");
  assert.equal(record.payee, "GA5G2RG6KJBDXHLR4DCKOER7P4GR7356O2HKFEJTSVUIVYJZUYX5LPMH");
  assert.equal(record.amountBase, "250500000");
  assert.equal(record.amountDisplay, "250.5");
  assert.equal(record.department, "eng");
});

test("ignores non-payout events", () => {
  const event: PayoutEventRaw = {
    txHash: "x",
    logIndex: 0,
    ledger: 1,
    topic: ["executed", "7"],
    data: [],
  };
  assert.equal(parsePayoutEvent(event, config), null);
});

test("parsePayoutEvent handles missing or invalid fields gracefully", () => {
  const noBatch: PayoutEventRaw = {
    txHash: "a",
    logIndex: 0,
    ledger: 1,
    topic: ["payout", "", "GA5G..."],
    data: [100n, "eng"],
  };
  assert.equal(parsePayoutEvent(noBatch, config), null);

  const noPayee: PayoutEventRaw = {
    txHash: "a",
    logIndex: 0,
    ledger: 1,
    topic: ["payout", "1", ""],
    data: [100n, "eng"],
  };
  assert.equal(parsePayoutEvent(noPayee, config), null);

  const noAmount: PayoutEventRaw = {
    txHash: "a",
    logIndex: 0,
    ledger: 1,
    topic: ["payout", "1", "GA5G..."],
    data: [],
  };
  assert.equal(parsePayoutEvent(noAmount, config), null);

  const noDept: PayoutEventRaw = {
    txHash: "a",
    logIndex: 0,
    ledger: 1,
    topic: ["payout", "1", "GA5G..."],
    data: [5000000n],
  };
  const record = parsePayoutEvent(noDept, config);
  assert.ok(record);
  assert.equal(record.department, "");
  assert.equal(record.amountDisplay, "5");
});

test("startListener polls and handles injectable mock RPC server response", async () => {
  const store = new Store(":memory:");
  const state = { running: false, lastPoll: null, lastError: null, processed: 0 };
  const mockServer = {
    getLatestLedger: async () => ({ sequence: 10 }),
  };

  const stop = startListener(config, store, state, mockServer);
  assert.equal(state.running, true);
  await stop();
  assert.equal(state.running, false);
  store.close();
});

test("listener backoff and error tracking on poll failure", async () => {
  const store = new Store(":memory:");
  const state = { running: false, lastPoll: null, lastError: null, processed: 0 };
  const failingServer = {
    getLatestLedger: async () => {
      throw new Error("RPC timeout error");
    },
  };

  const stop = startListener(config, store, state, failingServer);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(state.lastError, "RPC timeout error");
  await stop();
  assert.equal(state.running, false);
  store.close();
});
