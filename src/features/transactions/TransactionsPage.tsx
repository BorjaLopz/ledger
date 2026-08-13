import { AnimatePresence } from "framer-motion";
import { Image, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useConfirm } from "../../store/confirmStore";
import type { Transaction, TransactionType } from "../../types/finance";
import { CategoryIcon } from "../categories/CategoryIcon";
import { useCategories } from "../categories/useCategories";
import { TransactionDetailModal } from "./TransactionDetailModal";
import { TransactionForm } from "./TransactionForm";
import { useDeleteTransaction, useDeleteTransactions, useTransactions } from "./useTransactions";

const currency = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

type TypeFilter = "all" | TransactionType;

function normalize(text: string): string {
	return text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();
}

export function TransactionsPage() {
	const { data: transactions, isLoading } = useTransactions();
	const { data: categories } = useCategories();
	const deleteTransaction = useDeleteTransaction();
	const deleteTransactions = useDeleteTransactions();
	const confirm = useConfirm();
	const [selected, setSelected] = useState<Transaction | null>(null);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

	const [search, setSearch] = useState("");
	const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
	const [categoryFilter, setCategoryFilter] = useState("all");
	const [dateFrom, setDateFrom] = useState("");
	const [dateTo, setDateTo] = useState("");

	const categoriesById = useMemo(() => new Map((categories ?? []).map((category) => [category.id, category])), [categories]);

	const filteredTransactions = useMemo(() => {
		const query = normalize(search.trim());
		return (transactions ?? []).filter((transaction) => {
			if (typeFilter !== "all" && transaction.type !== typeFilter) return false;
			if (categoryFilter !== "all" && transaction.categoryId !== categoryFilter) return false;
			if (dateFrom && transaction.date < dateFrom) return false;
			if (dateTo && transaction.date > dateTo) return false;
			if (query) {
				const categoryName = normalize(categoriesById.get(transaction.categoryId)?.name ?? "");
				const matchesNote = normalize(transaction.note).includes(query);
				const matchesCategory = categoryName.includes(query);
				if (!matchesNote && !matchesCategory) return false;
			}
			return true;
		});
	}, [transactions, typeFilter, categoryFilter, dateFrom, dateTo, search, categoriesById]);

	const hasActiveFilters = Boolean(search || typeFilter !== "all" || categoryFilter !== "all" || dateFrom || dateTo);

	function clearFilters() {
		setSearch("");
		setTypeFilter("all");
		setCategoryFilter("all");
		setDateFrom("");
		setDateTo("");
	}

	function toggleSelected(id: string) {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	async function handleBulkDelete() {
		const toDelete = filteredTransactions.filter((transaction) => selectedIds.has(transaction.id));
		if (toDelete.length === 0) return;
		if (await confirm(`¿Seguro que quieres borrar ${toDelete.length} transacción${toDelete.length > 1 ? "es" : ""}?`)) {
			deleteTransactions.mutate(toDelete);
			setSelectedIds(new Set());
		}
	}

	return (
		<div className="flex h-full flex-col p-8">
			<div className="mb-4 flex shrink-0 items-center justify-between">
				<h1 className="text-xl font-medium">Transacciones</h1>
				{selectedIds.size > 0 && (
					<div className="flex items-center gap-3">
						<span className="text-sm text-neutral-400">
							{selectedIds.size} seleccionada{selectedIds.size > 1 ? "s" : ""}
						</span>
						<button
							type="button"
							onClick={() => setSelectedIds(new Set())}
							className="text-sm text-neutral-400 hover:text-neutral-100"
						>
							Cancelar
						</button>
						<button
							type="button"
							onClick={handleBulkDelete}
							className="rounded-md border border-red-900 bg-red-950/40 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950"
						>
							Borrar seleccionadas
						</button>
					</div>
				)}
			</div>

			<div className="grid min-h-0 flex-1 gap-8 md:grid-cols-[1fr_320px]">
				<div className="flex min-h-0 flex-col">
					<div className="relative mb-4 flex shrink-0 flex-wrap items-end gap-3 rounded-md border border-neutral-800 bg-neutral-900 p-3 pt-6">
						<div className="min-w-[160px] flex-1">
							<label htmlFor="filter-search" className="mb-1 block text-xs text-neutral-500">
								Buscar
							</label>
							<input
								id="filter-search"
								type="text"
								placeholder="Nota o categoría..."
								value={search}
								onChange={(event) => setSearch(event.target.value)}
								className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-sm outline-none focus:border-neutral-600"
							/>
						</div>
						<div>
							<label htmlFor="filter-type" className="mb-1 block text-xs text-neutral-500">
								Tipo
							</label>
							<select
								id="filter-type"
								value={typeFilter}
								onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
								className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-sm outline-none focus:border-neutral-600"
							>
								<option value="all">Todos</option>
								<option value="expense">Gasto</option>
								<option value="income">Ingreso</option>
							</select>
						</div>
						<div>
							<label htmlFor="filter-category" className="mb-1 block text-xs text-neutral-500">
								Categoría
							</label>
							<select
								id="filter-category"
								value={categoryFilter}
								onChange={(event) => setCategoryFilter(event.target.value)}
								className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-sm outline-none focus:border-neutral-600"
							>
								<option value="all">Todas</option>
								{categories?.map((category) => (
									<option key={category.id} value={category.id}>
										{category.name}
									</option>
								))}
							</select>
						</div>
						<div>
							<label htmlFor="filter-from" className="mb-1 block text-xs text-neutral-500">
								Desde
							</label>
							<input
								id="filter-from"
								type="date"
								value={dateFrom}
								onChange={(event) => setDateFrom(event.target.value)}
								className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-sm outline-none focus:border-neutral-600"
							/>
						</div>
						<div>
							<label htmlFor="filter-to" className="mb-1 block text-xs text-neutral-500">
								Hasta
							</label>
							<input
								id="filter-to"
								type="date"
								value={dateTo}
								onChange={(event) => setDateTo(event.target.value)}
								className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-sm outline-none focus:border-neutral-600"
							/>
						</div>
						{hasActiveFilters && (
							<button
								type="button"
								onClick={clearFilters}
								className="absolute right-2 top-2 flex items-center gap-1 text-xs font-medium text-red-400 hover:text-red-300"
							>
								<X className="h-3 w-3" /> Limpiar filtros
							</button>
						)}
					</div>

					<div className="min-h-0 flex-1 overflow-y-auto pr-2">
						{isLoading ? (
							<p className="text-sm text-neutral-600">Cargando...</p>
						) : filteredTransactions.length === 0 ? (
							<p className="text-sm text-neutral-600">
								{hasActiveFilters ? "Sin resultados para estos filtros." : "Sin transacciones todavía."}
							</p>
						) : (
							<div className="space-y-2">
								<label className="flex items-center gap-2 px-1 pb-1 text-xs text-neutral-500">
									<input
										type="checkbox"
										checked={selectedIds.size > 0 && selectedIds.size === filteredTransactions.length}
										onChange={(event) => {
											if (event.target.checked) setSelectedIds(new Set(filteredTransactions.map((t) => t.id)));
											else setSelectedIds(new Set());
										}}
										className="h-4 w-4 accent-neutral-100"
									/>
									Seleccionar todo
								</label>

								{filteredTransactions.map((transaction) => {
									const category = categoriesById.get(transaction.categoryId);
									return (
										<div
											key={transaction.id}
											role="button"
											tabIndex={0}
											onClick={() => setSelected(transaction)}
											onKeyDown={(event) => {
												if (event.key === "Enter" || event.key === " ") setSelected(transaction);
											}}
											className="flex cursor-pointer items-center justify-between rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 hover:border-neutral-700"
										>
											<div className="flex items-center gap-3">
												<input
													type="checkbox"
													checked={selectedIds.has(transaction.id)}
													onChange={() => toggleSelected(transaction.id)}
													onClick={(event) => event.stopPropagation()}
													className="h-4 w-4 shrink-0 accent-neutral-100"
												/>
												{category && <CategoryIcon icon={category.icon} color={category.color} className="h-4 w-4" />}
												<div>
													<p className="text-sm">{category?.name ?? "Sin categoría"}</p>
													<p className="text-xs text-neutral-500">
														{transaction.date}
														{transaction.note ? ` · ${transaction.note}` : ""}
													</p>
												</div>
											</div>
											<div className="flex items-center gap-3">
												<span
													className={`text-sm font-medium ${transaction.type === "income" ? "text-green-400" : "text-red-400"}`}
												>
													{transaction.type === "income" ? "+" : "-"}
													{currency.format(transaction.amount)}
												</span>
												{transaction.receiptUrl && (
													<a
														href={transaction.receiptUrl}
														target="_blank"
														rel="noreferrer"
														onClick={(event) => event.stopPropagation()}
														className="text-neutral-600 hover:text-neutral-300"
													>
														<Image className="h-4 w-4" />
													</a>
												)}
												<button
													type="button"
													onClick={async (event) => {
														event.stopPropagation();
														if (await confirm("¿Seguro que quieres borrar esta transacción?")) {
															deleteTransaction.mutate(transaction);
														}
													}}
													className="text-neutral-600 hover:text-red-400"
												>
													<Trash2 className="h-4 w-4" />
												</button>
											</div>
										</div>
									);
								})}
							</div>
						)}
					</div>
				</div>

				<div className="overflow-y-auto pr-1">
					<TransactionForm />
				</div>
			</div>

			<AnimatePresence>
				{selected && <TransactionDetailModal key={selected.id} transaction={selected} onClose={() => setSelected(null)} />}
			</AnimatePresence>
		</div>
	);
}
