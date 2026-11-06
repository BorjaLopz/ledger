import type { LedgerClient, Summary, SummaryRange, Warranty } from "./api.js";
import { longDate } from "./dates.js";
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
  /** Opcional: dibuja el grafico del informe (null si no hay gastos) y lo envia. */
  chart?: (summary: Summary, title: string) => Promise<Buffer | null>;
  sendImage?: (png: Buffer) => Promise<void>;
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
        // El grafico es un extra: si falla no se reintenta (duplicaria el texto).
        if (opts.chart && opts.sendImage) {
          try {
            const png = await opts.chart(summary, report.title);
            if (png) await opts.sendImage(png);
          } catch (err) {
            console.error(`No se pudo enviar el grafico de ${report.key}:`, err instanceof Error ? err.message : err);
          }
        }
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

/** Dias de antelacion con los que se avisa de una garantia que caduca. */
export const WARRANTY_NOTICE_DAYS = [30, 7, 1, 0];

/** Texto del aviso diario, o null si hoy no caduca nada "de aviso". */
export function warrantyNotice(list: Warranty[]): string | null {
  const due = list.filter((w) => WARRANTY_NOTICE_DAYS.includes(w.daysLeft));
  if (due.length === 0) return null;
  const when = (d: number): string => (d === 0 ? "caduca HOY" : d === 1 ? "caduca mañana" : `caduca en ${d} días`);
  const lines = due.map((w) => `• ${w.name}: ${when(w.daysLeft)} (${longDate(w.expiresOn)})`);
  return `🛡 Garantías a punto de caducar:\n${lines.join("\n")}\n\nRevisa /garantias por si te interesa reclamar o ampliar algo.`;
}

export interface WarrantyNoticeOptions {
  api: LedgerClient;
  send: (text: string) => Promise<void>;
  timeZone: string;
  intervalMs?: number;
  now?: () => number;
}

/** Cada minuto comprueba si son las 10:xx (hora local) y, una vez al dia, avisa de garantias a punto de caducar. */
export function startWarrantyNotices(opts: WarrantyNoticeOptions): () => void {
  const done = new Set<string>();
  const now = opts.now ?? Date.now;

  const tick = async (): Promise<void> => {
    const p = localParts(now(), opts.timeZone);
    if (p.hour !== 10 || done.has(p.date)) return;
    done.add(p.date);
    try {
      const text = warrantyNotice(await opts.api.warranties());
      if (text) await opts.send(text);
    } catch (err) {
      done.delete(p.date); // reintenta en el siguiente minuto mientras dure la ventana
      console.error("No se pudo enviar el aviso de garantias:", err instanceof Error ? err.message : err);
    }
  };

  const timer = setInterval(() => void tick(), opts.intervalMs ?? 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
