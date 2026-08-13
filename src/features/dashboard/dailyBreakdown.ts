import type { Category, Transaction } from "../../types/finance";

export interface DayBreakdown {
	total: number;
	categories: Array<{ categoryId: string; name: string; color: string; total: number }>;
}

export function computeDailyBreakdown(transactions: Transaction[], categoriesById: Map<string, Category>): Map<string, DayBreakdown> {
	const byDate = new Map<string, Map<string, number>>();

	for (const transaction of transactions) {
		if (transaction.type !== "expense") continue;
		const byCategory = byDate.get(transaction.date) ?? new Map<string, number>();
		byCategory.set(transaction.categoryId, (byCategory.get(transaction.categoryId) ?? 0) + transaction.amount);
		byDate.set(transaction.date, byCategory);
	}

	const result = new Map<string, DayBreakdown>();
	for (const [date, byCategory] of byDate) {
		const categories = Array.from(byCategory.entries())
			.map(([categoryId, total]) => ({
				categoryId,
				total,
				name: categoriesById.get(categoryId)?.name ?? "Sin categoría",
				color: categoriesById.get(categoryId)?.color ?? "#6b7280",
			}))
			.sort((a, b) => b.total - a.total);
		const total = categories.reduce((sum, entry) => sum + entry.total, 0);
		result.set(date, { total, categories });
	}

	return result;
}
