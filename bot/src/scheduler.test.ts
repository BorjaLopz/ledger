import assert from "node:assert/strict";
import { test } from "node:test";
import type { LedgerClient, Summary, SummaryRange } from "./api.js";
import { reportsDue, startReports } from "./scheduler.js";

const TZ = "Europe/Madrid";
const at = (y: number, m: number, d: number, h: number, min = 0) => Date.UTC(y, m - 1, d, h, min);

test("domingo 20:xx (hora de Madrid, invierno) toca el semanal lunes-domingo", () => {
  const due = reportsDue(at(2026, 11, 8, 19, 5), TZ); // 20:05 CET
  assert.equal(due.length, 1);
  assert.equal(due[0]?.key, "w:2026-11-08");
  assert.deepEqual(due[0]?.range, { from: "2026-11-02", to: "2026-11-08" });
});

test("el semanal respeta el horario de verano", () => {
  const due = reportsDue(at(2026, 7, 5, 18, 30), TZ); // 20:30 CEST
  assert.deepEqual(due[0]?.range, { from: "2026-06-29", to: "2026-07-05" });
});

test("fuera de la ventana del domingo no toca nada", () => {
  assert.deepEqual(reportsDue(at(2026, 11, 8, 18, 59), TZ), []); // 19:59 local
  assert.deepEqual(reportsDue(at(2026, 11, 8, 20, 0), TZ), []); // 21:00 local
  assert.deepEqual(reportsDue(at(2026, 11, 7, 19, 30), TZ), []); // sabado
});

test("dia 1 a las 09:xx toca el mensual del mes anterior", () => {
  const due = reportsDue(at(2026, 12, 1, 8, 10), TZ); // 09:10 CET
  assert.equal(due.length, 1);
  assert.equal(due[0]?.key, "m:2026-11");
  assert.deepEqual(due[0]?.range, { month: "2026-11" });
});

test("el mensual de enero apunta a diciembre del año anterior", () => {
  const due = reportsDue(at(2027, 1, 1, 8, 0), TZ);
  assert.deepEqual(due[0]?.range, { month: "2026-12" });
});

const fakeSummary: Summary = { period: "2026-11-02/2026-11-08", income: 0, expense: 10, balance: -10, expenseByCategory: [] };
const apiWith = (calls: SummaryRange[]): LedgerClient =>
  ({
    summary: async (range?: SummaryRange) => {
      calls.push(range);
      return fakeSummary;
    },
  }) as unknown as LedgerClient;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("startReports envia el informe una sola vez aunque haya varios ticks", async () => {
  const calls: SummaryRange[] = [];
  const sent: string[] = [];
  const stop = startReports({
    api: apiWith(calls),
    timeZone: TZ,
    intervalMs: 5,
    now: () => at(2026, 11, 8, 19, 5),
    send: async (text) => {
      sent.push(text);
    },
  });
  await wait(60);
  stop();
  assert.equal(sent.length, 1);
  assert.equal(calls.length, 1);
  assert.match(sent[0]!, /📅 Resumen semanal · 02\/11 – 08\/11/);
  assert.match(sent[0]!, /Gastos: 10,00\s€/);
});

test("si el envio falla, reintenta en el siguiente tick", async () => {
  let attempts = 0;
  const sent: string[] = [];
  const originalError = console.error;
  console.error = () => undefined;
  const stop = startReports({
    api: apiWith([]),
    timeZone: TZ,
    intervalMs: 5,
    now: () => at(2026, 11, 8, 19, 5),
    send: async (text) => {
      if (++attempts === 1) throw new Error("telegram caido");
      sent.push(text);
    },
  });
  await wait(80);
  stop();
  console.error = originalError;
  assert.equal(sent.length, 1);
  assert.equal(attempts, 2);
});

test("fuera de ventana no envia nada", async () => {
  const sent: string[] = [];
  const stop = startReports({
    api: apiWith([]),
    timeZone: TZ,
    intervalMs: 5,
    now: () => at(2026, 11, 9, 12, 0),
    send: async (text) => {
      sent.push(text);
    },
  });
  await wait(40);
  stop();
  assert.equal(sent.length, 0);
});
