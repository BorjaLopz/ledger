import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useConfirm } from "../../store/confirmStore";
import type { NetWorthEntry } from "../../types/finance";
import { NetWorthChart } from "./NetWorthChart";
import { NetWorthForm } from "./NetWorthForm";
import { useDeleteNetWorthEntry, useNetWorthEntries } from "./useNetWorth";

const currency = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const shortFormatter = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" });

function toShortLabel(dateString: string) {
	const [year, month, day] = dateString.split("-").map(Number);
	return shortFormatter.format(new Date(year, month - 1, day));
}

function formatPct(pct: number): string {
	return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

export function NetWorthPage() {
	const { data: entries, isLoading } = useNetWorthEntries();
	const deleteEntry = useDeleteNetWorthEntry();
	const confirm = useConfirm();
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [editingEntry, setEditingEntry] = useState<NetWorthEntry | null>(null);

	const chartData = (entries ?? []).map((entry) => ({ date: toShortLabel(entry.date), total: entry.total }));
	const latest = entries && entries.length > 0 ? entries[entries.length - 1] : null;
	const first = entries && entries.length > 0 ? entries[0] : null;
	const change = latest && first ? latest.total - first.total : 0;
	const changePct = latest && first && first.total !== 0 ? ((latest.total - first.total) / Math.abs(first.total)) * 100 : null;

	const entriesWithChange = (entries ?? []).map((entry, index, arr) => {
		const previous = index > 0 ? arr[index - 1] : null;
		const pct = previous && previous.total !== 0 ? ((entry.total - previous.total) / Math.abs(previous.total)) * 100 : null;
		return { entry, pct };
	});

	async function handleDelete(id: string) {
		if (await confirm("¿Seguro que quieres borrar este registro de patrimonio?")) {
			deleteEntry.mutate(id);
		}
	}

	return (
		<div className="h-full overflow-y-auto p-8">
			<h1 className="mb-6 text-xl font-medium">Patrimonio</h1>

			{isLoading ? (
				<p className="text-sm text-neutral-600">Cargando...</p>
			) : (
				<div className="space-y-8">
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
							<p className="text-sm text-neutral-500">Patrimonio actual</p>
							<p className="mt-1 text-2xl font-medium tabular-nums text-neutral-100">
								{latest ? currency.format(latest.total) : "—"}
							</p>
						</div>
						<div className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
							<p className="text-sm text-neutral-500">Variación total</p>
							<p className={`mt-1 text-2xl font-medium tabular-nums ${change >= 0 ? "text-green-400" : "text-red-400"}`}>
								{change >= 0 ? "+" : ""}
								{currency.format(change)}
								{changePct !== null && (
									<span className="ml-2 text-base font-normal text-neutral-500">({formatPct(changePct)})</span>
								)}
							</p>
						</div>
					</div>

					<div className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
						<h2 className="mb-3 text-sm font-medium text-neutral-400">Progresión</h2>
						<NetWorthChart data={chartData} />
					</div>

					<div className="grid gap-8 md:grid-cols-[1fr_320px]">
						<div className="space-y-2">
							{entriesWithChange.length === 0 ? (
								<p className="text-sm text-neutral-600">Sin registros todavía.</p>
							) : (
								[...entriesWithChange].reverse().map(({ entry, pct }) => (
									<div key={entry.id} className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2">
										<div className="flex items-center justify-between">
											<button
												type="button"
												onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
												className="flex flex-1 items-center gap-2 text-left text-sm"
											>
												{expandedId === entry.id ? (
													<ChevronUp className="h-4 w-4 text-neutral-500" />
												) : (
													<ChevronDown className="h-4 w-4 text-neutral-500" />
												)}
												{entry.date}
											</button>
											<div className="flex items-center gap-3">
												{pct !== null && (
													<span className={`text-xs tabular-nums ${pct >= 0 ? "text-green-400" : "text-red-400"}`}>
														{formatPct(pct)}
													</span>
												)}
												<span className="text-sm font-medium tabular-nums text-neutral-100">
													{currency.format(entry.total)}
												</span>
												<button
													type="button"
													onClick={() => setEditingEntry(entry)}
													className="text-neutral-600 hover:text-neutral-300"
												>
													<Pencil className="h-4 w-4" />
												</button>
												<button
													type="button"
													onClick={() => handleDelete(entry.id)}
													className="text-neutral-600 hover:text-red-400"
												>
													<Trash2 className="h-4 w-4" />
												</button>
											</div>
										</div>
										{expandedId === entry.id && (
											<div className="mt-2 space-y-1 border-t border-neutral-800 pt-2">
												{entry.items.map((item, index) => (
													<div key={`${entry.id}-${index}`} className="flex items-center justify-between text-xs">
														<span className="text-neutral-400">{item.name}</span>
														<span className="tabular-nums text-neutral-300">{currency.format(item.amount)}</span>
													</div>
												))}
											</div>
										)}
									</div>
								))
							)}
						</div>
						<NetWorthForm latestEntry={latest} editingEntry={editingEntry} onDone={() => setEditingEntry(null)} />
					</div>
				</div>
			)}
		</div>
	);
}
