import { getConfig } from "./config.js";
import { Store } from "./db.js";
import { createApp } from "./api.js";
import { startListener, type ListenerState } from "./listener.js";

const config = getConfig();
const store = new Store(config.dbPath);

if (store.isMockContract(config.contractId)) {
  console.warn(
    "[harbor] WARNING: CONTRACT_ID is the mock placeholder. No real events will be indexed. " +
      "Set CONTRACT_ID to your deployed hedegpay_batch contract."
  );
}

const listener: ListenerState = {
  running: false,
  lastPoll: null,
  lastError: null,
  processed: 0,
};

const stopListener = startListener(config, store, listener);

const app = createApp(config, store, listener);
const server = app.listen(config.port, config.host, () => {
  console.log(`[harbor] API listening on http://${config.host}:${config.port}`);
  console.log(`[harbor] listening to contract ${config.contractId}`);
  console.log(`[harbor] RPC ${config.rpcUrl}`);
});

// Prevent hung sockets from accumulating when a request or upstream RPC stalls.
server.requestTimeout = 30_000;
server.headersTimeout = 31_000;
server.keepAliveTimeout = 5_000;

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[harbor] ${signal} received, shutting down…`);
  await stopListener();
  server.close(() => {
    store.close();
    process.exit(0);
  });
  // Force-exit if close hangs (e.g. open keep-alive sockets).
  setTimeout(() => process.exit(0), 5_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
