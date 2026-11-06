export type PeriodArg = { kind: "current" } | { kind: "month"; month: string } | { kind: "year"; year: string };

/** "" -> mes actual, "2026-10" -> ese mes, "2026" -> ese año. null si no es valido. */
export function parsePeriod(arg: string): PeriodArg | null {
  const a = arg.trim();
  if (!a) return { kind: "current" };
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(a)) return { kind: "month", month: a };
  if (/^\d{4}$/.test(a)) return { kind: "year", year: a };
  return null;
}
