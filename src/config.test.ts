import { describe, it, expect } from "vitest"; // Wait, backend uses node:test!
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
