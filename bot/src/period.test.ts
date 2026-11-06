import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePeriod } from "./period.js";

test("parsePeriod", () => {
  assert.deepEqual(parsePeriod(""), { kind: "current" });
  assert.deepEqual(parsePeriod(" 2026-10 "), { kind: "month", month: "2026-10" });
  assert.deepEqual(parsePeriod("2026"), { kind: "year", year: "2026" });
  assert.equal(parsePeriod("2026-13"), null);
  assert.equal(parsePeriod("abc"), null);
});
