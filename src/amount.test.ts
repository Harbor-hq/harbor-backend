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

test("toBaseUnits and fromBaseUnits handle zero properly", () => {
  assert.equal(toBaseUnits("0", 6).toString(), "0");
  assert.equal(toBaseUnits("0.0", 6).toString(), "0");
  assert.equal(toBaseUnits("-0", 6).toString(), "0");
  assert.equal(toBaseUnits("-0.00", 6).toString(), "0");
  assert.equal(fromBaseUnits(0n, 6), "0");
});

test("fromBaseUnits trims trailing fractional zeros correctly", () => {
  assert.equal(fromBaseUnits(1000000n, 6), "1");
  assert.equal(fromBaseUnits(100000n, 6), "0.1");
  assert.equal(fromBaseUnits(105000n, 6), "0.105");
});

test("toBaseUnits and fromBaseUnits handle maximum positive/negative i128 values without precision loss", () => {
  // Max positive i128 is 170141183460469231731687303715884105727
  const maxI128Str = "170141183460469231731687303715884105.727";
  const maxI128Base = 170141183460469231731687303715884105727n;
  assert.equal(toBaseUnits(maxI128Str, 3), maxI128Base);
  assert.equal(fromBaseUnits(maxI128Base, 3), maxI128Str);

  // Max negative i128 is -170141183460469231731687303715884105728
  const minI128Str = "-170141183460469231731687303715884105.728";
  const minI128Base = -170141183460469231731687303715884105728n;
  assert.equal(toBaseUnits(minI128Str, 3), minI128Base);
  assert.equal(fromBaseUnits(minI128Base, 3), minI128Str);
});
