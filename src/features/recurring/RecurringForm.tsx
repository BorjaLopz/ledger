import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { RecurringPayment } from "../../types/finance";
import { useCategories } from "../categories/useCategories";
import { useCreateRecurring, useUpdateRecurring } from "./useRecurring";

const recurringSchema = z.object({
	type: z.enum(["expense", "income"]),
	amount: z.coerce.number().positive("Debe ser mayor que 0"),
	categoryId: z.string().min(1, "Selecciona categoría"),
	frequency: z.enum(["weekly", "monthly", "yearly"]),
	nextDate: z.string().min(1, "Fecha requerida"),
	note: z.string(),
});

type RecurringFormInput = z.input<typeof recurringSchema>;
type RecurringFormValues = z.output<typeof recurringSchema>;

function today() {
	return new Date().toISOString().slice(0, 10);
}

interface RecurringFormProps {
	editingEntry?: RecurringPayment | null;
	onDone?: () => void;
}

export function RecurringForm({ editingEntry, onDone }: RecurringFormProps) {
	const { data: categories } = useCategories();
	const createRecurring = useCreateRecurring();
	const updateRecurring = useUpdateRecurring();
	const {
		register,
		handleSubmit,
		watch,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<RecurringFormInput, unknown, RecurringFormValues>({
		resolver: zodResolver(recurringSchema),
		defaultValues: { type: "expense", frequency: "monthly", nextDate: today(), note: "" },
	});

	useEffect(() => {
		if (editingEntry) {
			reset({
				type: editingEntry.type,
				amount: editingEntry.amount,
				categoryId: editingEntry.categoryId,
				frequency: editingEntry.frequency,
				nextDate: editingEntry.nextDate,
				note: editingEntry.note,
			});
		} else {
			reset({ type: "expense", frequency: "monthly", nextDate: today(), note: "", amount: 0, categoryId: "" });
		}
	}, [editingEntry, reset]);

	const type = watch("type");
	const filteredCategories = categories?.filter((category) => category.type === type) ?? [];

	async function onSubmit(values: RecurringFormValues) {
		if (editingEntry) {
			await updateRecurring.mutateAsync({ id: editingEntry.id, data: values });
			onDone?.();
			return;
		}
		await createRecurring.mutateAsync({ ...values, active: true });
		reset({ type: values.type, frequency: values.frequency, nextDate: today(), note: "", amount: 0, categoryId: "" });
	}

	return (
		<form
			onSubmit={handleSubmit(onSubmit)}
			className="space-y-4 rounded-md border border-neutral-800 bg-neutral-900 p-4"
		>
			<div>
				<span className="mb-1 block text-sm text-neutral-400">Tipo</span>
				<div className="flex gap-4">
					<label className="flex items-center gap-2 text-sm">
						<input type="radio" value="expense" {...register("type")} /> Gasto
					</label>
					<label className="flex items-center gap-2 text-sm">
						<input type="radio" value="income" {...register("type")} /> Ingreso
					</label>
				</div>
			</div>

			<div>
				<label htmlFor="amount" className="mb-1 block text-sm text-neutral-400">
					Monto
				</label>
				<input
					id="amount"
					type="number"
					step="0.01"
					className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-600"
					{...register("amount")}
				/>
				{errors.amount && <p className="mt-1 text-xs text-red-400">{errors.amount.message}</p>}
			</div>

			<div>
				<label htmlFor="categoryId" className="mb-1 block text-sm text-neutral-400">
					Categoría
				</label>
				<select
					id="categoryId"
					className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-600"
					{...register("categoryId")}
				>
					<option value="">Selecciona...</option>
					{filteredCategories.map((category) => (
						<option key={category.id} value={category.id}>
							{category.name}
						</option>
					))}
				</select>
				{errors.categoryId && <p className="mt-1 text-xs text-red-400">{errors.categoryId.message}</p>}
			</div>

			<div>
				<label htmlFor="frequency" className="mb-1 block text-sm text-neutral-400">
					Frecuencia
				</label>
				<select
					id="frequency"
					className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-600"
					{...register("frequency")}
				>
					<option value="weekly">Semanal</option>
					<option value="monthly">Mensual</option>
					<option value="yearly">Anual</option>
				</select>
			</div>

			<div>
				<label htmlFor="nextDate" className="mb-1 block text-sm text-neutral-400">
					Próxima fecha
				</label>
				<input
					id="nextDate"
					type="date"
					className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-600"
					{...register("nextDate")}
				/>
			</div>

			<div>
				<label htmlFor="note" className="mb-1 block text-sm text-neutral-400">
					Nombre / nota
				</label>
				<input
					id="note"
					type="text"
					placeholder="Netflix, Alquiler, Nómina..."
					className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-600"
					{...register("note")}
				/>
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
					{editingEntry ? "Guardar cambios" : "Crear recurrente"}
				</button>
			</div>
		</form>
	);
}
