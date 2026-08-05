import { rpc, scValToNative } from "@stellar/stellar-sdk";
import type { Config } from "./config.js";
import type { PayoutEventRaw } from "./types.js";

export function getServer(config: Config): rpc.Server {
  return new rpc.Server(config.rpcUrl);
}

/**
 * Fetch all contract events starting at `startLedger` up to `endLedger`,
 * draining pagination (via each page's `pagingToken`) so no page is dropped.
 * Guards against an unbounded loop: if the RPC keeps returning non-empty
 * pages without advancing the paging token, we stop after `MAX_PAGES`.
 */
const MAX_PAGES = 1000;

export async function fetchContractEvents(
  config: Config,
  startLedger: number,
  endLedger: number
): Promise<PayoutEventRaw[]> {
  const server = getServer(config);
  const events: PayoutEventRaw[] = [];
  let cursor: string | undefined;
  let pages = 0;

  while (true) {
    if (pages++ >= MAX_PAGES) {
      console.warn(
        `[stellar] fetchContractEvents hit ${MAX_PAGES}-page cap; giving up (startLedger=${startLedger}, endLedger=${endLedger})`
      );
      break;
    }

    const res = await server.getEvents({
      startLedger,
      cursor,
      filters: [
        {
          type: "contract",
          contractIds: [config.contractId],
        },
      ],
      limit: 100,
    });

    for (const event of res.events) {
      if (event.ledger > endLedger) continue;
      const parsed = parseEvent(event);
      if (parsed) events.push(parsed);
    }

    if (res.events.length === 0) break;
    const last = res.events[res.events.length - 1];
    if (!last.pagingToken) break;

    // Safety: if the next cursor is identical to the previous one, we are not
    // making progress — stop rather than loop forever.
    if (last.pagingToken === cursor) break;
    cursor = last.pagingToken;
  }

  return events;
}

/**
 * Decode a raw Soroban event into a typed shape. `topic` is decoded to native
 * strings; the event value is kept raw so the listener can interpret it.
 */
function parseEvent(event: rpc.Api.EventResponse): PayoutEventRaw | null {
  const { logIndex } = splitEventId(event.id) ?? { logIndex: 0 };
  return {
    txHash: event.txHash,
    logIndex,
    ledger: event.ledger,
    topic: event.topic.map((t) => String(scValToNative(t))),
    data: scValToNative(event.value),
  };
}

/**
 * The event id is `txhash:logindex`; fall back gracefully if the format
 * changes. Returns `null` when the id does not contain a `:` separator so
 * callers can skip the event instead of silently assuming logIndex 0 (which
 * would break idempotency on (tx_hash, log_index)).
 */
function splitEventId(id: string): { logIndex: number } | null {
  const idx = id.lastIndexOf(":");
  if (idx === -1) {
    console.warn(`[stellar] unexpected event id format (no ":" separator): ${id}`);
    return null;
  }
  const parsed = Number(id.slice(idx + 1));
  if (!Number.isFinite(parsed) || parsed < 0) {
    console.warn(`[stellar] unparsable log index in event id: ${id}`);
    return null;
  }
  return { logIndex: parsed };
}
