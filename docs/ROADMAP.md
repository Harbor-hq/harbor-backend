# Roadmap & contribution opportunities

The backend works end-to-end out of the box (disabled by the mock contract id by
default). This list captures well-scoped improvements anyone can land as a PR.
Reference the related issues at
[https://github.com/Harbor-hq/harbor/issues](https://github.com/Harbor-hq/harbor/issues)
where relevant.

## Ready to pick up

1. **Index `executed` batch events** — the contract also emits an `executed`
   event (batch id, declared total, item count). Parse and store batch-level
   summaries in a `batches` table and expose `GET /batches`.
   - Files: `src/stellar.ts`, `src/listener.ts`, `src/db.ts`, `src/api.ts`.

2. **Real SEP-24/31 anchor integration** — replace the corridor-mock (upstream
   `listener/index.js`) with real anchor flows (SEP-10, deposit/withdrawal,
   KYC/KYT) behind a `SIMULATE_ANCHOR` flag. See Harbor issue on the listener.

3. **Add auth/API key protection** — add optional bearer-token auth so the
   public API isn't writable/unlimited in production.

4. **Input validation & Zod schemas** — validate query params and add a runtime
   schema layer (Zod) with 400 responses instead of relying on coercion.

5. **Dockerize** — add a `Dockerfile` + `docker-compose.yml` (service + optional
   caddy/nginx) for one-command deployment.

6. **Metrics** — expose Prometheus metrics (`/metrics`: indexed events, poll
   duration, backlog, db size) for alerting.

## Larger efforts

7. **Multi-contract support** — index several contracts with per-contract
   checkpoints (the current schema is contract-agnostic; add contract_id columns
   and a v2 migration).

8. **ERP sync** — emit indexed payouts to QuickBooks/Xero (double-entry ledger
   mapping), per the ISSUES_BACKLOG item FR-17. A webhook/outbox table is the
   natural seam.

9. **Read replica / history API** — historical ledger endpoints
   (`GET /payouts?from=<iso>&to=<iso>`) and CSV/JSON export.

10. **Tests & CI** — cover `db.ts` and `api.ts` with `node:test` + a
    `supertest`-style harness, and add a GitHub Actions workflow running
    `typecheck`, `test`, and `build`.

## Conventions

- All network/contract access stays in `src/stellar.ts`.
- New endpoints live in `src/api.ts`; store access goes through `Store` in
  `src/db.ts`.
- Amounts are stored/compared in base units (`TEXT` in SQLite to avoid BigInt
  precision loss); format for the API with `fromBaseUnits`.
- Verify with `npm run typecheck`, `npm test`, and `npm run build`.