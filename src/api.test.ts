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
    // Intercept console.log to verify it logs clamping
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
