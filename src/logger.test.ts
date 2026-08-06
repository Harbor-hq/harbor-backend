import test from "node:test";
import assert from "node:assert/strict";
import { logger } from "./logger.js";

test("logger output JSON format", () => {
  const originalLog = console.log;
  let loggedMessage = "";
  console.log = (msg: string) => {
    loggedMessage = msg;
  };

  try {
    logger.info("testing structured logs", { key: "value" });
    const parsed = JSON.parse(loggedMessage);
    assert.equal(parsed.level, "info");
    assert.equal(parsed.msg, "testing structured logs");
    assert.equal(parsed.key, "value");
    assert.ok(parsed.ts);
  } finally {
    console.log = originalLog;
  }
});
