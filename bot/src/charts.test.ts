import assert from "node:assert/strict";
import { test } from "node:test";
import { donutSvg, monthlyBarsSvg, niceScale, plain, renderPng, toSlices } from "./charts.js";
import type { Summary } from "./api.js";

const summary = (cats: [string, number][]): Summary => ({
  period: "2026-11",
  income: 0,
  expense: cats.reduce((a, [, n]) => a + n, 0),
  balance: 0,
  expenseByCategory: cats.map(([category, total]) => ({ category, total })),
});
const isPng = (b: Buffer) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

test("toSlices agrupa el resto en Otras y no repite colores", () => {
  const cats: [string, number][] = Array.from({ length: 10 }, (_, i) => [`c${i}`, 100 - i]);
  const slices = toSlices(summary(cats), new Map([["c0", "#14b8a6"]]));
  assert.equal(slices.length, 8);
  assert.equal(slices.at(-1)!.label, "Otras");
  assert.equal(slices.at(-1)!.value, 93 + 92 + 91);
  const colors = slices.slice(0, 7).map((s) => s.color);
  assert.equal(new Set(colors).size, colors.length);
});

test("donut: null sin gastos, PNG valido con una o varias categorias", () => {
  assert.equal(donutSvg(summary([]), "x"), null);
  assert.equal(donutSvg(summary([["A", 0]]), "x"), null);
  for (const cats of [[["Solo", 50]], [["A", 50], ["B", 25], ["C", 25]]] as [string, number][][]) {
    const svg = donutSvg(summary(cats), "Resumen")!;
    assert.ok(isPng(renderPng(svg)));
  }
});

test("los nombres se escapan en el SVG", () => {
  const svg = donutSvg(summary([["<b>&\"", 10], ["B", 5]]), "x")!;
  assert.ok(!svg.includes("<b>"));
  assert.ok(isPng(renderPng(svg)));
});

test("plain quita emojis de los titulos", () => {
  assert.equal(plain("📊 Resumen semanal"), "Resumen semanal");
  assert.equal(plain("🗓️ Año 2026"), "Año 2026");
});

test("niceScale", () => {
  assert.deepEqual(niceScale(2540), { top: 3000, step: 1000 });
  assert.deepEqual(niceScale(87), { top: 100, step: 50 });
  assert.equal(niceScale(0).top, 1);
});

test("barras: null sin datos, PNG valido con datos", () => {
  assert.equal(monthlyBarsSvg([], "x"), null);
  assert.equal(monthlyBarsSvg([{ month: "2026-11", income: 0, expense: 0 }], "x"), null);
  const svg = monthlyBarsSvg(
    [
      { month: "2026-10", income: 2000, expense: 800 },
      { month: "2026-11", income: 0, expense: 1234.5 },
    ],
    "Balance",
  )!;
  assert.ok(isPng(renderPng(svg)));
  assert.match(svg, /Balance \+?-?[\d.,]+/);
});
