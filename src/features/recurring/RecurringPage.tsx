import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import type { RecurringPayment } from "../../types/finance";
import { useConfirm } from "../../store/confirmStore";
import { CategoryIcon } from "../categories/CategoryIcon";
import { useCategories } from "../categories/useCategories";
import { RecurringForm } from "./RecurringForm";
import { useDeleteRecurring, useRecurring, useToggleRecurring } from "./useRecurring";

const currency = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

const FREQUENCY_LABELS: Record<string, string> = {
	weekly: "Semanal",
	monthly: "Mensual",
	yearly: "Anual",
};

export function RecurringPage() {
	const { data: recurring, isLoading } = useRecurring();
	const { data: categories } = useCategories();
	const toggleRecurring = useToggleRecurring();
	const deleteRecurring = useDeleteRecurring();
	const confirm = useConfirm();
	const [editingEntry, setEditingEntry] = useState<RecurringPayment | null>(null);

	const categoriesById = new Map((categories ?? []).map((category) => [category.id, category]));

	async function handleDelete(entry: RecurringPayment) {
		if (await confirm(`¿Seguro que quieres borrar "${entry.note || "este recurrente"}"?`)) {
			deleteRecurring.mutate(entry.id);
		}
	}

	return (
		<div className="h-full overflow-y-auto overflow-x-hidden p-4 sm:p-8">
			<h1 className="mb-6 text-xl font-medium">Recurrentes</h1>

			<div className="grid gap-8 md:grid-cols-[1fr_320px]">
				<div className="order-2 space-y-2 md:order-1">
					{isLoading ? (
						<p className="text-sm text-neutral-600">Cargando...</p>
					) : recurring?.length === 0 ? (
						<p className="text-sm text-neutral-600">Sin recurrentes todavía.</p>
					) : (
						recurring?.map((entry) => {
							const category = categoriesById.get(entry.categoryId);
							return (
								<div
									key={entry.id}
									className={`flex flex-wrap items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 ${
										entry.active ? "" : "opacity-50"
									}`}
								>
									<div className="flex min-w-0 flex-1 items-center gap-3">
										{category && (
											<CategoryIcon icon={category.icon} color={category.color} className="h-4 w-4 shrink-0" />
										)}
										<div className="min-w-0">
											<p className="truncate text-sm">{entry.note || category?.name || "Sin nombre"}</p>
											<p className="truncate text-xs text-neutral-500">
												{FREQUENCY_LABELS[entry.frequency]} · próxima: {entry.nextDate}
											</p>
										</div>
									</div>
									<div className="ml-auto flex shrink-0 items-center gap-3">
										<span
											className={`text-sm font-medium ${entry.type === "income" ? "text-green-400" : "text-red-400"}`}
										>
											{entry.type === "income" ? "+" : "-"}
											{currency.format(entry.amount)}
										</span>
										<label className="flex items-center gap-1 text-xs text-neutral-500">
											<input
												type="checkbox"
												checked={entry.active}
												onChange={(event) => toggleRecurring.mutate({ id: entry.id, active: event.target.checked })}
											/>
											activo
										</label>
										<button
											type="button"
											onClick={() => setEditingEntry(entry)}
											className="text-neutral-600 hover:text-neutral-300"
										>
											<Pencil className="h-4 w-4" />
										</button>
										<button type="button" onClick={() => handleDelete(entry)} className="text-neutral-600 hover:text-red-400">
											<Trash2 className="h-4 w-4" />
										</button>
									</div>
								</div>
							);
						})
					)}
				</div>

				<div className="order-1 md:order-2">
					<RecurringForm editingEntry={editingEntry} onDone={() => setEditingEntry(null)} />
				</div>
			</div>
		</div>
	);
}
