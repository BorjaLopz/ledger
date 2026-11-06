export type EntryType = "expense" | "income";

export interface ParsedEntry {
  type: EntryType;
  amount: number;
  note: string;
  /** 0 = hoy, 1 = ayer, 2 = anteayer */
  daysAgo: number;
}

const AMOUNT_RE = /^[+-]?\d[\d.,]*(€|eur|euros?)?$/i;
const CURRENCY_ONLY = new Set(["€", "eur", "euro", "euros"]);
const DAY_WORDS: Record<string, number> = { hoy: 0, ayer: 1, anteayer: 2, antier: 2 };
const EXPENSE_WORDS = new Set(["gasto", "gastos", "-"]);
const INCOME_WORDS = new Set(["ingreso", "ingresos", "+"]);

/** "12,50" -> 12.5 · "1.234,56" -> 1234.56 · "1.234" -> 1234 · "3.5" -> 3.5. null si no es valido. */
export function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/(€|eur|euros?)$/i, "").replace(/^[+-]/, "").trim();
  if (!/^\d[\d.,]*$/.test(cleaned)) return null;

  let normalized: string;
  const hasDot = cleaned.includes(".");
  const hasComma = cleaned.includes(",");
  if (hasDot && hasComma) {
    const decimalSep = cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".") ? "," : ".";
    const thousandSep = decimalSep === "," ? "." : ",";
    normalized = cleaned.split(thousandSep).join("").replace(decimalSep, ".");
  } else if (hasComma) {
    // coma siempre decimal; varias comas no tienen sentido
    if (cleaned.split(",").length > 2) return null;
    normalized = cleaned.replace(",", ".");
  } else if (hasDot) {
    // "1.234" o "1.234.567" = miles; "3.5" o "12.50" = decimal
    normalized = /^\d{1,3}(\.\d{3})+$/.test(cleaned) ? cleaned.split(".").join("") : cleaned;
    if (normalized.split(".").length > 2) return null;
  } else {
    normalized = cleaned;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value * 100) / 100;
  if (rounded <= 0 || rounded >= 1_000_000_000) return null;
  return rounded;
}

/**
 * Interpreta mensajes como:
 *   "12,50 cafe" · "cafe 12,50" · "45€ gasolina ayer" · "+1200 nomina" · "ingreso 1200 nomina"
 * Devuelve null si no encuentra un importe.
 */
export function parseEntry(text: string): ParsedEntry | null {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  let type: EntryType | null = null;
  let daysAgo = 0;
  let amount: number | null = null;
  const note: string[] = [];

  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (EXPENSE_WORDS.has(lower) && amount === null && note.length === 0 && type === null) {
      type = "expense";
    } else if (INCOME_WORDS.has(lower) && amount === null && note.length === 0 && type === null) {
      type = "income";
    } else if (lower in DAY_WORDS) {
      daysAgo = DAY_WORDS[lower] ?? 0;
    } else if (amount === null && AMOUNT_RE.test(token)) {
      const value = parseAmount(token);
      if (value === null) {
        note.push(token);
        continue;
      }
      amount = value;
      if (token.startsWith("+") && type === null) type = "income";
      if (token.startsWith("-") && type === null) type = "expense";
    } else if (amount !== null && CURRENCY_ONLY.has(lower)) {
      // "12,50 €": el simbolo suelto tras el importe no es parte de la nota
    } else {
      note.push(token);
    }
  }

  if (amount === null) return null;
  return { type: type ?? "expense", amount, note: note.join(" "), daysAgo };
}
