import assert from "node:assert/strict";
import { test } from "node:test";
import type { LedgerClient, Summary, SummaryRange, Warranty } from "./api.js";
import { daysSince, inactivityNotice, reportsDue, startInactivityReminder, startRecurringSync, startReports, startWarrantyNotices, warrantyNotice } from "./scheduler.js";

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
  assert.equal(calls.length, 2); // el periodo y el anterior (comparativa)
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

test("el informe automatico adjunta el grafico y, si este falla, no repite el texto", async () => {
  for (const failChart of [false, true]) {
    const texts: string[] = [];
    const images: Buffer[] = [];
    const stop = startReports({
      api: apiWith([]),
      timeZone: TZ,
      intervalMs: 5,
      now: () => at(2026, 11, 8, 19, 5),
      send: async (t) => {
        texts.push(t);
      },
      chart: async () => {
        if (failChart) throw new Error("sin fuente");
        return Buffer.from([1]);
      },
      sendImage: async (png) => {
        images.push(png);
      },
    });
    await wait(60);
    stop();
    assert.equal(texts.length, 1);
    assert.equal(images.length, failChart ? 0 : 1);
  }
});

const warranty = (name: string, daysLeft: number): Warranty => ({
  id: name,
  name,
  purchaseDate: "2025-01-01",
  months: 24,
  expiresOn: "2026-12-06",
  daysLeft,
  note: "",
  receiptUrl: null,
});

test("warrantyNotice avisa solo a 30, 7, 1 y 0 dias", () => {
  assert.equal(warrantyNotice([warranty("A", 100), warranty("B", 29), warranty("C", -1)]), null);
  const text = warrantyNotice([warranty("TV", 30), warranty("Móvil", 7), warranty("Horno", 1), warranty("Nevera", 0), warranty("X", 5)])!;
  assert.match(text, /TV: caduca en 30 días/);
  assert.match(text, /Móvil: caduca en 7 días/);
  assert.match(text, /Horno: caduca mañana/);
  assert.match(text, /Nevera: caduca HOY/);
  assert.ok(!text.includes("• X"));
});

test("el aviso de garantias sale una vez al dia a las 10:xx", async () => {
  for (const [hourUtc, expected] of [[9, 1], [12, 0]] as const) {
    const sent: string[] = [];
    const stop = startWarrantyNotices({
      api: { warranties: async () => [warranty("TV", 7)] } as unknown as LedgerClient,
      timeZone: TZ,
      intervalMs: 5,
      now: () => at(2026, 11, 6, hourUtc, 5), // 10:05 CET o 13:05 CET
      send: async (t) => {
        sent.push(t);
      },
    });
    await wait(60);
    stop();
    assert.equal(sent.length, expected);
  }
});

test("el informe incluye el periodo con el que comparar", () => {
  assert.deepEqual(reportsDue(at(2026, 11, 8, 19, 5), TZ)[0]?.compare, { from: "2026-10-26", to: "2026-11-01" });
  assert.deepEqual(reportsDue(at(2026, 12, 1, 8, 10), TZ)[0]?.compare, { month: "2026-10" });
  assert.deepEqual(reportsDue(at(2027, 1, 1, 8, 0), TZ)[0]?.compare, { month: "2026-11" });
});

test("daysSince cuenta dias naturales en la zona local", () => {
  // 23:30 UTC del 1 es ya dia 2 en Madrid
  assert.equal(daysSince("2026-11-01T23:30:00Z", at(2026, 11, 8, 12), TZ), 6);
  assert.equal(daysSince("2026-11-01T10:00:00Z", at(2026, 11, 8, 12), TZ), 7);
  assert.equal(daysSince("2026-11-08T05:00:00Z", at(2026, 11, 8, 12), TZ), 0);
});

test("el recordatorio solo toca a los 7, 14, 21... dias", () => {
  for (const d of [0, 1, 6, 8, 13, 15]) assert.equal(inactivityNotice(d), null, String(d));
  assert.match(inactivityNotice(7)!, /Llevas 7 días/);
  assert.match(inactivityNotice(14)!, /Llevas 14 días/);
});

test("recordatorio a las 19:xx y sincronizacion de recurrentes a las 06:xx", async () => {
  const run = async (starter: typeof startInactivityReminder, hourUtc: number, api: Partial<LedgerClient>) => {
    const sent: string[] = [];
    const stop = starter({
      api: api as LedgerClient,
      timeZone: TZ,
      intervalMs: 5,
      now: () => at(2026, 11, 8, hourUtc, 5),
      send: async (t) => {
        sent.push(t);
      },
    });
    await wait(60);
    stop();
    return sent;
  };
  const sevenDaysAgo = "2026-11-01T10:00:00Z";
  assert.equal((await run(startInactivityReminder, 18, { lastManualEntryAt: async () => sevenDaysAgo })).length, 1); // 19:05
  assert.equal((await run(startInactivityReminder, 12, { lastManualEntryAt: async () => sevenDaysAgo })).length, 0); // 13:05
  assert.equal((await run(startInactivityReminder, 18, { lastManualEntryAt: async () => "2026-11-05T10:00:00Z" })).length, 0);
  assert.equal((await run(startInactivityReminder, 18, { lastManualEntryAt: async () => null })).length, 0);
  assert.equal((await run(startRecurringSync, 5, { syncRecurring: async () => 2 })).length, 1); // 06:05
  assert.equal((await run(startRecurringSync, 5, { syncRecurring: async () => 0 })).length, 0);
});

test("el informe mensual lleva la comparativa", async () => {
  const sent: string[] = [];
  const prev: Summary = { period: "2026-10", income: 100, expense: 50, balance: 50, expenseByCategory: [{ category: "Ocio", total: 50 }] };
  const cur: Summary = { period: "2026-11", income: 100, expense: 100, balance: 0, expenseByCategory: [{ category: "Ocio", total: 100 }] };
  const stop = startReports({
    api: { summary: async (r?: SummaryRange) => (r && "month" in r && r.month === "2026-10" ? prev : cur) } as unknown as LedgerClient,
    timeZone: TZ,
    intervalMs: 5,
    now: () => at(2026, 12, 1, 8, 10),
    send: async (t) => {
      sent.push(t);
    },
  });
  await wait(60);
  stop();
  assert.equal(sent.length, 1);
  assert.match(sent[0]!, /Frente a 2026-10/);
  assert.match(sent[0]!, /\+100 %/);
});
