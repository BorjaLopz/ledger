import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, longDate, parseDate } from "./dates.js";

const TODAY = "2026-11-06";

test("palabras y formatos habituales", () => {
  assert.equal(parseDate("hoy", TODAY), "2026-11-06");
  assert.equal(parseDate("Ayer", TODAY), "2026-11-05");
  assert.equal(parseDate("anteayer", TODAY), "2026-11-04");
  assert.equal(parseDate("15/03/2025", TODAY), "2025-03-15");
  assert.equal(parseDate("5-3-25", TODAY), "2025-03-05");
  assert.equal(parseDate("2025-03-15", TODAY), "2025-03-15");
});

test("dd/mm sin año usa el actual o el anterior si seria futuro", () => {
  assert.equal(parseDate("03/11", TODAY), "2026-11-03");
  assert.equal(parseDate("20/12", TODAY), "2025-12-20");
});

test("rechaza fechas imposibles, futuras o basura", () => {
  assert.equal(parseDate("31/02/2026", TODAY), null);
  assert.equal(parseDate("07/11/2026", TODAY), null);
  assert.equal(parseDate("mañana", TODAY), null);
  assert.equal(parseDate("", TODAY), null);
});

test("addDays y longDate cruzan mes y año", () => {
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
  assert.equal(longDate("2026-11-06"), "06/11/2026");
});
