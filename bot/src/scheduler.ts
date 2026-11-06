import type { LedgerClient, Summary, SummaryRange, Warranty } from "./api.js";
import { longDate } from "./dates.js";
import { dateInZone, formatSummary, prevMonth } from "./format.js";

export interface DueReport {
  /** Identifica el informe para no enviarlo dos veces. */
  key: string;
  title: string;
  range: SummaryRange;
  /** Periodo anterior con el que comparar. */
  compare: SummaryRange;
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
      compare: { from: dateInZone(13, timeZone, nowMs), to: dateInZone(7, timeZone, nowMs) },
    });
  }

  if (p.day === 1 && p.hour === 9) {
    const prevYear = p.month === 1 ? p.year - 1 : p.year;
    const prevMonthNum = p.month === 1 ? 12 : p.month - 1;
    const label = `${prevYear}-${String(prevMonthNum).padStart(2, "0")}`;
    due.push({ key: `m:${label}`, title: "🗓 Resumen mensual", range: { month: label }, compare: { month: prevMonth(label) } });
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
        const before = await opts.api.summary(report.compare).catch(() => undefined);
        await opts.send(formatSummary(summary, report.title, before));
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

export interface DailyOptions {
  send: (text: string) => Promise<void>;
  timeZone: string;
  intervalMs?: number;
  now?: () => number;
}

/** Ejecuta `task` una vez al dia durante la hora `hour` (hora local). Si falla, reintenta el minuto siguiente. */
function startDaily(hour: number, name: string, opts: DailyOptions, task: (nowMs: number) => Promise<void>): () => void {
  const done = new Set<string>();
  const now = opts.now ?? Date.now;

  const tick = async (): Promise<void> => {
    const t = now();
    const p = localParts(t, opts.timeZone);
    if (p.hour !== hour || done.has(p.date)) return;
    done.add(p.date);
    try {
      await task(t);
    } catch (err) {
      done.delete(p.date);
      console.error(`No se pudo ejecutar ${name}:`, err instanceof Error ? err.message : err);
    }
  };

  const timer = setInterval(() => void tick(), opts.intervalMs ?? 60_000);
  timer.unref();
  return () => clearInterval(timer);
}

export interface WarrantyNoticeOptions extends DailyOptions {
  api: LedgerClient;
}

/** 10:xx: avisa de garantias que caducan en 30, 7 o 1 dias, o hoy. */
export function startWarrantyNotices(opts: WarrantyNoticeOptions): () => void {
  return startDaily(10, "el aviso de garantias", opts, async () => {
    const text = warrantyNotice(await opts.api.warranties());
    if (text) await opts.send(text);
  });
}

/** 06:xx: registra los pagos recurrentes vencidos (asi no hace falta abrir la web) y avisa si hubo alguno. */
export function startRecurringSync(opts: WarrantyNoticeOptions): () => void {
  return startDaily(6, "la sincronizacion de recurrentes", opts, async () => {
    const created = await opts.api.syncRecurring();
    if (created > 0) {
      await opts.send(`🔁 Se ${created === 1 ? "ha registrado 1 pago recurrente" : `han registrado ${created} pagos recurrentes`}. Míralo en /ultimo o /buscar.`);
    }
  });
}

/** Dias completos (en timeZone) entre el instante `iso` y `nowMs`. */
export function daysSince(iso: string, nowMs: number, timeZone: string): number {
  const day = (ms: number): number => {
    const [y, m, d] = dateInZone(0, timeZone, ms).split("-").map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((day(nowMs) - day(Date.parse(iso))) / 86_400_000);
}

/** Texto del recordatorio: solo a los 7, 14, 21... dias sin apuntar nada (null el resto de dias). */
export function inactivityNotice(days: number): string | null {
  if (days < 7 || days % 7 !== 0) return null;
  return `📝 Llevas ${days} días sin apuntar nada. ¿Se te ha pasado algún gasto, quizá del finde? Mándame algo como «12,50 café».`;
}

/** 19:xx: recuerda apuntar gastos si llevas 7, 14, 21... dias sin hacerlo (los recurrentes no cuentan). */
export function startInactivityReminder(opts: WarrantyNoticeOptions): () => void {
  return startDaily(19, "el recordatorio de inactividad", opts, async (nowMs) => {
    const last = await opts.api.lastManualEntryAt();
    if (!last) return;
    const text = inactivityNotice(daysSince(last, nowMs, opts.timeZone));
    if (text) await opts.send(text);
  });
}
