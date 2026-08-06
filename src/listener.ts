import type { Config } from "./config.js";
import type { Store } from "./db.js";
import { fetchContractEvents, getServer } from "./stellar.js";
import { fromBaseUnits } from "./amount.js";
import type { PayoutEventRaw, PayoutRecord } from "./types.js";
import { logger } from "./logger.js";

export interface ListenerState {
  running: boolean;
  lastPoll: number | null;
  lastError: string | null;
  processed: number;
}

/**
 * Off-chain event listener. Polls the Soroban network for `payout` events on
 * the configured contract and indexes them into the store, resuming from the
 * last checkpointed ledger so no events are lost across restarts.
 */
export function startListener(
  config: Config,
  store: Store,
  state: ListenerState
): () => void {
  const server = getServer(config);
  let inFlight: Promise<void> = Promise.resolve();
  let consecutiveFailures = 0;
  const MAX_BACKOFF_MS = 300_000;
  let stopped = false;

  function nextDelayMs(): number {
    if (consecutiveFailures === 0) return config.pollIntervalMs;
    const backoff = Math.min(
      MAX_BACKOFF_MS,
      config.pollIntervalMs * 2 ** consecutiveFailures
    );
    return Math.max(config.pollIntervalMs, backoff);
  }

  async function poll(): Promise<void> {
    try {
      state.lastPoll = Date.now();

      const latestLedger = await server.getLatestLedger();
      const currentLedger = latestLedger.sequence;

      const checkpoint = store.getCheckpoint(config.contractId);
      const startLedger =
        checkpoint !== null
          ? checkpoint + 1
          : Math.max(1, currentLedger - config.startLedgerBack);

      if (startLedger > currentLedger) return;

      const events = await fetchContractEvents(
        config,
        startLedger,
        currentLedger
      );

      let inserted = 0;
      for (const event of events) {
        const payout = parsePayoutEvent(event, config);
        if (!payout) continue;
        if (store.insertPayout(payout)) inserted += 1;
      }

      store.setCheckpoint(config.contractId, currentLedger);
      state.processed += events.length;
      state.lastError = null;
      consecutiveFailures = 0;

      if (events.length > 0) {
        logger.info("indexed payouts", {
          inserted,
          total: events.length,
          startLedger,
          currentLedger,
        });
      }
    } catch (err) {
      state.lastError = describeError(err);
      consecutiveFailures += 1;
      logger.error("poll failed", state.lastError, {
        attempt: consecutiveFailures,
      });
    }
  }

  function scheduleNext(): void {
    if (stopped) return;
    const delay = nextDelayMs();
    setTimeout(() => {
      inFlight = poll().finally(() => scheduleNext());
    }, delay);
  }

  state.running = true;
  inFlight = poll().finally(() => scheduleNext());

  return () => {
    stopped = true;
    state.running = false;
    // Wait for any in-flight poll so shutdown() can exit cleanly.
    return inFlight;
  };
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/**
 * Interpret a decoded event as a `payout` event.
 * Expected shape from `hedgepay_batch`:
 *   topic: [Symbol("payout"), u64 batch_id, Address payee]
 *   data:  [i128 amount, Symbol department]
 */
export function parsePayoutEvent(
  event: PayoutEventRaw,
  config: Config
): PayoutRecord | null {
  if (event.topic[0] !== "payout") return null;

  const batchId = event.topic[1] ?? "";
  const payee = event.topic[2] ?? "";

  const data = Array.isArray(event.data) ? event.data : [];
  const amount = data[0];
  const department = data[1] ? String(data[1]) : "";

  if (!batchId || !payee || amount === undefined) return null;

  const amountBase = BigInt(amount).toString();

  return {
    txHash: event.txHash,
    logIndex: event.logIndex,
    batchId,
    payee,
    amountBase,
    amountDisplay: fromBaseUnits(amount, config.tokenDecimals),
    department,
    ledger: event.ledger,
    createdAt: new Date().toISOString(),
  };
}
