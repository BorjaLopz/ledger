import { useAuthStore } from "../../store/authStore";
import { CategoryIcon } from "../categories/CategoryIcon";
import { CategoryBreakdownChart } from "./CategoryBreakdownChart";
import { StatTile } from "./StatTile";
import { monthLabel } from "./dateUtils";
import { useMonthlyDashboard } from "./useMonthlyDashboard";

const currency = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

export function ResumenPage() {
	const user = useAuthStore((state) => state.user);
	const { year, month, totals, categoryBreakdown, monthTransactions, categoriesById, isLoading } = useMonthlyDashboard();

	return (
		<div className="h-full overflow-y-auto p-8">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="text-xl font-medium">Hola, {user?.displayName ?? user?.email}</h1>
				<span className="text-sm capitalize tabular-nums text-neutral-400">{monthLabel(year, month)}</span>
			</div>

			{isLoading ? (
				<p className="text-sm text-neutral-600">Cargando...</p>
			) : (
				<>
					<div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
						<StatTile label="Ingresos" value={currency.format(totals.income)} tone="good" />
						<StatTile label="Gastos" value={currency.format(totals.expense)} tone="bad" />
						<StatTile label="Balance" value={currency.format(totals.balance)} tone={totals.balance >= 0 ? "good" : "bad"} />
						<StatTile
							label="Ahorro"
							value={totals.income > 0 ? `${Math.round((totals.balance / totals.income) * 100)}%` : "—"}
							tone={totals.balance >= 0 ? "good" : "bad"}
						/>
					</div>

					<div className="grid gap-8 lg:grid-cols-2">
						<div className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
							<h2 className="mb-3 text-sm font-medium text-neutral-400">Gasto por categoría</h2>
							<CategoryBreakdownChart data={categoryBreakdown} />
						</div>

						<div>
							<h2 className="mb-3 text-sm font-medium text-neutral-400">Últimas transacciones</h2>
							<div className="space-y-2">
								{monthTransactions.length === 0 ? (
									<p className="text-sm text-neutral-600">Sin transacciones este mes.</p>
								) : (
									monthTransactions.slice(0, 8).map((transaction) => {
										const category = categoriesById.get(transaction.categoryId);
										return (
											<div
												key={transaction.id}
												className="flex items-center justify-between rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2"
											>
												<div className="flex items-center gap-3">
													{category && <CategoryIcon icon={category.icon} color={category.color} className="h-4 w-4" />}
													<span className="text-sm">{category?.name ?? "Sin categoría"}</span>
												</div>
												<span
													className={`text-sm font-medium ${transaction.type === "income" ? "text-green-400" : "text-red-400"}`}
												>
													{transaction.type === "income" ? "+" : "-"}
													{currency.format(transaction.amount)}
												</span>
											</div>
										);
									})
								)}
							</div>
						</div>
					</div>
				</>
			)}
		</div>
	);
}
