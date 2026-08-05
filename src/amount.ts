/**
 * Amount conversion helpers. The contract stores i128 amounts in base units
 * (e.g. 1 USDC = 1_000_000 base units with 6 decimals).
 */

/** Convert base units to a human decimal string, e.g. "250.50". */
export function fromBaseUnits(
  value: bigint | number | string,
  decimals: number
): string {
  const n = BigInt(value);
  const neg = n < 0n ? true : false;
  const abs = neg ? -n : n;
  const s = abs.toString().padStart(decimals + 1, "0");
  const intPart = s.slice(0, -decimals);
  const fracPart = s.slice(-decimals).replace(/0+$/, "");
  return `${neg ? "-" : ""}${intPart}${fracPart ? "." + fracPart : ""}`;
}

/** Validate an amount string: optional sign, digits, optional single fraction. */
function isValidAmountString(value: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(value);
}

/** Convert a human decimal string to base units as a BigInt. */
export function toBaseUnits(value: string, decimals: number): bigint {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`Invalid amount: ${value}`);

  // Reject malformed inputs up front: multiple dots, empty parts, junk.
  if (!isValidAmountString(trimmed)) {
    throw new Error(`Invalid amount: ${value}`);
  }

  const [int = "", frac = ""] = trimmed.split(".");
  // If the fraction is longer than `decimals`, rounding it silently could
  // change the value; reject over-precision instead of truncating.
  if (frac.length > decimals) {
    throw new Error(`Invalid amount: ${value} exceeds ${decimals} decimals`);
  }
  const sign = int.startsWith("-") ? -1n : 1n;
  const digits = int.replace(/^-/, "") + frac.padEnd(decimals, "0");
  if (!/^\d+$/.test(digits)) throw new Error(`Invalid amount: ${value}`);
  return BigInt(digits.replace(/^0+/, "") || "0") * sign;
}
