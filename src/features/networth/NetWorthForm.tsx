import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import type { NetWorthEntry } from "../../types/finance";
import { useCreateNetWorthEntry, useUpdateNetWorthEntry } from "./useNetWorth";

const itemSchema = z.object({
	name: z.string().min(1, "Nombre requerido"),
	amount: z.coerce.number(),
});

const entrySchema = z.object({
	date: z.string().min(1, "Fecha requerida"),
	items: z.array(itemSchema).min(1, "Añade al menos un elemento"),
});

type EntryFormInput = z.input<typeof entrySchema>;
type EntryFormValues = z.output<typeof entrySchema>;

const currency = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

function today() {
	return new Date().toISOString().slice(0, 10);
}

function cloneItems(items: Array<{ name: string; amount: number }>) {
	return items.length > 0 ? items.map((item) => ({ name: item.name, amount: item.amount })) : [{ name: "", amount: 0 }];
}

interface NetWorthFormProps {
	latestEntry?: NetWorthEntry | null;
	editingEntry?: NetWorthEntry | null;
	onDone?: () => void;
}

export function NetWorthForm({ latestEntry, editingEntry, onDone }: NetWorthFormProps) {
	const createEntry = useCreateNetWorthEntry();
	const updateEntry = useUpdateNetWorthEntry();
	const {
		register,
		control,
		handleSubmit,
		watch,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<EntryFormInput, unknown, EntryFormValues>({
		resolver: zodResolver(entrySchema),
		defaultValues: {
			date: editingEntry?.date ?? today(),
			items: cloneItems(editingEntry?.items ?? latestEntry?.items ?? []),
		},
	});
	const { fields, append, remove } = useFieldArray({ control, name: "items" });

	useEffect(() => {
		if (editingEntry) {
			reset({ date: editingEntry.date, items: cloneItems(editingEntry.items) });
		} else {
			reset({ date: today(), items: cloneItems(latestEntry?.items ?? []) });
		}
	}, [editingEntry, latestEntry, reset]);

	const watchedItems = watch("items");
	const total = (watchedItems ?? []).reduce((sum, item) => sum + (Number(item?.amount) || 0), 0);

	async function onSubmit(values: EntryFormValues) {
		const total = values.items.reduce((sum, item) => sum + item.amount, 0);
		if (editingEntry) {
			await updateEntry.mutateAsync({ id: editingEntry.id, data: { date: values.date, items: values.items, total } });
			onDone?.();
			return;
		}
		await createEntry.mutateAsync({ date: values.date, items: values.items, total });
		reset({ date: today(), items: values.items });
	}

	return (
		<form
			onSubmit={handleSubmit(onSubmit)}
			className="space-y-4 rounded-md border border-neutral-800 bg-neutral-900 p-4"
		>
			{editingEntry ? (
				<p className="text-xs text-neutral-500">Editando el registro del {editingEntry.date}.</p>
			) : (
				latestEntry && (
					<p className="text-xs text-neutral-500">
						Partiendo de tu registro del {latestEntry.date}. Ajusta lo que haya cambiado.
					</p>
				)
			)}

			<div>
				<label htmlFor="nw-date" className="mb-1 block text-sm text-neutral-400">
					Fecha
				</label>
				<input
					id="nw-date"
					type="date"
					className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-600"
					{...register("date")}
				/>
			</div>

			<div className="space-y-2">
				<span className="block text-sm text-neutral-400">Activos y deudas (deudas en negativo)</span>
				{fields.map((field, index) => (
					<div key={field.id} className="flex gap-2">
						<input
							type="text"
							placeholder="Cuenta, inversión, hipoteca..."
							className="min-w-0 flex-1 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-600"
							{...register(`items.${index}.name` as const)}
						/>
						<input
							type="number"
							step="0.01"
							placeholder="0"
							className="w-28 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-600"
							{...register(`items.${index}.amount` as const)}
						/>
						<button type="button" onClick={() => remove(index)} className="text-neutral-600 hover:text-red-400">
							<Trash2 className="h-4 w-4" />
						</button>
					</div>
				))}
				{errors.items && <p className="text-xs text-red-400">{errors.items.message}</p>}
				<button
					type="button"
					onClick={() => append({ name: "", amount: 0 })}
					className="flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-100"
				>
					<Plus className="h-4 w-4" /> Añadir elemento
				</button>
			</div>

			<div className="flex items-center justify-between border-t border-neutral-800 pt-3 text-sm">
				<span className="text-neutral-400">Total</span>
				<span className={`font-medium tabular-nums ${total >= 0 ? "text-green-400" : "text-red-400"}`}>
					{currency.format(total)}
				</span>
			</div>

			<div className="flex gap-2">
				{editingEntry && (
					<button
						type="button"
						onClick={onDone}
						className="flex-1 rounded-md border border-neutral-800 px-3 py-2 text-sm hover:bg-neutral-800"
					>
						Cancelar
					</button>
				)}
				<button
					type="submit"
					disabled={isSubmitting}
					className="flex-1 rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-white disabled:opacity-50"
				>
					{editingEntry ? "Guardar cambios" : "Guardar patrimonio"}
				</button>
			</div>
		</form>
	);
}
