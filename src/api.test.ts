import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "./api.js";
import { Store } from "./db.js";
import { getConfig } from "./config.js";

test("API clamps limit parameter and logs it", async () => {
  const config = getConfig({});
  const store = new Store(":memory:");
  const app = createApp(config, store, {
    running: false,
    lastPoll: null,
    lastError: null,
    processed: 0,
  });

  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    store.close();
    throw new Error("Failed to bind server to random port");
  }
  const port = address.port;

  try {
    const originalLog = console.log;
    let loggedMessage = "";
    console.log = (msg: string) => {
      loggedMessage = msg;
    };

    const res = await fetch(`http://localhost:${port}/payouts?limit=300`);
    assert.equal(res.status, 200);

    console.log = originalLog;
    assert.match(loggedMessage, /Clamped requested limit 300 to 200/);
  } finally {
    server.close();
    store.close();
  }
});

test("API GET /health and GET /payouts integration", async () => {
  const config = getConfig({});
  const store = new Store(":memory:");
  store.insertPayout({
    txHash: "tx123",
    logIndex: 0,
    batchId: "1",
    payee: "GA5G2RG6KJBDXHLR4DCKOER7P4GR7356O2HKFEJTSVUIVYJZUYX5LPMH",
    amountBase: "1000000",
    amountDisplay: "1",
    department: "eng",
    ledger: 100,
    createdAt: "2026-01-01T00:00:00.000Z",
  });

  const app = createApp(config, store, {
    running: true,
    lastPoll: Date.now(),
    lastError: null,
    processed: 1,
  });

  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    store.close();
    throw new Error("Failed to bind server");
  }
  const port = address.port;

  try {
    // GET /health
    const healthRes = await fetch(`http://localhost:${port}/health`);
    assert.equal(healthRes.status, 200);
    const healthJson = (await healthRes.json()) as any;
    assert.equal(healthJson.status, "ok");
    assert.equal(healthJson.listener.running, true);
    assert.equal(healthJson.index.payoutCount, 1);

    // GET /payouts/:txHash
    const txRes = await fetch(`http://localhost:${port}/payouts/tx123`);
    assert.equal(txRes.status, 200);
    const txJson = (await txRes.json()) as any;
    assert.equal(txJson.payouts.length, 1);

    // GET /payouts/notfound -> 404
    const notFoundRes = await fetch(`http://localhost:${port}/payouts/missing`);
    assert.equal(notFoundRes.status, 404);
  } finally {
    server.close();
    store.close();
  }
});
