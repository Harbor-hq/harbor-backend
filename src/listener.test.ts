import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePayoutEvent } from "./listener.js";
import type { PayoutEventRaw } from "./types.js";

const config = {
  rpcUrl: "https://soroban-testnet.stellar.org",
  contractId: "C...",
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
  // Missing batchId
  const noBatch: PayoutEventRaw = {
    txHash: "a",
    logIndex: 0,
    ledger: 1,
    topic: ["payout", "", "GA5G..."],
    data: [100n, "eng"],
  };
  assert.equal(parsePayoutEvent(noBatch, config), null);

  // Missing payee
  const noPayee: PayoutEventRaw = {
    txHash: "a",
    logIndex: 0,
    ledger: 1,
    topic: ["payout", "1", ""],
    data: [100n, "eng"],
  };
  assert.equal(parsePayoutEvent(noPayee, config), null);

  // Missing amount in data
  const noAmount: PayoutEventRaw = {
    txHash: "a",
    logIndex: 0,
    ledger: 1,
    topic: ["payout", "1", "GA5G..."],
    data: [],
  };
  assert.equal(parsePayoutEvent(noAmount, config), null);

  // Missing department defaults to empty string
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
