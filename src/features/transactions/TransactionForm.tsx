import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuthStore } from "../../store/authStore";
import { useCategories } from "../categories/useCategories";
import { uploadReceipt } from "./receiptsApi";
import { useCreateTransaction } from "./useTransactions";

const transactionSchema = z.object({
	type: z.enum(["expense", "income"]),
	amount: z.coerce.number().positive("Debe ser mayor que 0"),
	categoryId: z.string().min(1, "Selecciona categoría"),
	date: z.string().min(1, "Fecha requerida"),
	note: z.string(),
});

type TransactionFormInput = z.input<typeof transactionSchema>;
type TransactionFormValues = z.output<typeof transactionSchema>;

function today() {
	return new Date().toISOString().slice(0, 10);
}

export function TransactionForm() {
	const uid = useAuthStore((state) => state.user?.uid);
	const { data: categories } = useCategories();
	const createTransaction = useCreateTransaction();
	const [file, setFile] = useState<File | null>(null);
	const [uploading, setUploading] = useState(false);
	const {
		register,
		handleSubmit,
		watch,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<TransactionFormInput, unknown, TransactionFormValues>({
		resolver: zodResolver(transactionSchema),
		defaultValues: { type: "expense", date: today(), note: "" },
	});

	const type = watch("type");
	const filteredCategories = categories?.filter((category) => category.type === type) ?? [];

	async function onSubmit(values: TransactionFormValues) {
		let receiptUrl: string | null = null;
		if (file && uid) {
			setUploading(true);
			receiptUrl = await uploadReceipt(uid, file);
			setUploading(false);
		}
		await createTransaction.mutateAsync({ ...values, receiptUrl, recurringId: null });
		reset({ type: values.type, date: today(), note: "", amount: 0, categoryId: "" });
		setFile(null);
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
				<label htmlFor="date" className="mb-1 block text-sm text-neutral-400">
					Fecha
				</label>
				<input
					id="date"
					type="date"
					className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-600"
					{...register("date")}
				/>
			</div>

			<div>
				<label htmlFor="note" className="mb-1 block text-sm text-neutral-400">
					Nota (opcional)
				</label>
				<input
					id="note"
					type="text"
					className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-600"
					{...register("note")}
				/>
			</div>

			<div>
				<label htmlFor="receipt" className="mb-1 block text-sm text-neutral-400">
					Foto del ticket (opcional)
				</label>
				<input
					id="receipt"
					type="file"
					accept="image/*"
					onChange={(event) => setFile(event.target.files?.[0] ?? null)}
					className="w-full text-sm text-neutral-400 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-800 file:px-3 file:py-1.5 file:text-sm file:text-neutral-100 hover:file:bg-neutral-700"
				/>
			</div>

			<button
				type="submit"
				disabled={isSubmitting || uploading}
				className="w-full rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-white disabled:opacity-50"
			>
				{uploading ? "Subiendo foto..." : "Guardar"}
			</button>
		</form>
	);
}
