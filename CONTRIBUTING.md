# Contributing to Harbor Backend

Thanks for helping build Harbor's backend! Every improvement should be small,
reviewable, and reference a tracking issue.

## Development

```bash
npm install
npm run dev              # hot-reload server on :8787
npm run typecheck
npm test
npm run build
```

## Ground rules

- Keep all Soroban/RPC access inside `src/stellar.ts`.
- Store access goes through the `Store` class in `src/db.ts` — endpoints never
  issue raw SQL.
- New REST endpoints live in `src/api.ts` and must be documented in
  `docs/API.md`.
- Amounts are handled in **base units**; format for output with `fromBaseUnits`
  (`src/amount.ts`).
- SQLite columns that hold i128 amounts are `TEXT` (avoid BigInt precision loss).
- No new runtime dependencies without discussing in the PR — the service is
  intentionally dependency-light (`node:sqlite`, no ORM).

## Submitting a PR

1. Fork and branch: `git checkout -b feat/my-thing`.
2. Make a focused change + tests.
3. `npm run typecheck && npm test && npm run build`.
4. Open the PR with `Fixes #N` referencing the tracking issue in
   `Harbor-hq/harbor` or this repo.

## Reviewer checklist

- [ ] No RPC/SDK calls outside `src/stellar.ts`
- [ ] Endpoints route through `Store` and are added to `docs/API.md`
- [ ] Amounts converted with amount helpers, not raw math
- [ ] Config flows through `getConfig()` (env → default)
- [ ] Typecheck, tests, and build pass