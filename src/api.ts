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
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.get("/health", (_req, res) => {
    const health = store.health();
    const latest = store.getCheckpoint(config.contractId);
    res.json({
      status: "ok",
      contractId: config.contractId,
      rpcUrl: config.rpcUrl,
      listener: {
        running: listener.running,
        lastPoll: listener.lastPoll,
        lastError: listener.lastError,
        processed: listener.processed,
      },
      index: {
        lastLedger: latest ?? health.lastLedger,
        payoutCount: health.payoutCount,
      },
    });
  });

  app.get("/payouts", (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const cursor = req.query.cursor ? Number(req.query.cursor) : undefined;
    const batchId =
      typeof req.query.batchId === "string" ? req.query.batchId : undefined;
    const payee =
      typeof req.query.payee === "string" ? req.query.payee : undefined;

    const page = store.listPayouts({ batchId, payee, limit, cursor });
    res.json({
      payouts: page.payouts.map(toApiItem(config)),
      nextCursor: page.nextCursor,
    });
  });

  app.get("/payouts/:txHash", (req, res) => {
    const payout = store.getPayout(req.params.txHash);
    if (!payout) {
      res.status(404).json({ error: "not_found", message: "Payout not found" });
      return;
    }
    res.json(toApiItem(config)(payout));
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
  });
}
