<div align="center">

# Harbor Backend

**Soroban event listener, payout indexer, and REST API for Harbor.**

Watches the `hedgepay_batch` contract for payout events, indexes them<br/>
into SQLite, and serves them to [harbor-frontend](https://github.com/Harbor-hq/harbor-frontend).

![Node >= 22.5](https://img.shields.io/badge/node-%3E%3D22.5-339933)
![TypeScript](https://img.shields.io/badge/typescript-%5E5.7-3178c6)
![Express](https://img.shields.io/badge/express-%5E4.21-black)
![Stellar SDK 12](https://img.shields.io/badge/stellar--sdk-%5E12.3-6f42c1)
![node:sqlite](https://img.shields.io/badge/db-node%3Asqlite-orange)

Part of the [Harbor](https://github.com/Harbor-hq/harbor) ecosystem.

</div>

---

## Overview

`harbor-backend` is the off-chain half of Harbor's batch payroll system. Where [`harbor-frontend`](https://github.com/Harbor-hq/harbor-frontend) submits `execute_batch_payroll` transactions, this service watches the `hedgepay_batch` Soroban contract for the resulting `payout` events and turns them into a queryable history. It does three things:

1. **Listens** for `payout` events emitted by the `hedgepay_batch` contract on Soroban, resuming from a checkpointed ledger so nothing is lost across restarts.
2. **Indexes** them into a local SQLite database, idempotent on `(tx_hash, log_index)` so re-processing the same ledger range never creates duplicates.
3. **Serves** them over a small REST API — the same shape `harbor-frontend`'s `fetchPayoutEvents` expects, so pointing `NEXT_PUBLIC_HARBOR_EVENTS_URL` at this service is all the wiring needed.

Built with Node + TypeScript, `@stellar/stellar-sdk`, Express, and Node's built-in `node:sqlite` — deliberately no ORM and no external database dependency.

---

## Table of Contents

- [Requirements](#requirements)
- [Getting Started](#getting-started)
- [Scripts](#scripts)
- [Configuration](#configuration)
- [Project Layout](#project-layout)
- [Architecture](#architecture)
- [The Listener (`src/listener.ts`)](#the-listener-srclistenerts)
- [The Store (`src/db.ts`)](#the-store-srcdbts)
- [The API (`src/api.ts`)](#the-api-srcapits)
- [Amount Handling](#amount-handling)
- [Health & Operations](#health--operations)
- [Testing](#testing)
- [Contributing](#contributing)
- [Roadmap](#roadmap)
- [License](#license)

---

## Requirements

- **Node.js >= 22.5** — required for the built-in `node:sqlite` module used as the only storage dependency.

---

## Getting Started

```bash
git clone https://github.com/Harbor-hq/harbor-backend.git
cd harbor-backend
npm install
cp .env.example .env   # then fill in CONTRACT_ID
npm run dev            # tsx watch, listens on :8787
```

By default the service runs against the public Soroban testnet with a **mock** contract id, so it boots and serves an empty, healthy API without any setup. Set `CONTRACT_ID` to your deployed `hedgepay_batch` contract to index real events — until you do, `server.ts` prints a startup warning that no real events will be indexed.

---

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Run with hot reload (`tsx watch src/server.ts`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled `dist/server.js` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Run the unit tests (`node:test`, via `tsx --test`) |

---

## Configuration

All configuration is via environment variables (see `.env.example`), read once at startup by `getConfig()` in `src/config.ts`. There is no runtime-override layer here (unlike `harbor-frontend`'s Settings page) — this is a server process, so config is fixed for the life of the process.

| Variable | Default | Purpose |
| --- | --- | --- |
| `RPC_URL` | `https://soroban-testnet.stellar.org` | Soroban RPC endpoint |
| `CONTRACT_ID` | mock placeholder | `hedgepay_batch` contract address |
| `TOKEN_SYMBOL` | `USDC` | Token label surfaced in the API |
| `TOKEN_DECIMALS` | `6` | Decimal places used to format amounts |
| `HOST` / `PORT` | `0.0.0.0` / `8787` | HTTP server bind |
| `POLL_INTERVAL_MS` | `5000` | Event listener poll interval |
| `START_LEDGER_BACK` | `10` | Ledgers back to index on first run (when there's no checkpoint yet) |
| `DB_PATH` | `./data/harbor.db` | SQLite database file (`:memory:` is supported, mainly for tests) |

---

## Project Layout

```
harbor-backend/
├── docs/
│   ├── API.md          # REST endpoint reference
│   └── ROADMAP.md       # contribution opportunities
├── src/
│   ├── config.ts        # env → Config
│   ├── types.ts          # PayoutRecord / PayoutApiItem / PayoutEventRaw
│   ├── amount.ts          # i128 <-> decimal helpers
│   ├── amount.test.ts
│   ├── stellar.ts         # Soroban RPC helpers + paginated event fetch
│   ├── listener.ts        # checkpointed event-polling loop
│   ├── listener.test.ts
│   ├── db.ts               # SQLite schema + Store (payouts, checkpoints)
│   ├── api.ts               # Express HTTP API
│   └── server.ts            # entry point (wires listener + API + shutdown)
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Architecture

```
┌──────────────┐   getEvents    ┌─────────────┐   insertPayout   ┌───────┐
│ Soroban RPC   │ ─────────────▶ │ listener.ts  │ ───────────────▶ │ Store  │
│ (contract     │                │ (poll loop,  │                  │ (SQLite│
│  events)      │                │  checkpoint) │                  │  db.ts)│
└──────────────┘                └─────────────┘                  └───┬───┘
                                                                       │
                                                                  listPayouts /
                                                                  getPayout
                                                                       │
                                                                       ▼
                                                               ┌──────────────┐
                                                               │  api.ts       │
                                                               │ (Express)     │
                                                               └──────┬───────┘
                                                                      │ GET /payouts
                                                                      ▼
                                                             harbor-frontend
```

`server.ts` is the composition root: it builds `Config`, opens the `Store`, starts the listener against that store, and mounts the Express app on top of the same store and listener state — then wires `SIGINT`/`SIGTERM` to stop the listener and close the database cleanly.

**Conventions enforced across the codebase:**

- All Soroban RPC / SDK access lives in `src/stellar.ts` — the listener and API never call the SDK directly.
- All storage access goes through the `Store` class in `src/db.ts` — no raw SQL outside `db.ts`.
- Amounts are stored and compared in base units, converted at the edges with `src/amount.ts`.

---

## The Listener (`src/listener.ts`)

`startListener(config, store, state)` runs a `setInterval` poll loop (interval = `POLL_INTERVAL_MS`) and returns a stop function. Each poll:

1. Reads the network's `getLatestLedger()` to find the current ledger.
2. Reads the last checkpoint for `config.contractId` from the `Store`. If there isn't one yet, it starts `START_LEDGER_BACK` ledgers behind the current tip instead of indexing the entire chain history.
3. Calls `fetchContractEvents` (in `src/stellar.ts`) to pull all contract events in that ledger range, draining pagination via each page's `pagingToken` so no page is silently dropped.
4. Parses each raw event with `parsePayoutEvent`, expecting the shape emitted by `hedgepay_batch`:

   ```
   topic: [Symbol("payout"), u64 batch_id, Address payee]
   data:  [i128 amount, Symbol department]
   ```

   Events that don't match (wrong topic, missing fields) are skipped rather than crashing the loop.
5. Inserts each parsed payout via `store.insertPayout`, which is a no-op on duplicates (`INSERT OR IGNORE`, keyed on `(tx_hash, log_index)`).
6. Advances the checkpoint to the current ledger — **only after** processing succeeds, so a crash mid-poll re-processes the same range next time rather than skipping it.

`ListenerState` (`{ running, lastPoll, lastError, processed }`) is a shared mutable object the API reads from for `/health` — errors are caught and recorded in `lastError` rather than crashing the process, so a single bad poll doesn't take the service down.

---

## The Store (`src/db.ts`)

`Store` wraps a single `node:sqlite` `DatabaseSync` connection and owns the schema:

```sql
CREATE TABLE payouts (
  tx_hash        TEXT    NOT NULL,
  log_index      INTEGER NOT NULL,
  batch_id       TEXT    NOT NULL,
  payee          TEXT    NOT NULL,
  amount_base    TEXT    NOT NULL,   -- i128 as TEXT, never a numeric column
  amount_display TEXT    NOT NULL,
  department     TEXT    NOT NULL DEFAULT '',
  ledger         INTEGER NOT NULL,
  created_at     TEXT    NOT NULL,
  PRIMARY KEY (tx_hash, log_index)
);

CREATE TABLE checkpoints (
  contract_id TEXT PRIMARY KEY,
  last_ledger INTEGER NOT NULL
);
```

Indexes on `batch_id`, `payee`, and `ledger` back the `/payouts` filters. `amount_base` is stored as `TEXT` rather than a numeric SQLite type specifically to avoid BigInt precision loss — this is called out explicitly in `CONTRIBUTING.md` as a rule new code must follow.

Public methods: `getCheckpoint` / `setCheckpoint` (upsert), `insertPayout` (returns `true` if it wasn't a duplicate), `listPayouts` (cursor-paginated, filterable by `batchId`/`payee`), `getPayout` (by `tx_hash`), `health()` (last indexed ledger + payout count), and `isMockContract()` (used by `server.ts` to print the startup warning).

---

## The API (`src/api.ts`)

Express app created by `createApp(config, store, listener)`. CORS is enabled for all origins so a browser frontend can call it directly. Full reference in [docs/API.md](docs/API.md); summary:

| Endpoint | Description |
| --- | --- |
| `GET /health` | Listener + indexer status |
| `GET /payouts` | List indexed payouts, newest first — paginated, filterable |
| `GET /payouts/:txHash` | Single payout by transaction hash |

`GET /payouts` query params:

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| `limit` | number | `50` | Page size (capped at `200`) |
| `cursor` | number | — | Cursor from a previous response's `nextCursor` |
| `batchId` | string | — | Filter by batch id |
| `payee` | string | — | Filter by exact payee address |

`nextCursor` is `null` when there are no more pages. Every payout is shaped through `toApiItem()` into `PayoutApiItem`:

```ts
{
  txHash: string;
  index: number;     // log index within the tx
  batchId: string;
  payee: string;
  amount: string;     // human decimal, via amount_display
  token: string;       // config.tokenSymbol
  date: string;         // ISO timestamp
  ledger: number;
}
```

This is exactly the shape `harbor-frontend`'s `PayoutEvent` / `fetchPayoutEvents` expects — point `NEXT_PUBLIC_HARBOR_EVENTS_URL` at `http://<host>:<port>/payouts` and the Ledger page works with no frontend changes.

Errors use a consistent shape: `{ "error": "<code>", "message": "<human message>" }` — a 404 handler for unknown routes and a central error handler for uncaught exceptions both follow it.

---

## Amount Handling

Same convention as `harbor-frontend`: the contract's amounts are `i128` base units (e.g. 6-decimal USDC stores `1.00` as `1_000_000`). `src/amount.ts` mirrors the frontend's helpers exactly:

```ts
toBaseUnits("250.50", 6)     // -> 250500000n
fromBaseUnits(250500000n, 6) // -> "250.5"
```

The listener stores **both** `amount_base` (exact, `TEXT`, used for future math) and `amount_display` (pre-formatted for the API) per payout, so the API never has to reformat on read.

---

## Health & Operations

`GET /health` returns:

```json
{
  "status": "ok",
  "contractId": "C...",
  "rpcUrl": "https://soroban-testnet.stellar.org",
  "listener": {
    "running": true,
    "lastPoll": 1785850523766,
    "lastError": null,
    "processed": 12
  },
  "index": {
    "lastLedger": 123456,
    "payoutCount": 42
  }
}
```

Use `listener.lastError` and `listener.lastPoll` to alert if the poll loop has stalled or is repeatedly failing (e.g. RPC outage or a misconfigured `CONTRACT_ID`). `server.ts` handles `SIGINT`/`SIGTERM` by stopping the listener, closing the HTTP server, and closing the SQLite connection in that order — safe to run under a process manager or in a container without losing in-flight writes.

---

## Testing

```bash
npm test
```

Runs `src/amount.test.ts` and `src/listener.test.ts` via Node's built-in `node:test` runner (through `tsx --test`). There's no HTTP-level test harness yet for `api.ts` or `db.ts` — see [Roadmap](#roadmap).

---

## Contributing

See [CONTRIBUTING.md](https://github.com/Harbor-hq/harbor-backend/blob/main/CONTRIBUTING.md) for the full guide. Ground rules, enforced in review:

- Keep all Soroban/RPC access inside `src/stellar.ts`.
- Store access goes through the `Store` class in `src/db.ts` — endpoints never issue raw SQL.
- New REST endpoints live in `src/api.ts` and must be documented in `docs/API.md`.
- Amounts are handled in base units; format for output with `fromBaseUnits`.
- SQLite columns holding i128 amounts are `TEXT`, never a numeric type.
- No new runtime dependencies without discussing in the PR — the service is intentionally dependency-light.

**Submitting a PR:** fork, branch (`git checkout -b feat/my-thing`), make a focused change with tests, run `npm run typecheck && npm test && npm run build`, then open the PR with `Fixes #N`.

---

## Roadmap

Full list with acceptance criteria in [docs/ROADMAP.md](https://github.com/Harbor-hq/harbor-backend/blob/main/docs/ROADMAP.md). Ready-to-pick-up items, smallest first:

1. **Index `executed` batch events** — parse the contract's batch-level `executed` event into a new `batches` table and expose `GET /batches`.
2. **Real SEP-24/31 anchor integration** — replace the corridor-mock listener with real anchor flows behind a `SIMULATE_ANCHOR` flag.
3. **Auth / API key protection** — optional bearer-token auth so the public API isn't unlimited in production.
4. **Input validation & Zod schemas** — replace loose query-param coercion with a runtime schema layer and proper `400` responses.
5. **Dockerize** — `Dockerfile` + `docker-compose.yml` for one-command deployment.
6. **Metrics** — a `/metrics` endpoint (indexed events, poll duration, backlog, db size) for Prometheus-style alerting.

Larger efforts: multi-contract support (per-contract checkpoints), ERP sync (QuickBooks/Xero via a webhook/outbox table), a historical/date-range and CSV/JSON export API, and a proper CI test harness (`supertest`-style coverage of `db.ts`/`api.ts` plus a GitHub Actions workflow).

---

## License

See the repository for license details.
