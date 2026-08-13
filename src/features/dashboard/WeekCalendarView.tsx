import { useMemo, useState } from "react";
import type { Category, Transaction } from "../../types/finance";
import { computeDailyBreakdown } from "./dailyBreakdown";
import { DayCell } from "./DayCell";

interface WeekCalendarViewProps {
	transactions: Transaction[];
	categoriesById: Map<string, Category>;
}

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function startOfWeek(date: Date): Date {
	const offset = (date.getDay() + 6) % 7;
	const result = new Date(date);
	result.setDate(date.getDate() - offset);
	return result;
}

function toKey(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function WeekCalendarView({ transactions, categoriesById }: WeekCalendarViewProps) {
	const [weekOffset, setWeekOffset] = useState(0);
	const breakdown = useMemo(() => computeDailyBreakdown(transactions, categoriesById), [transactions, categoriesById]);

	const base = startOfWeek(new Date());
	base.setDate(base.getDate() + weekOffset * 7);
	const days = Array.from({ length: 7 }, (_, index) => {
		const date = new Date(base);
		date.setDate(base.getDate() + index);
		return date;
	});

	return (
		<div>
			<div className="mb-3 flex items-center justify-between">
				<button
					type="button"
					onClick={() => setWeekOffset((offset) => offset - 1)}
					className="rounded-md border border-neutral-800 px-2 py-1 text-sm hover:bg-neutral-900"
				>
					←
				</button>
				<span className="text-sm tabular-nums">
					{days[0].toLocaleDateString("es-ES", { day: "numeric", month: "short" })} –{" "}
					{days[6].toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
				</span>
				<button
					type="button"
					onClick={() => setWeekOffset((offset) => offset + 1)}
					className="rounded-md border border-neutral-800 px-2 py-1 text-sm hover:bg-neutral-900"
				>
					→
				</button>
			</div>
			<div className="grid grid-cols-7 gap-2">
				{days.map((date, index) => (
					<div key={toKey(date)}>
						<p className="mb-1 text-center text-xs text-neutral-500">{WEEKDAY_LABELS[index]}</p>
						<DayCell day={date.getDate()} breakdown={breakdown.get(toKey(date))} size="lg" />
					</div>
				))}
			</div>
		</div>
	);
}
