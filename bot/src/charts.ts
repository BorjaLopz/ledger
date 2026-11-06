import { Resvg } from "@resvg/resvg-js";
import type { LedgerClient, MonthTotal, Summary } from "./api.js";
import { money, periodLabel } from "./format.js";

const BG = "#0f172a";
const CARD = "#1e293b";
const TEXT = "#f1f5f9";
const MUTED = "#94a3b8";
const GRID = "#334155";
const INCOME = "#22c55e";
const EXPENSE = "#f43f5e";
const FALLBACK = ["#14b8a6", "#3b82f6", "#a855f7", "#eab308", "#ec4899", "#f97316", "#06b6d4", "#84cc16"];
const OTHER = "#6b7280";
const FONT = "DejaVu Sans, sans-serif";
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** El renderizador no tiene fuente de emojis: se quitan de los titulos. */
export const plain = (s: string): string => s.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "").trim();
const cut = (s: string, max: number): string => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
const text = (x: number, y: number, s: string, size: number, fill: string, extra = ""): string =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" fill="${fill}" ${extra}>${esc(s)}</text>`;

const frame = (w: number, h: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
  `<rect width="${w}" height="${h}" fill="${BG}"/>${body}</svg>`;

export function renderPng(svg: string): Buffer {
  return new Resvg(svg, {
    font: { loadSystemFonts: true, defaultFontFamily: "DejaVu Sans" },
    background: BG,
  })
    .render()
    .asPng() as Buffer;
}

interface Slice {
  label: string;
  value: number;
  color: string;
}

/** Agrupa en "Otras" lo que pase de `max` porciones. */
export function toSlices(s: Summary, colors: Map<string, string>, max = 7): Slice[] {
  const sorted = s.expenseByCategory.filter((c) => c.total > 0);
  const used = new Set(sorted.slice(0, max).map((c) => colors.get(c.category)).filter(Boolean));
  const spare = FALLBACK.filter((c) => !used.has(c));
  let next = 0;
  const slices: Slice[] = sorted.slice(0, max).map((c) => {
    const own = colors.get(c.category);
    const color = own ?? spare[next++ % Math.max(spare.length, 1)] ?? FALLBACK[0]!;
    return { label: c.category, value: c.total, color };
  });
  const rest = sorted.slice(max).reduce((acc, c) => acc + c.total, 0);
  if (rest > 0) slices.push({ label: "Otras", value: rest, color: OTHER });
  return slices;
}

const polar = (cx: number, cy: number, r: number, angle: number): [number, number] => [
  cx + r * Math.cos(angle),
  cy + r * Math.sin(angle),
];

/** Donut de gastos por categoria. Devuelve null si no hay gastos. */
export function donutSvg(s: Summary, title: string, colors: Map<string, string> = new Map()): string | null {
  const slices = toSlices(s, colors);
  const total = slices.reduce((acc, x) => acc + x.value, 0);
  if (total <= 0) return null;

  const W = 1200;
  const rowH = 52;
  const H = Math.max(640, 190 + slices.length * rowH + 60);
  const cx = 330;
  const cy = 360;
  const R = 220;
  const r = 130;

  let body = text(60, 80, plain(title), 38, TEXT, 'font-weight="bold"');
  body += text(60, 122, `${periodLabel(s.period)} · gastos por categoría`, 24, MUTED);

  let angle = -Math.PI / 2;
  for (const sl of slices) {
    const sweep = (sl.value / total) * Math.PI * 2;
    if (slices.length === 1) {
      body += `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="${sl.color}" stroke-width="${R - r}"/>`;
    } else {
      const [x1, y1] = polar(cx, cy, R, angle);
      const [x2, y2] = polar(cx, cy, R, angle + sweep);
      const [x3, y3] = polar(cx, cy, r, angle + sweep);
      const [x4, y4] = polar(cx, cy, r, angle);
      const large = sweep > Math.PI ? 1 : 0;
      body +=
        `<path d="M${x1.toFixed(2)} ${y1.toFixed(2)} A${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} ` +
        `L${x3.toFixed(2)} ${y3.toFixed(2)} A${r} ${r} 0 ${large} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z" ` +
        `fill="${sl.color}" stroke="${BG}" stroke-width="3"/>`;
    }
    angle += sweep;
  }
  body += text(cx, cy - 6, "Total gastos", 22, MUTED, 'text-anchor="middle"');
  body += text(cx, cy + 34, money(total), 36, TEXT, 'text-anchor="middle" font-weight="bold"');

  const lx = 640;
  slices.forEach((sl, i) => {
    const y = 190 + i * rowH;
    const pct = Math.round((sl.value / total) * 100);
    body += `<rect x="${lx}" y="${y}" width="500" height="${rowH - 8}" rx="10" fill="${CARD}"/>`;
    body += `<rect x="${lx + 14}" y="${y + 13}" width="18" height="18" rx="5" fill="${sl.color}"/>`;
    body += text(lx + 46, y + 30, cut(sl.label, 18), 24, TEXT);
    body += text(lx + 486, y + 30, `${money(sl.value)} · ${pct}%`, 24, MUTED, 'text-anchor="end"');
  });
  return frame(W, H, body);
}

/** Escala "bonita" para el eje Y: devuelve el maximo redondeado y el paso. */
export function niceScale(max: number, ticks = 4): { top: number; step: number } {
  if (max <= 0) return { top: 1, step: 1 / ticks };
  const raw = max / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  return { top: step * Math.ceil(max / step), step };
}

const compact = (n: number): string =>
  n >= 1000 ? `${(n / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1 })}k` : String(Math.round(n));

/** Barras agrupadas ingresos/gastos por mes. Devuelve null si todo esta a cero. */
export function monthlyBarsSvg(months: MonthTotal[], title: string): string | null {
  if (months.length === 0 || months.every((m) => m.income === 0 && m.expense === 0)) return null;

  const W = 1200;
  const H = 680;
  const left = 110;
  const right = 50;
  const top = 190;
  const bottom = 90;
  const plotW = W - left - right;
  const plotH = H - top - bottom;
  const { top: yMax, step } = niceScale(Math.max(...months.flatMap((m) => [m.income, m.expense])));

  const income = months.reduce((a, m) => a + m.income, 0);
  const expense = months.reduce((a, m) => a + m.expense, 0);
  const balance = income - expense;

  let body = text(60, 80, plain(title), 38, TEXT, 'font-weight="bold"');
  body += text(
    60,
    122,
    `Últimos ${months.length} meses · Balance ${balance >= 0 ? "+" : ""}${money(balance)}`,
    24,
    balance >= 0 ? INCOME : EXPENSE,
  );
  // leyenda
  body += `<rect x="${W - 330}" y="60" width="18" height="18" rx="5" fill="${INCOME}"/>` + text(W - 304, 76, "Ingresos", 22, TEXT);
  body += `<rect x="${W - 180}" y="60" width="18" height="18" rx="5" fill="${EXPENSE}"/>` + text(W - 154, 76, "Gastos", 22, TEXT);

  for (let v = 0; v <= yMax + step / 2; v += step) {
    const y = top + plotH - (v / yMax) * plotH;
    body += `<line x1="${left}" y1="${y.toFixed(1)}" x2="${W - right}" y2="${y.toFixed(1)}" stroke="${GRID}" stroke-width="1"/>`;
    body += text(left - 12, y + 7, compact(v), 20, MUTED, 'text-anchor="end"');
  }

  const slot = plotW / months.length;
  const barW = Math.min(36, (slot - 12) / 2);
  months.forEach((m, i) => {
    const mid = left + slot * i + slot / 2;
    const bar = (value: number, x: number, color: string): string => {
      if (value <= 0) return "";
      const h = Math.max(2, (value / yMax) * plotH);
      return `<rect x="${(x).toFixed(1)}" y="${(top + plotH - h).toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="5" fill="${color}"/>`;
    };
    body += bar(m.income, mid - barW - 2, INCOME) + bar(m.expense, mid + 2, EXPENSE);
    const mm = Number(m.month.slice(5, 7));
    body += text(mid, H - 50, MONTHS[mm - 1] ?? m.month, 22, MUTED, 'text-anchor="middle"');
    if (mm === 1 || i === 0) body += text(mid, H - 22, m.month.slice(0, 4), 18, MUTED, 'text-anchor="middle"');
  });
  return frame(W, H, body);
}

async function categoryColors(api: LedgerClient): Promise<Map<string, string>> {
  try {
    return new Map((await api.categories()).map((c) => [c.name, c.color]));
  } catch {
    return new Map();
  }
}

/** PNG del donut de gastos de un resumen, o null si no hay gastos. */
export async function summaryChart(api: LedgerClient, s: Summary, title: string): Promise<Buffer | null> {
  const svg = donutSvg(s, title, await categoryColors(api));
  return svg ? renderPng(svg) : null;
}

/** PNG de barras de los ultimos `months` meses, o null si no hay datos. */
export async function monthlyChart(api: LedgerClient, months: number, title: string): Promise<Buffer | null> {
  const svg = monthlyBarsSvg(await api.monthly(months), title);
  return svg ? renderPng(svg) : null;
}
