# Harbor Backend

Backend service for [Harbor](https://github.com/Harbor-hq/harbor) — the Soroban
batch payroll protocol. This service:

1. **Listens** for `payout` events emitted by the `hedgepay_batch` contract on
   Soroban (resuming from checkpoints so nothing is lost across restarts).
2. **Indexes** them into a local SQLite database (idempotent on
   `(tx_hash, log_index)`).
3. **Serves** them over a small REST API consumed by
   [harbor-frontend](https://github.com/Harbor-hq/harbor-frontend).

Built with Node + TypeScript, `@stellar/stellar-sdk`, Express, and Node's
built-in `node:sqlite` (no ORM/database dependency).

## Requirements

- Node.js **>= 22.5** (for `node:sqlite`)

## Getting started

```bash
npm install
cp .env.example .env   # then fill in CONTRACT_ID
npm run dev            # tsx watch, listens on :8787
```

By default the service runs on the public Soroban testnet with a **mock**
contract id so it boots without setup — set `CONTRACT_ID` to your deployed
`hedgepay_batch` contract to index real events.

### Scripts

| Script        | What it does                    |
| ------------- | ------------------------------- |
| `npm run dev` | Run with hot reload (`tsx watch`) |
| `npm run build` | Compile TS to `dist/`         |
| `npm start`   | Run compiled `dist/`            |
| `npm run typecheck` | `tsc --noEmit`           |
| `npm test`    | Run the unit tests (`node:test`) |

## API

See [docs/API.md](docs/API.md) for the full reference.

| Endpoint           | Description                              |
| ------------------ | ---------------------------------------- |
| `GET /health`      | Listener + indexer status                |
| `GET /payouts`     | List indexed payouts (paginated, filterable) |
| `GET /payouts/:txHash` | Single payout by transaction hash    |

The `/payouts` shape matches what `harbor-frontend`'s `fetchPayoutEvents`
consumes, so a frontend can point `NEXT_PUBLIC_HARBOR_EVENTS_URL` at this
service.

## Configuration

All via env vars (see `.env.example`):

| Variable           | Default                          | Purpose                        |
| ------------------ | -------------------------------- | ------------------------------ |
| `RPC_URL`          | soroban-testnet                  | Soroban RPC endpoint           |
| `CONTRACT_ID`      | mock placeholder                 | `hedgepay_batch` contract address |
| `TOKEN_SYMBOL`     | `USDC`                           | Token label surfaced in the API |
| `TOKEN_DECIMALS`   | `6`                              | Decimal places used to format amounts |
| `HOST` / `PORT`    | `0.0.0.0` / `8787`               | HTTP server bind               |
| `POLL_INTERVAL_MS` | `5000`                           | Event listener poll interval   |
| `START_LEDGER_BACK`| `10`                             | Ledgers back to index on first run |
| `DB_PATH`          | `./data/harbor.db`               | SQLite database file           |

## Project layout

```
src/
  config.ts      Env configuration
  db.ts          SQLite schema + queries (payouts, checkpoints)
  stellar.ts     Soroban RPC helpers + paginated event fetch
  listener.ts    Checkpointed event-polling loop
  amount.ts      i128 <-> decimal amount helpers
  api.ts         Express HTTP API
  server.ts      Entry point (listener + API)
docs/
  API.md         REST endpoint reference
  ROADMAP.md     Contribution opportunities
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). For what to build next, see
[docs/ROADMAP.md](docs/ROADMAP.md).