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
