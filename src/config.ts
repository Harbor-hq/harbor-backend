export interface Config {
  rpcUrl: string;
  contractId: string;
  tokenSymbol: string;
  tokenDecimals: number;
  host: string;
  port: number;
  pollIntervalMs: number;
  startLedgerBack: number;
  dbPath: string;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    rpcUrl: env.RPC_URL ?? "https://soroban-testnet.stellar.org",
    contractId:
      env.CONTRACT_ID ?? "CD4U2T3X5K7G2J6L4A8B9Z1Y0W_MOCK_CONTRACT_ID",
    tokenSymbol: env.TOKEN_SYMBOL ?? "USDC",
    tokenDecimals: num("TOKEN_DECIMALS", 6),
    host: env.HOST ?? "0.0.0.0",
    port: num("PORT", 8787),
    pollIntervalMs: num("POLL_INTERVAL_MS", 5000),
    startLedgerBack: num("START_LEDGER_BACK", 10),
    dbPath: env.DB_PATH ?? "./data/harbor.db",
  };
}
