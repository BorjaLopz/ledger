import { useMemo, useState } from "react";
import type { Category, Transaction } from "../../types/finance";
import { MONTH_NAMES } from "./dateUtils";

interface YearCalendarViewProps {
	year: number;
	transactions: Transaction[];
	categoriesById: Map<string, Category>;
}

interface MonthSummary {
	total: number;
	categories: Array<{ categoryId: string; name: string; color: string; total: number }>;
}

const currency = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function YearCalendarView({ year, transactions, categoriesById }: YearCalendarViewProps) {
	const summaries = useMemo(() => {
		const byMonthCategory: Array<Map<string, number>> = MONTH_NAMES.map(() => new Map());

		for (const transaction of transactions) {
			if (transaction.type !== "expense" || !transaction.date.startsWith(String(year))) continue;
			const monthIndex = Number(transaction.date.slice(5, 7)) - 1;
			const byCategory = byMonthCategory[monthIndex];
			byCategory.set(transaction.categoryId, (byCategory.get(transaction.categoryId) ?? 0) + transaction.amount);
		}

		return byMonthCategory.map((byCategory): MonthSummary => {
			const categories = Array.from(byCategory.entries())
				.map(([categoryId, total]) => ({
					categoryId,
					total,
					name: categoriesById.get(categoryId)?.name ?? "Sin categoría",
					color: categoriesById.get(categoryId)?.color ?? "#6b7280",
				}))
				.sort((a, b) => b.total - a.total);
			return { total: categories.reduce((sum, entry) => sum + entry.total, 0), categories };
		});
	}, [transactions, categoriesById, year]);

	return (
		<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
			{MONTH_NAMES.map((name, index) => (
				<MonthCard key={name} name={name} summary={summaries[index]} />
			))}
		</div>
	);
}

function MonthCard({ name, summary }: { name: string; summary: MonthSummary }) {
	const [hovered, setHovered] = useState(false);

	return (
		<div
			className="relative rounded-md border border-neutral-800 bg-neutral-900 p-3"
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
		>
			<p className="text-sm text-neutral-300">{name}</p>
			<p className="mt-1 text-lg font-medium tabular-nums text-neutral-100">{currency.format(summary.total)}</p>
			{summary.total > 0 && (
				<div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-neutral-800">
					{summary.categories.map((category) => (
						<span
							key={category.categoryId}
							style={{ width: `${(category.total / summary.total) * 100}%`, backgroundColor: category.color }}
						/>
					))}
				</div>
			)}

			{hovered && summary.total > 0 && (
				<div className="pointer-events-none absolute left-0 top-full z-10 mt-1 w-52 rounded-md border border-neutral-700 bg-neutral-900 p-2 shadow-[0px_8px_20px_rgba(0,0,0,0.4)]">
					<div className="space-y-1">
						{summary.categories.map((category) => (
							<div key={category.categoryId} className="flex items-center justify-between gap-2 text-xs">
								<span className="flex items-center gap-1.5 text-neutral-400">
									<span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: category.color }} />
									{category.name}
								</span>
								<span className="tabular-nums text-neutral-200">{currency.format(category.total)}</span>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
