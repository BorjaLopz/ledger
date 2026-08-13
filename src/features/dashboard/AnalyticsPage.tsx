import { useMemo, useState } from "react";
import { useCategories } from "../categories/useCategories";
import { useTransactions } from "../transactions/useTransactions";
import { AnnualBarChart } from "./AnnualBarChart";
import { CategoryBreakdownChart } from "./CategoryBreakdownChart";
import { CategoryPieChart } from "./CategoryPieChart";
import { MonthCalendarView } from "./MonthCalendarView";
import { SegmentedControl } from "./SegmentedControl";
import { StatTile } from "./StatTile";
import { WeekCalendarView } from "./WeekCalendarView";
import { YearCalendarView } from "./YearCalendarView";
import { monthLabel } from "./dateUtils";
import { useAnnualDashboard } from "./useAnnualDashboard";
import { useMonthlyDashboard } from "./useMonthlyDashboard";

type Period = "month" | "year" | "calendar";
type ChartType = "bar" | "pie";
type CalendarView = "month" | "week" | "year";

const currency = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

export function AnalyticsPage() {
	const [period, setPeriod] = useState<Period>("month");
	const [chartType, setChartType] = useState<ChartType>("bar");
	const [calendarView, setCalendarView] = useState<CalendarView>("month");

	const monthly = useMonthlyDashboard();
	const annual = useAnnualDashboard();
	const { data: allTransactions } = useTransactions();
	const { data: categories } = useCategories();

	const categoriesById = useMemo(() => new Map((categories ?? []).map((category) => [category.id, category])), [categories]);

	const isLoading = period === "year" ? annual.isLoading : monthly.isLoading;
	const showsYearNav = period === "year" || (period === "calendar" && calendarView === "year");
	const showsMonthNav = period === "month" || (period === "calendar" && calendarView === "month");

	return (
		<div className="h-full overflow-y-auto p-8">
			<div className="mb-6 flex flex-wrap items-center justify-between gap-4">
				<h1 className="text-xl font-medium">Dashboard</h1>
				<SegmentedControl
					value={period}
					onChange={setPeriod}
					options={[
						{ value: "month", label: "Mes" },
						{ value: "year", label: "Año" },
						{ value: "calendar", label: "Calendario" },
					]}
				/>
			</div>

			{period === "calendar" && (
				<div className="mb-6">
					<SegmentedControl
						value={calendarView}
						onChange={setCalendarView}
						options={[
							{ value: "month", label: "Mes" },
							{ value: "week", label: "Semana" },
							{ value: "year", label: "Año" },
						]}
					/>
				</div>
			)}

			<div className="mb-6 flex flex-wrap items-center justify-between gap-4">
				<div className="flex items-center gap-3">
					{showsYearNav ? (
						<>
							<button
								type="button"
								onClick={() => annual.setYear((y) => y - 1)}
								className="rounded-md border border-neutral-800 px-2 py-1 text-sm hover:bg-neutral-900"
							>
								←
							</button>
							<span className="text-sm tabular-nums">{annual.year}</span>
							<button
								type="button"
								onClick={() => annual.setYear((y) => y + 1)}
								className="rounded-md border border-neutral-800 px-2 py-1 text-sm hover:bg-neutral-900"
							>
								→
							</button>
						</>
					) : showsMonthNav ? (
						<>
							<button
								type="button"
								onClick={monthly.goToPreviousMonth}
								className="rounded-md border border-neutral-800 px-2 py-1 text-sm hover:bg-neutral-900"
							>
								←
							</button>
							<span className="w-32 text-center text-sm capitalize tabular-nums">{monthLabel(monthly.year, monthly.month)}</span>
							<button
								type="button"
								onClick={monthly.goToNextMonth}
								className="rounded-md border border-neutral-800 px-2 py-1 text-sm hover:bg-neutral-900"
							>
								→
							</button>
						</>
					) : null}
				</div>

				{period !== "calendar" && (
					<SegmentedControl
						value={chartType}
						onChange={setChartType}
						options={[
							{ value: "bar", label: "Barras" },
							{ value: "pie", label: "Tarta" },
						]}
					/>
				)}
			</div>

			{isLoading ? (
				<p className="text-sm text-neutral-600">Cargando...</p>
			) : (
				<>
					{period !== "calendar" && (
						<div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
							{period === "year" ? (
								<>
									<StatTile label="Ingresos" value={currency.format(annual.totals.income)} tone="good" />
									<StatTile label="Gastos" value={currency.format(annual.totals.expense)} tone="bad" />
									<StatTile
										label="Balance"
										value={currency.format(annual.totals.balance)}
										tone={annual.totals.balance >= 0 ? "good" : "bad"}
									/>
									<StatTile
										label="Ahorro"
										value={annual.totals.income > 0 ? `${Math.round((annual.totals.balance / annual.totals.income) * 100)}%` : "—"}
										tone={annual.totals.balance >= 0 ? "good" : "bad"}
									/>
								</>
							) : (
								<>
									<StatTile label="Ingresos" value={currency.format(monthly.totals.income)} tone="good" />
									<StatTile label="Gastos" value={currency.format(monthly.totals.expense)} tone="bad" />
									<StatTile
										label="Balance"
										value={currency.format(monthly.totals.balance)}
										tone={monthly.totals.balance >= 0 ? "good" : "bad"}
									/>
									<StatTile
										label="Ahorro"
										value={
											monthly.totals.income > 0 ? `${Math.round((monthly.totals.balance / monthly.totals.income) * 100)}%` : "—"
										}
										tone={monthly.totals.balance >= 0 ? "good" : "bad"}
									/>
								</>
							)}
						</div>
					)}

					<div className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
						{period === "calendar" && calendarView === "month" && (
							<MonthCalendarView
								year={monthly.year}
								month={monthly.month}
								transactions={allTransactions ?? []}
								categoriesById={categoriesById}
							/>
						)}
						{period === "calendar" && calendarView === "week" && (
							<WeekCalendarView transactions={allTransactions ?? []} categoriesById={categoriesById} />
						)}
						{period === "calendar" && calendarView === "year" && (
							<YearCalendarView year={annual.year} transactions={allTransactions ?? []} categoriesById={categoriesById} />
						)}
						{period === "month" && chartType === "bar" && <CategoryBreakdownChart data={monthly.categoryBreakdown} />}
						{period === "month" && chartType === "pie" && <CategoryPieChart data={monthly.categoryBreakdown} />}
						{period === "year" && chartType === "bar" && <AnnualBarChart data={annual.data} />}
						{period === "year" && chartType === "pie" && <CategoryPieChart data={annual.categoryBreakdown} />}
					</div>
				</>
			)}
		</div>
	);
}
