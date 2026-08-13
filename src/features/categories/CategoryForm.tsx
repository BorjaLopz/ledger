import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Category } from "../../types/finance";
import { CATEGORY_COLORS } from "./colorOptions";
import { ICON_OPTIONS } from "./iconRegistry";
import { useCreateCategory, useUpdateCategory } from "./useCategories";

const categorySchema = z.object({
	name: z.string().min(1, "Nombre requerido"),
	type: z.enum(["expense", "income"]),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

interface CategoryFormProps {
	editingCategory?: Category | null;
	onDone?: () => void;
}

export function CategoryForm({ editingCategory, onDone }: CategoryFormProps) {
	const [icon, setIcon] = useState(editingCategory?.icon ?? ICON_OPTIONS[0].name);
	const [color, setColor] = useState(editingCategory?.color ?? CATEGORY_COLORS[0]);
	const createCategory = useCreateCategory();
	const updateCategory = useUpdateCategory();
	const {
		register,
		handleSubmit,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<CategoryFormValues>({
		resolver: zodResolver(categorySchema),
		defaultValues: { name: editingCategory?.name ?? "", type: editingCategory?.type ?? "expense" },
	});

	useEffect(() => {
		reset({ name: editingCategory?.name ?? "", type: editingCategory?.type ?? "expense" });
		setIcon(editingCategory?.icon ?? ICON_OPTIONS[0].name);
		setColor(editingCategory?.color ?? CATEGORY_COLORS[0]);
	}, [editingCategory, reset]);

	async function onSubmit(values: CategoryFormValues) {
		if (editingCategory) {
			await updateCategory.mutateAsync({ id: editingCategory.id, data: { ...values, icon, color } });
			onDone?.();
			return;
		}
		await createCategory.mutateAsync({ ...values, icon, color });
		reset({ name: "", type: values.type });
		setIcon(ICON_OPTIONS[0].name);
		setColor(CATEGORY_COLORS[0]);
	}

	return (
		<form
			onSubmit={handleSubmit(onSubmit)}
			className="space-y-4 rounded-md border border-neutral-800 bg-neutral-900 p-4"
		>
			<div>
				<label htmlFor="name" className="mb-1 block text-sm text-neutral-400">
					Nombre
				</label>
				<input
					id="name"
					type="text"
					placeholder="Hipoteca, Luz, Agua..."
					className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-600"
					{...register("name")}
				/>
				{errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
			</div>

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
				<span className="mb-1 block text-sm text-neutral-400">Icono</span>
				<div className="flex flex-wrap gap-2">
					{ICON_OPTIONS.map(({ name, icon: Icon }) => (
						<button
							key={name}
							type="button"
							onClick={() => setIcon(name)}
							className={`rounded-md border p-2 ${icon === name ? "border-neutral-100" : "border-neutral-800"}`}
						>
							<Icon className="h-4 w-4" color={color} />
						</button>
					))}
				</div>
			</div>

			<div>
				<span className="mb-1 block text-sm text-neutral-400">Color</span>
				<div className="flex flex-wrap gap-2">
					{CATEGORY_COLORS.map((c) => (
						<button
							key={c}
							type="button"
							onClick={() => setColor(c)}
							className={`h-6 w-6 rounded-full border-2 ${color === c ? "border-neutral-100" : "border-transparent"}`}
							style={{ backgroundColor: c }}
						/>
					))}
				</div>
			</div>

			<div className="flex gap-2">
				{editingCategory && (
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
					{editingCategory ? "Guardar cambios" : "Crear categoría"}
				</button>
			</div>
		</form>
	);
}
