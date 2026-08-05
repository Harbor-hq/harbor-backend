# Roadmap & contribution opportunities

The backend works end-to-end out of the box (disabled by the mock contract id by
default). This list captures well-scoped improvements anyone can land as a PR.
Reference the related issues at
[https://github.com/Harbor-hq/harbor/issues](https://github.com/Harbor-hq/harbor/issues)
where relevant.

## Ready to pick up

1. **Index `executed` batch events** ([#53](https://github.com/Harbor-hq/harbor-backend/issues/53)) — the contract also emits an `executed`
   event (batch id, declared total, item count). Parse and store batch-level
   summaries in a `batches` table and expose `GET /batches`.
   - Files: `src/stellar.ts`, `src/listener.ts`, `src/db.ts`, `src/api.ts`.

2. **Real SEP-24/31 anchor integration** ([#54](https://github.com/Harbor-hq/harbor-backend/issues/54)) — replace the corridor-mock (upstream
   `listener/index.js`) with real anchor flows (SEP-10, deposit/withdrawal,
   KYC/KYT) behind a `SIMULATE_ANCHOR` flag. See Harbor issue on the listener.

3. **Add auth/API key protection** ([#55](https://github.com/Harbor-hq/harbor-backend/issues/55)) — add optional bearer-token auth so the
   public API isn't writable/unlimited in production.

4. **Input validation & Zod schemas** ([#56](https://github.com/Harbor-hq/harbor-backend/issues/56)) — validate query params and add a runtime
   schema layer (Zod) with 400 responses instead of relying on coercion.

5. **Dockerize** ([#57](https://github.com/Harbor-hq/harbor-backend/issues/57)) — add a `Dockerfile` + `docker-compose.yml` (service + optional
   caddy/nginx) for one-command deployment.

6. **Metrics** ([#58](https://github.com/Harbor-hq/harbor-backend/issues/58)) — expose Prometheus metrics (`/metrics`: indexed events, poll
   duration, backlog, db size) for alerting.

## Larger efforts

7. **Multi-contract support** ([#59](https://github.com/Harbor-hq/harbor-backend/issues/59)) — index several contracts with per-contract
   checkpoints (the current schema is contract-agnostic; add contract_id columns
   and a v2 migration).

8. **ERP sync** ([#60](https://github.com/Harbor-hq/harbor-backend/issues/60)) — emit indexed payouts to QuickBooks/Xero (double-entry ledger
   mapping), per the ISSUES_BACKLOG item FR-17. A webhook/outbox table is the
   natural seam.

9. **Read replica / history API** ([#61](https://github.com/Harbor-hq/harbor-backend/issues/61)) — historical ledger endpoints
   (`GET /payouts?from=<iso>&to=<iso>`) and CSV/JSON export.

10. **Tests & CI** ([#62](https://github.com/Harbor-hq/harbor-backend/issues/62)) — cover `db.ts` and `api.ts` with `node:test` + a
    `supertest`-style harness, and add a GitHub Actions workflow running
    `typecheck`, `test`, and `build`.

## Conventions

- All network/contract access stays in `src/stellar.ts`.
- New endpoints live in `src/api.ts`; store access goes through `Store` in
  `src/db.ts`.
- Amounts are stored/compared in base units (`TEXT` in SQLite to avoid BigInt
  precision loss); format for the API with `fromBaseUnits`.
- Verify with `npm run typecheck`, `npm test`, and `npm run build`.