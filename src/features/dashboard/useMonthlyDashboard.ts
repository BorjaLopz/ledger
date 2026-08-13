import { useMemo, useState } from "react";
import { useCategories } from "../categories/useCategories";
import { useTransactions } from "../transactions/useTransactions";
import { monthKey } from "./dateUtils";

export function useMonthlyDashboard() {
	const now = new Date();
	const [year, setYear] = useState(now.getFullYear());
	const [month, setMonth] = useState(now.getMonth());

	const { data: transactions, isLoading: loadingTransactions } = useTransactions();
	const { data: categories, isLoading: loadingCategories } = useCategories();

	const key = monthKey(year, month);

	const monthTransactions = useMemo(
		() => (transactions ?? []).filter((transaction) => transaction.date.startsWith(key)),
		[transactions, key],
	);

	const totals = useMemo(() => {
		let income = 0;
		let expense = 0;
		for (const transaction of monthTransactions) {
			if (transaction.type === "income") income += transaction.amount;
			else expense += transaction.amount;
		}
		return { income, expense, balance: income - expense };
	}, [monthTransactions]);

	const categoriesById = useMemo(() => new Map((categories ?? []).map((category) => [category.id, category])), [categories]);

	const categoryBreakdown = useMemo(() => {
		const totalsByCategory = new Map<string, number>();
		for (const transaction of monthTransactions) {
			if (transaction.type !== "expense") continue;
			totalsByCategory.set(transaction.categoryId, (totalsByCategory.get(transaction.categoryId) ?? 0) + transaction.amount);
		}
		return Array.from(totalsByCategory.entries())
			.map(([categoryId, total]) => ({
				categoryId,
				total,
				name: categoriesById.get(categoryId)?.name ?? "Sin categoría",
			}))
			.sort((a, b) => b.total - a.total);
	}, [monthTransactions, categoriesById]);

	function goToPreviousMonth() {
		if (month === 0) {
			setYear((y) => y - 1);
			setMonth(11);
		} else {
			setMonth((m) => m - 1);
		}
	}

	function goToNextMonth() {
		if (month === 11) {
			setYear((y) => y + 1);
			setMonth(0);
		} else {
			setMonth((m) => m + 1);
		}
	}

	return {
		year,
		month,
		goToPreviousMonth,
		goToNextMonth,
		totals,
		categoryBreakdown,
		monthTransactions,
		categoriesById,
		isLoading: loadingTransactions || loadingCategories,
	};
}
