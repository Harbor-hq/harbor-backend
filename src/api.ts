import express from "express";
import type { Config } from "./config.js";
import type { Store } from "./db.js";
import type { ListenerState } from "./listener.js";
import type { PayoutApiItem } from "./types.js";

export function createApp(
  config: Config,
  store: Store,
  listener: ListenerState
): express.Express {
  const app = express();
  app.use(express.json());

  // CORS so the browser frontend can call the API directly.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (config.corsAllowedOrigins.includes("*")) {
      res.setHeader("Access-Control-Allow-Origin", "*");
    } else if (origin && config.corsAllowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    if (process.env.API_KEY && req.path !== "/health") {
      const auth = req.headers.authorization;
      if (auth !== `Bearer ${process.env.API_KEY}`) {
        res.status(401).json({ error: "unauthorized", message: "Invalid or missing Bearer API key" });
        return;
      }
    }
    next();
  });

  app.get("/health", (_req, res) => {
    const checkpoint = store.getCheckpoint(config.contractId);
    const health = store.health(checkpoint ?? undefined);

    const isHealthy = !listener.lastError;
    const httpStatus = isHealthy ? 200 : 503;

    res.status(httpStatus).json({
      status: isHealthy ? "ok" : "degraded",
      contractId: config.contractId,
      rpcUrl: config.rpcUrl,
      listener: {
        running: listener.running,
        lastPoll: listener.lastPoll,
        lastError: listener.lastError,
        processed: listener.processed,
      },
      index: {
        contractId: config.contractId,
        lastLedger: health.lastLedger,
        payoutCount: health.payoutCount,
        backlog: health.backlog,
        dbSizeBytes: health.sizeBytes,
      },
    });
  });

  app.get("/payouts", (req, res) => {
    let limit = 50;
    if (req.query.limit !== undefined) {
      const parsed = Number(req.query.limit);
      if (Number.isInteger(parsed)) {
        limit = Math.min(Math.max(parsed, 1), 200);
        if (limit !== parsed) {
          console.log(`[api] Clamped requested limit ${parsed} to ${limit}`);
        }
      }
    }
    const cursor = req.query.cursor ? Number(req.query.cursor) : undefined;
    if (cursor !== undefined && (!Number.isInteger(cursor) || cursor < 0)) {
      res.status(400).json({ error: "bad_request", message: "Invalid cursor parameter: must be a positive integer" });
      return;
    }
    const batchId =
      typeof req.query.batchId === "string" ? req.query.batchId : undefined;
    const payee =
      typeof req.query.payee === "string" ? req.query.payee : undefined;
    const department =
      typeof req.query.department === "string" ? req.query.department : undefined;

    const page = store.listPayouts({ batchId, payee, department, limit, cursor });
    res.json({
      payouts: page.payouts.map(toApiItem(config)),
      nextCursor: page.nextCursor,
    });
  app.get("/payouts/export", (req, res) => {
    const format = req.query.format === "csv" ? "csv" : "json";
    const page = store.listPayouts({ limit: 1000 });
    const items = page.payouts.map(toApiItem(config));

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="payouts.csv"');
      const header = "txHash,logIndex,batchId,payee,amountDisplay,department,createdAt\n";
      const rows = items
        .map(
          (i) =>
            `${i.txHash},${i.logIndex},${i.batchId},${i.payee},${i.amountDisplay},${i.department},${i.createdAt}`
        )
        .join("\n");
      res.send(header + rows);
      return;
    }

    res.json({ count: items.length, payouts: items });
  });

  app.get("/payouts/:txHash", (req, res) => {
    const payouts = store.getPayouts(req.params.txHash);
    if (payouts.length === 0) {
      res.status(404).json({ error: "not_found", message: "Payout not found" });
      return;
    }
    res.json({
      txHash: req.params.txHash,
      payouts: payouts.map(toApiItem(config)),
    });
  });

  app.get("/batches/:id", (req, res) => {
    const page = store.listPayouts({ batchId: req.params.id, limit: 200 });
    if (page.payouts.length === 0) {
      res.status(404).json({ error: "not_found", message: `Batch ${req.params.id} not found` });
      return;
    }
    const items = page.payouts.map(toApiItem(config));
    let totalBase = 0n;
    for (const p of page.payouts) {
      totalBase += BigInt(p.amountBase);
    }
    res.json({
      batchId: req.params.id,
      itemCount: items.length,
      totalAmountDisplay: fromBaseUnits(totalBase, config.tokenDecimals),
      payouts: items,
    });
  });

  // 404 for unknown routes.
  app.use((req, res) => {
    res.status(404).json({ error: "not_found", message: `No route ${req.path}` });
  });

  // Central error handler.
  app.use(
    (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error("[api] error:", err);
      res.status(500).json({
        error: "internal",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  );

  return app;
}

function toApiItem(config: Config) {
  return (p: {
    txHash: string;
    logIndex: number;
    batchId: string;
    payee: string;
    amountDisplay: string;
    department: string;
    ledger: number;
    createdAt: string;
  }): PayoutApiItem => ({
    txHash: p.txHash,
    index: p.logIndex,
    batchId: p.batchId,
    payee: p.payee,
    amount: p.amountDisplay,
    token: config.tokenSymbol,
    date: p.createdAt,
    ledger: p.ledger,
    department: p.department,
  });
}
