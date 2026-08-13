import { useMemo, useState } from "react";
import { useCategories } from "../categories/useCategories";
import { useTransactions } from "../transactions/useTransactions";
import { MONTH_NAMES } from "./dateUtils";

export function useAnnualDashboard() {
	const [year, setYear] = useState(new Date().getFullYear());
	const { data: transactions, isLoading: loadingTransactions } = useTransactions();
	const { data: categories, isLoading: loadingCategories } = useCategories();

	const yearTransactions = useMemo(
		() => (transactions ?? []).filter((transaction) => transaction.date.startsWith(String(year))),
		[transactions, year],
	);

	const data = useMemo(() => {
		const months = MONTH_NAMES.map((name) => ({ month: name.slice(0, 3), income: 0, expense: 0 }));
		for (const transaction of yearTransactions) {
			const monthIndex = Number(transaction.date.slice(5, 7)) - 1;
			if (transaction.type === "income") months[monthIndex].income += transaction.amount;
			else months[monthIndex].expense += transaction.amount;
		}
		return months;
	}, [yearTransactions]);

	const totals = useMemo(() => {
		const income = data.reduce((sum, entry) => sum + entry.income, 0);
		const expense = data.reduce((sum, entry) => sum + entry.expense, 0);
		return { income, expense, balance: income - expense };
	}, [data]);

	const categoriesById = useMemo(() => new Map((categories ?? []).map((category) => [category.id, category])), [categories]);

	const categoryBreakdown = useMemo(() => {
		const totalsByCategory = new Map<string, number>();
		for (const transaction of yearTransactions) {
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
	}, [yearTransactions, categoriesById]);

	return {
		year,
		setYear,
		data,
		totals,
		categoryBreakdown,
		isLoading: loadingTransactions || loadingCategories,
	};
}
