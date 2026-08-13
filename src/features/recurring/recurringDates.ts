import { addMonths, addWeeks, addYears, format } from "date-fns";
import type { RecurrenceFrequency } from "../../types/finance";

export function advanceDate(date: string, frequency: RecurrenceFrequency): string {
	const [year, month, day] = date.split("-").map(Number);
	const base = new Date(year, month - 1, day);
	const next =
		frequency === "weekly" ? addWeeks(base, 1) : frequency === "monthly" ? addMonths(base, 1) : addYears(base, 1);
	return format(next, "yyyy-MM-dd");
}
