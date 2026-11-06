const pad = (n: number): string => String(n).padStart(2, "0");

function valid(y: number, m: number, d: number): boolean {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** "2026-11-06" -> "06/11/2026" */
export const longDate = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/**
 * Entiende "hoy", "ayer", "anteayer", "15/03/2025", "15-3-25", "15/03" (año actual, o el anterior si
 * saldria en el futuro) y "2025-03-15". Devuelve YYYY-MM-DD, o null si no es una fecha real ni futura.
 */
export function parseDate(text: string, today: string): string | null {
  const t = text.trim().toLowerCase();
  if (t === "hoy") return today;
  if (t === "ayer") return addDays(today, -1);
  if (t === "anteayer" || t === "antes de ayer") return addDays(today, -2);

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  const es = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/.exec(t);
  let y: number, m: number, d: number;
  if (iso) {
    [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])] as [number, number, number];
  } else if (es) {
    d = Number(es[1]);
    m = Number(es[2]);
    const year = es[3];
    y = year ? (year.length === 2 ? 2000 + Number(year) : Number(year)) : Number(today.slice(0, 4));
    if (!year && valid(y, m, d) && `${y}-${pad(m)}-${pad(d)}` > today) y -= 1;
  } else {
    return null;
  }
  if (!valid(y, m, d)) return null;
  const result = `${y}-${pad(m)}-${pad(d)}`;
  return result > today ? null : result;
}

/**
 * Fecha futura o de hoy: "hoy", "mañana", "15/12/2026", "15/12" (proxima vez que ocurra) o "2026-12-15".
 * null si no es una fecha real o ya paso.
 */
export function parseUpcoming(text: string, today: string): string | null {
  const t = text.trim().toLowerCase();
  if (t === "hoy") return today;
  if (t === "mañana" || t === "manana") return addDays(today, 1);

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  const es = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/.exec(t);
  let y: number, m: number, d: number;
  if (iso) {
    [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])] as [number, number, number];
  } else if (es) {
    d = Number(es[1]);
    m = Number(es[2]);
    const year = es[3];
    y = year ? (year.length === 2 ? 2000 + Number(year) : Number(year)) : Number(today.slice(0, 4));
    if (!year && valid(y, m, d) && `${y}-${pad(m)}-${pad(d)}` < today) y += 1;
  } else {
    return null;
  }
  if (!valid(y, m, d)) return null;
  const result = `${y}-${pad(m)}-${pad(d)}`;
  return result < today ? null : result;
}
