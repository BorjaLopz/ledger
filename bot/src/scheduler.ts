import type { LedgerClient, SummaryRange } from "./api.js";
import { dateInZone, formatSummary } from "./format.js";

export interface DueReport {
  /** Identifica el informe para no enviarlo dos veces. */
  key: string;
  title: string;
  range: SummaryRange;
}

function localParts(nowMs: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(new Date(nowMs));
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? "";
  const year = Number(get("year"));
  const month = Number(get("month"));
  return {
    year,
    month,
    day: Number(get("day")),
    hour: Number(get("hour")),
    weekday: get("weekday"),
    date: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

/**
 * Informes que "toca" enviar en este instante (hora local de timeZone):
 *  - semanal: domingos entre las 20:00 y las 20:59 (lunes a domingo)
 *  - mensual: el dia 1 entre las 09:00 y las 09:59 (mes anterior)
 * Es una funcion pura; quien la llama se encarga de no repetir una misma `key`.
 */
export function reportsDue(nowMs: number, timeZone: string): DueReport[] {
  const p = localParts(nowMs, timeZone);
  const due: DueReport[] = [];

  if (p.weekday === "Sun" && p.hour === 20) {
    due.push({
      key: `w:${p.date}`,
      title: "📅 Resumen semanal",
      range: { from: dateInZone(6, timeZone, nowMs), to: p.date },
    });
  }

  if (p.day === 1 && p.hour === 9) {
    const prevYear = p.month === 1 ? p.year - 1 : p.year;
    const prevMonth = p.month === 1 ? 12 : p.month - 1;
    const label = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
    due.push({ key: `m:${label}`, title: "🗓 Resumen mensual", range: { month: label } });
  }

  return due;
}

export interface ReportOptions {
  api: LedgerClient;
  send: (text: string) => Promise<void>;
  timeZone: string;
  intervalMs?: number;
  now?: () => number;
}

/** Comprueba cada minuto si toca algun informe y lo envia una sola vez. Devuelve una funcion para pararlo. */
export function startReports(opts: ReportOptions): () => void {
  const sent = new Set<string>();
  const now = opts.now ?? Date.now;

  const tick = async (): Promise<void> => {
    for (const report of reportsDue(now(), opts.timeZone)) {
      if (sent.has(report.key)) continue;
      sent.add(report.key);
      try {
        const summary = await opts.api.summary(report.range);
        await opts.send(formatSummary(summary, report.title));
      } catch (err) {
        sent.delete(report.key); // reintenta en el siguiente minuto mientras dure la ventana
        console.error(`No se pudo enviar el informe ${report.key}:`, err instanceof Error ? err.message : err);
      }
    }
  };

  const timer = setInterval(() => void tick(), opts.intervalMs ?? 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
