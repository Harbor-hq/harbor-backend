import { rpc, scValToNative } from "@stellar/stellar-sdk";
import type { Config } from "./config.js";
import type { PayoutEventRaw } from "./types.js";

export function getServer(config: Config): rpc.Server {
  return new rpc.Server(config.rpcUrl);
}

/**
 * Fetch all contract events starting at `startLedger` up to `endLedger`,
 * draining pagination (via each page's `pagingToken`) so no page is dropped.
 */
export async function fetchContractEvents(
  config: Config,
  startLedger: number,
  endLedger: number
): Promise<PayoutEventRaw[]> {
  const server = getServer(config);
  const events: PayoutEventRaw[] = [];
  let cursor: string | undefined;

  while (true) {
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
    cursor = last.pagingToken;
  }

  return events;
}

/**
 * Decode a raw Soroban event into a typed shape. `topic` is decoded to native
 * strings; the event value is kept raw so the listener can interpret it.
 */
function parseEvent(event: rpc.Api.EventResponse): PayoutEventRaw | null {
  const { logIndex } = splitEventId(event.id);
  return {
    txHash: event.txHash,
    logIndex,
    ledger: event.ledger,
    topic: event.topic.map((t) => String(scValToNative(t))),
    data: scValToNative(event.value),
  };
}

/** The event id is `txhash:logindex`; fall back gracefully if the format changes. */
function splitEventId(id: string): { logIndex: number } {
  const idx = id.lastIndexOf(":");
  if (idx === -1) return { logIndex: 0 };
  return { logIndex: Number(id.slice(idx + 1)) || 0 };
}
