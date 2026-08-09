import assert from "node:assert";
import test from "node:test";
import { getConfig } from "./config.js";

test("getConfig loads defaults", () => {
  const config = getConfig({});
  assert.equal(config.rpcUrl, "https://soroban-testnet.stellar.org");
  assert.equal(config.contractId, "CD4U2T3X5K7G2J6L4A8B9Z1Y0W_MOCK_CONTRACT_ID");
});

test("getConfig validates valid CONTRACT_ID", () => {
  const validId = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const config = getConfig({ CONTRACT_ID: validId });
  assert.equal(config.contractId, validId);
});

test("getConfig throws on invalid CONTRACT_ID format", () => {
  assert.throws(() => {
    getConfig({ CONTRACT_ID: "invalid_id" });
  }, /Invalid CONTRACT_ID format/);

  assert.throws(() => {
    getConfig({ CONTRACT_ID: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }); // starts with G
  }, /Invalid CONTRACT_ID format/);
});

test("getConfig validates RPC_URL format", () => {
  assert.throws(() => {
    getConfig({ RPC_URL: "not_a_url" });
  }, /Invalid configuration: RPC_URL must be a valid URL/);
});

test("getConfig validates numeric environment variables", () => {
  assert.throws(() => {
    getConfig({ PORT: "not_a_number" });
  }, /Invalid configuration: PORT must be a non-negative number/);

  assert.throws(() => {
    getConfig({ POLL_INTERVAL_MS: "-500" });
  }, /Invalid configuration: POLL_INTERVAL_MS must be a non-negative number/);
});
