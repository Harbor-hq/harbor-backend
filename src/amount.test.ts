import { test } from "node:test";
import assert from "node:assert/strict";
import { fromBaseUnits, toBaseUnits } from "./amount.js";

test("toBaseUnits converts decimal strings to base units", () => {
  assert.equal(toBaseUnits("250.50", 6).toString(), "250500000");
  assert.equal(toBaseUnits("0.000001", 6).toString(), "1");
  assert.equal(toBaseUnits("123", 6).toString(), "123000000");
  assert.equal(toBaseUnits("-5.5", 6).toString(), "-5500000");
});

test("fromBaseUnits formats base units back to decimal strings", () => {
  assert.equal(fromBaseUnits(250500000n, 6), "250.5");
  assert.equal(fromBaseUnits(1n, 6), "0.000001");
  assert.equal(fromBaseUnits(123000000n, 6), "123");
  assert.equal(fromBaseUnits(-5500000n, 6), "-5.5");
});

test("round-trip is stable", () => {
  for (const v of ["0.01", "1", "42.424242", "1000000.123456"]) {
    assert.equal(fromBaseUnits(toBaseUnits(v, 6), 6), v);
  }
});

test("toBaseUnits rejects malformed input", () => {
  assert.throws(() => toBaseUnits("", 6));
  assert.throws(() => toBaseUnits("abc", 6));
  assert.throws(() => toBaseUnits("1.2.3", 6));
  assert.throws(() => toBaseUnits(".5", 6));
  assert.throws(() => toBaseUnits("5.", 6));
  assert.throws(() => toBaseUnits("12a", 6));
  assert.throws(() => toBaseUnits("1 2", 6));
});

test("toBaseUnits rejects over-precision beyond decimals", () => {
  assert.throws(() => toBaseUnits("250.5050505", 6));
});
