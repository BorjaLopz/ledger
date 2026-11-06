import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAmount, parseEntry } from "./parser.js";

test("importes en formato espanol e ingles", () => {
  assert.equal(parseAmount("12,50"), 12.5);
  assert.equal(parseAmount("12.5"), 12.5);
  assert.equal(parseAmount("1.234,56"), 1234.56);
  assert.equal(parseAmount("1,234.56"), 1234.56);
  assert.equal(parseAmount("1.234"), 1234);
  assert.equal(parseAmount("1.234.567"), 1234567);
  assert.equal(parseAmount("3,5€"), 3.5);
  assert.equal(parseAmount("0"), null);
  assert.equal(parseAmount("12,3,4"), null);
  assert.equal(parseAmount("abc"), null);
});

const cases: [string, { type: string; amount: number; note: string; daysAgo: number } | null][] = [
  ["12,50 café", { type: "expense", amount: 12.5, note: "café", daysAgo: 0 }],
  ["café 12,50", { type: "expense", amount: 12.5, note: "café", daysAgo: 0 }],
  ["45€ gasolina ayer", { type: "expense", amount: 45, note: "gasolina", daysAgo: 1 }],
  ["45 € gasolina", { type: "expense", amount: 45, note: "gasolina", daysAgo: 0 }],
  ["+1200 nómina", { type: "income", amount: 1200, note: "nómina", daysAgo: 0 }],
  ["ingreso 1200 nómina", { type: "income", amount: 1200, note: "nómina", daysAgo: 0 }],
  ["gasto 3.5 pan", { type: "expense", amount: 3.5, note: "pan", daysAgo: 0 }],
  ["-20 multa", { type: "expense", amount: 20, note: "multa", daysAgo: 0 }],
  ["1.234,56 coche", { type: "expense", amount: 1234.56, note: "coche", daysAgo: 0 }],
  ["12,50", { type: "expense", amount: 12.5, note: "", daysAgo: 0 }],
  ["cena 12,50 con 2 amigos", { type: "expense", amount: 12.5, note: "cena con 2 amigos", daysAgo: 0 }],
  ["anteayer 8 pan", { type: "expense", amount: 8, note: "pan", daysAgo: 2 }],
  ["  12,50    café   ", { type: "expense", amount: 12.5, note: "café", daysAgo: 0 }],
  ["hola", null],
  ["0 nada", null],
  ["", null],
  ["12,3,4 raro", null],
];

for (const [input, expected] of cases) {
  test(`parseEntry(${JSON.stringify(input)})`, () => {
    assert.deepEqual(parseEntry(input), expected);
  });
}
