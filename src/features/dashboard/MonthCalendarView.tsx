import { useMemo } from "react";
import type { Category, Transaction } from "../../types/finance";
import { computeDailyBreakdown } from "./dailyBreakdown";
import { DayCell } from "./DayCell";

interface MonthCalendarViewProps {
	year: number;
	month: number;
	transactions: Transaction[];
	categoriesById: Map<string, Category>;
}

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

export function MonthCalendarView({ year, month, transactions, categoriesById }: MonthCalendarViewProps) {
	const breakdown = useMemo(() => computeDailyBreakdown(transactions, categoriesById), [transactions, categoriesById]);

	const daysInMonth = new Date(year, month + 1, 0).getDate();
	const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;

	const cells: Array<{ day: number | null; key: string }> = [];
	for (let i = 0; i < firstWeekday; i++) cells.push({ day: null, key: `empty-${i}` });
	for (let day = 1; day <= daysInMonth; day++) {
		const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
		cells.push({ day, key });
	}

	return (
		<div>
			<div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs text-neutral-500">
				{WEEKDAYS.map((weekday) => (
					<span key={weekday}>{weekday}</span>
				))}
			</div>
			<div className="grid grid-cols-7 gap-1">
				{cells.map((cell) =>
					cell.day === null ? (
						<div key={cell.key} />
					) : (
						<DayCell key={cell.key} day={cell.day} breakdown={breakdown.get(cell.key)} />
					),
				)}
			</div>
		</div>
	);
}
