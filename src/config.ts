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
  corsAllowedOrigins: string[];
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const contractId = env.CONTRACT_ID ?? "CD4U2T3X5K7G2J6L4A8B9Z1Y0W_MOCK_CONTRACT_ID";
  
  // Validate CONTRACT_ID format
  if (contractId !== "CD4U2T3X5K7G2J6L4A8B9Z1Y0W_MOCK_CONTRACT_ID") {
    const regex = /^C[A-Z2-7]{55}$/;
    if (!regex.test(contractId)) {
      throw new Error(
        `Invalid CONTRACT_ID format: "${contractId}". Soroban contract IDs must start with 'C' and be 56 characters long.`
      );
    }
  }

  return {
    rpcUrl: env.RPC_URL ?? "https://soroban-testnet.stellar.org",
    contractId,
    tokenSymbol: env.TOKEN_SYMBOL ?? "USDC",
    tokenDecimals: num("TOKEN_DECIMALS", 6),
    host: env.HOST ?? "0.0.0.0",
    port: num("PORT", 8787),
    pollIntervalMs: num("POLL_INTERVAL_MS", 5000),
    startLedgerBack: num("START_LEDGER_BACK", 10),
    dbPath: env.DB_PATH ?? "./data/harbor.db",
    corsAllowedOrigins: env.CORS_ALLOWED_ORIGINS
      ? env.CORS_ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
      : ["http://localhost:3000"],
  };
}
