# Harbor Backend — API Reference

Base URL: `http://localhost:8787` (configurable via `HOST`/`PORT`).

All endpoints return JSON. CORS is enabled for browser clients.

---

## `GET /health`

Listener and indexer status.

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

---

## `GET /payouts`

List indexed payouts, newest first.

**Query params**

| Param    | Type   | Default | Description                          |
| -------- | ------ | ------- | ------------------------------------ |
| `limit`  | number | `50`     | Page size (max `200`)                |
| `cursor` | number | —        | Cursor from a previous `nextCursor`  |
| `batchId`| string | —        | Filter by batch id                   |
| `payee`  | string | —        | Filter by exact payee address        |

**Response**

```json
{
  "payouts": [
    {
      "txHash": "deadbeef...",
      "index": 0,
      "batchId": "7",
      "payee": "GA5G2...",
      "amount": "250.5",
      "token": "USDC",
      "date": "2026-05-10T12:00:00.000Z",
      "ledger": 123456
    }
  ],
  "nextCursor": 42
}
```

`nextCursor` is `null` when there are no more pages.

---

## `GET /payouts/:txHash`

Fetch the first payout event for a transaction hash.

- `200` — the payout (same shape as an item above)
- `404` — `{ "error": "not_found", "message": "Payout not found" }`

---

## Errors

Errors use the shape:

```json
{ "error": "<code>", "message": "<human message>" }
```