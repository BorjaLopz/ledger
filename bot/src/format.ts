import type { Summary } from "./api.js";

const euro = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
export const money = (n: number): string => euro.format(n);

/** "2026-11-06" -> "06/11" */
export const shortDate = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Fecha YYYY-MM-DD de hace `daysAgo` dias en la zona horaria indicada. */
export function dateInZone(daysAgo: number, timeZone: string, now: number = Date.now()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(now - daysAgo * 86_400_000),
  );
}

/** "2026-11-02/2026-11-08" -> "02/11 – 08/11"; un mes ("2026-11") se deja tal cual. */
export function periodLabel(period: string): string {
  const range = /^(\d{4}-\d{2}-\d{2})\/(\d{4}-\d{2}-\d{2})$/.exec(period);
  return range ? `${shortDate(range[1]!)} – ${shortDate(range[2]!)}` : period;
}

export function formatSummary(s: Summary, title: string): string {
  const lines = [
    `${title} · ${periodLabel(s.period)}`,
    `Ingresos: ${money(s.income)}`,
    `Gastos: ${money(s.expense)}`,
    `Balance: ${money(s.balance)}`,
  ];
  if (s.expenseByCategory.length > 0) {
    lines.push("", "Gastos por categoría:");
    for (const c of s.expenseByCategory) lines.push(`• ${c.category}: ${money(c.total)}`);
  }
  return lines.join("\n");
}
