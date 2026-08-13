import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Calendar, Clock, Image as ImageIcon, Repeat, StickyNote, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuthStore } from "../../store/authStore";
import { useConfirm } from "../../store/confirmStore";
import type { Transaction } from "../../types/finance";
import { CategoryIcon } from "../categories/CategoryIcon";
import { useCategories } from "../categories/useCategories";
import { formatDate, formatDateTime } from "./formatDate";
import { uploadReceipt } from "./receiptsApi";
import { useDeleteTransaction, useUpdateTransaction } from "./useTransactions";

const editSchema = z.object({
	type: z.enum(["expense", "income"]),
	amount: z.coerce.number().positive("Debe ser mayor que 0"),
	categoryId: z.string().min(1, "Selecciona categoría"),
	date: z.string().min(1, "Fecha requerida"),
	note: z.string(),
});

type EditFormInput = z.input<typeof editSchema>;
type EditFormValues = z.output<typeof editSchema>;

const currency = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

interface TransactionDetailModalProps {
	transaction: Transaction;
	onClose: () => void;
}

export function TransactionDetailModal({ transaction, onClose }: TransactionDetailModalProps) {
	const uid = useAuthStore((state) => state.user?.uid);
	const { data: categories } = useCategories();
	const [isEditing, setIsEditing] = useState(false);
	const [file, setFile] = useState<File | null>(null);
	const [uploading, setUploading] = useState(false);
	const updateTransaction = useUpdateTransaction();
	const deleteTransaction = useDeleteTransaction();
	const confirm = useConfirm();

	useEffect(() => {
		function handleKey(event: KeyboardEvent) {
			if (event.key === "Escape") onClose();
		}
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [onClose]);

	const category = categories?.find((c) => c.id === transaction.categoryId);

	const {
		register,
		handleSubmit,
		watch,
		formState: { errors, isSubmitting },
	} = useForm<EditFormInput, unknown, EditFormValues>({
		resolver: zodResolver(editSchema),
		defaultValues: {
			type: transaction.type,
			amount: transaction.amount,
			categoryId: transaction.categoryId,
			date: transaction.date,
			note: transaction.note,
		},
	});

	const type = watch("type");
	const filteredCategories = categories?.filter((c) => c.type === type) ?? [];

	async function onSubmit(values: EditFormValues) {
		let receiptUrl = transaction.receiptUrl;
		if (file && uid) {
			setUploading(true);
			receiptUrl = await uploadReceipt(uid, file);
			setUploading(false);
		}
		await updateTransaction.mutateAsync({ id: transaction.id, data: { ...values, receiptUrl } });
		onClose();
	}

	async function handleDelete() {
		if (await confirm("¿Seguro que quieres borrar esta transacción?")) {
			deleteTransaction.mutate(transaction);
			onClose();
		}
	}

	return (
		<motion.div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.15 }}
			onClick={onClose}
		>
			<motion.div
				className="w-full max-w-md rounded-lg border border-neutral-800 bg-neutral-900 p-6 shadow-[0px_16px_40px_rgba(0,0,0,0.5)]"
				initial={{ opacity: 0, scale: 0.95, y: 8 }}
				animate={{ opacity: 1, scale: 1, y: 0 }}
				exit={{ opacity: 0, scale: 0.95, y: 8 }}
				transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
				onClick={(event) => event.stopPropagation()}
			>
				<div className="mb-5 flex items-center justify-between">
					<h2 className="text-sm font-medium text-neutral-400">{isEditing ? "Editar transacción" : "Detalle"}</h2>
					<button type="button" onClick={onClose} className="text-neutral-500 hover:text-neutral-100">
						<X className="h-4 w-4" />
					</button>
				</div>

				{isEditing ? (
					<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
							<label htmlFor="edit-amount" className="mb-1 block text-sm text-neutral-400">
								Monto
							</label>
							<input
								id="edit-amount"
								type="number"
								step="0.01"
								className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-600"
								{...register("amount")}
							/>
							{errors.amount && <p className="mt-1 text-xs text-red-400">{errors.amount.message}</p>}
						</div>

						<div>
							<label htmlFor="edit-categoryId" className="mb-1 block text-sm text-neutral-400">
								Categoría
							</label>
							<select
								id="edit-categoryId"
								className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-600"
								{...register("categoryId")}
							>
								<option value="">Selecciona...</option>
								{filteredCategories.map((c) => (
									<option key={c.id} value={c.id}>
										{c.name}
									</option>
								))}
							</select>
							{errors.categoryId && <p className="mt-1 text-xs text-red-400">{errors.categoryId.message}</p>}
						</div>

						<div>
							<label htmlFor="edit-date" className="mb-1 block text-sm text-neutral-400">
								Fecha
							</label>
							<input
								id="edit-date"
								type="date"
								className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-600"
								{...register("date")}
							/>
						</div>

						<div>
							<label htmlFor="edit-note" className="mb-1 block text-sm text-neutral-400">
								Nota
							</label>
							<input
								id="edit-note"
								type="text"
								className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-600"
								{...register("note")}
							/>
						</div>

						<div>
							<label htmlFor="edit-receipt" className="mb-1 block text-sm text-neutral-400">
								Reemplazar foto (opcional)
							</label>
							<input
								id="edit-receipt"
								type="file"
								accept="image/*"
								onChange={(event) => setFile(event.target.files?.[0] ?? null)}
								className="w-full text-sm text-neutral-400 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-800 file:px-3 file:py-1.5 file:text-sm file:text-neutral-100 hover:file:bg-neutral-700"
							/>
						</div>

						<div className="flex gap-2 border-t border-neutral-800 pt-4">
							<button
								type="button"
								onClick={() => setIsEditing(false)}
								className="flex-1 rounded-md border border-neutral-800 px-3 py-2 text-sm hover:bg-neutral-800"
							>
								Cancelar
							</button>
							<button
								type="submit"
								disabled={isSubmitting || uploading}
								className="flex-1 rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-white disabled:opacity-50"
							>
								{uploading ? "Subiendo..." : "Guardar"}
							</button>
						</div>
					</form>
				) : (
					<div className="space-y-5">
						<div className="flex items-center gap-3">
							<div
								className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
								style={{ backgroundColor: category ? `${category.color}26` : "#6b728026" }}
							>
								{category && <CategoryIcon icon={category.icon} color={category.color} className="h-5 w-5" />}
							</div>
							<div>
								<p className="text-sm text-neutral-400">{category?.name ?? "Sin categoría"}</p>
								<p
									className={`text-3xl font-medium tabular-nums ${transaction.type === "income" ? "text-green-400" : "text-red-400"}`}
								>
									{transaction.type === "income" ? "+" : "-"}
									{currency.format(transaction.amount)}
								</p>
							</div>
						</div>

						<div className="space-y-3 rounded-md border border-neutral-800 bg-neutral-950 p-3">
							<InfoRow icon={<Calendar className="h-4 w-4" />} label="Fecha" value={formatDate(transaction.date)} />
							{transaction.note && (
								<InfoRow icon={<StickyNote className="h-4 w-4" />} label="Nota" value={transaction.note} />
							)}
							{transaction.createdAt && (
								<InfoRow
									icon={<Clock className="h-4 w-4" />}
									label="Registrado"
									value={formatDateTime(transaction.createdAt)}
								/>
							)}
							{transaction.recurringId && (
								<InfoRow icon={<Repeat className="h-4 w-4" />} label="Origen" value="Generado automáticamente" />
							)}
						</div>

						{transaction.receiptUrl && (
							<a
								href={transaction.receiptUrl}
								target="_blank"
								rel="noreferrer"
								className="group relative block overflow-hidden rounded-md border border-neutral-800"
							>
								<img
									src={transaction.receiptUrl}
									alt="Ticket"
									className="max-h-72 w-full object-contain transition group-hover:opacity-70"
								/>
								<div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
									<span className="flex items-center gap-1.5 rounded-md bg-neutral-950/80 px-2.5 py-1.5 text-xs text-neutral-100">
										<ImageIcon className="h-3.5 w-3.5" /> Ver ticket completo
									</span>
								</div>
							</a>
						)}

						<div className="flex gap-2 border-t border-neutral-800 pt-4">
							<button
								type="button"
								onClick={handleDelete}
								className="flex-1 rounded-md border border-neutral-800 px-3 py-2 text-sm text-red-400 hover:bg-neutral-800"
							>
								Borrar
							</button>
							<button
								type="button"
								onClick={() => setIsEditing(true)}
								className="flex-1 rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-white"
							>
								Editar
							</button>
						</div>
					</div>
				)}
			</motion.div>
		</motion.div>
	);
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
	return (
		<div className="flex items-center gap-2 text-sm">
			<span className="text-neutral-500">{icon}</span>
			<span className="w-24 shrink-0 text-neutral-500">{label}</span>
			<span className="text-neutral-100">{value}</span>
		</div>
	);
}
