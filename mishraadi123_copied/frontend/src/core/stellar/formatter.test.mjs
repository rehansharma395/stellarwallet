// Unit tests for the pure XLM/stroop conversion helpers.
// Run with: npm test  (uses Node's built-in test runner, no extra deps)
import test from "node:test";
import assert from "node:assert/strict";
import { convertXlmToStroops, convertStroopsToXlm, STROOPS_UNIT } from "./formatter.js";

test("convertXlmToStroops converts whole XLM to stroops as BigInt", () => {
  assert.equal(convertXlmToStroops(1), 10_000_000n);
  assert.equal(convertXlmToStroops(0), 0n);
  assert.equal(typeof convertXlmToStroops(1), "bigint");
});

test("convertXlmToStroops handles fractional XLM and floors sub-stroop amounts", () => {
  assert.equal(convertXlmToStroops(0.5), 5_000_000n);
  assert.equal(convertXlmToStroops(1.2345678), 12_345_678n);
  // 0.00000009 XLM = 0.9 stroops -> floors to 0
  assert.equal(convertXlmToStroops(0.00000009), 0n);
});

test("convertStroopsToXlm converts stroops back to an XLM string", () => {
  assert.equal(convertStroopsToXlm(10_000_000), "1");
  assert.equal(convertStroopsToXlm(5_000_000n), "0.5");
  assert.equal(convertStroopsToXlm("12345678"), "1.2345678");
});

test("convertStroopsToXlm returns '0' for falsy input", () => {
  assert.equal(convertStroopsToXlm(0), "0");
  assert.equal(convertStroopsToXlm(null), "0");
  assert.equal(convertStroopsToXlm(undefined), "0");
});

test("convertXlmToStroops and convertStroopsToXlm round-trip for typical ticket prices", () => {
  for (const xlm of [1, 2.5, 10, 0.1]) {
    assert.equal(convertStroopsToXlm(convertXlmToStroops(xlm)), String(xlm));
  }
});

test("STROOPS_UNIT matches the 7-decimal native asset precision", () => {
  assert.equal(STROOPS_UNIT, 10 ** 7);
});
