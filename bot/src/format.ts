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

/** "2026-01" -> "2025-12" */
export function prevMonth(month: string): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

const signedMoney = (n: number): string => `${n > 0 ? "+" : ""}${money(n)}`;
const signedPct = (cur: number, prev: number): string | null =>
  prev === 0 ? null : `${cur >= prev ? "+" : ""}${Math.round(((cur - prev) / prev) * 100)} %`;

function versus(label: string, cur: number, prev: number): string | null {
  if (cur === 0 && prev === 0) return null;
  const pct = signedPct(cur, prev);
  return `• ${label}: ${money(cur)} (${[pct, signedMoney(cur - prev)].filter(Boolean).join(", ")})`;
}

/** Bloque "frente al periodo anterior" (null si el anterior no tiene datos). */
export function formatComparison(cur: Summary, prev: Summary): string | null {
  if (prev.income === 0 && prev.expense === 0) return null;
  const lines = [`↔️ Frente a ${periodLabel(prev.period)}:`];
  const exp = versus("Gastos", cur.expense, prev.expense);
  const inc = versus("Ingresos", cur.income, prev.income);
  if (exp) lines.push(exp);
  if (inc) lines.push(inc);

  const before = new Map(prev.expenseByCategory.map((c) => [c.category, c.total]));
  const names = new Set([...before.keys(), ...cur.expenseByCategory.map((c) => c.category)]);
  const now = new Map(cur.expenseByCategory.map((c) => [c.category, c.total]));
  const moves = [...names]
    .map((name) => ({ name, now: now.get(name) ?? 0, was: before.get(name) ?? 0 }))
    .map((m) => ({ ...m, delta: m.now - m.was }))
    .filter((m) => Math.abs(m.delta) >= 1)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);
  if (moves.length > 0) {
    lines.push("Lo que más ha cambiado:");
    for (const m of moves) {
      const pct = signedPct(m.now, m.was);
      lines.push(`• ${m.name}: ${signedMoney(m.delta)}${pct ? ` (${pct})` : " (nueva)"}`);
    }
  }
  return lines.join("\n");
}

export function formatSummary(s: Summary, title: string, prev?: Summary): string {
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
  const comparison = prev ? formatComparison(s, prev) : null;
  if (comparison) lines.push("", comparison);
  return lines.join("\n");
}
