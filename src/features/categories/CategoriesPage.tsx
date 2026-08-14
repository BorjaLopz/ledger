import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Category } from "../../types/finance";
import { useConfirm } from "../../store/confirmStore";
import { CategoryForm } from "./CategoryForm";
import { CategoryIcon } from "./CategoryIcon";
import { useCategories, useDeleteCategory } from "./useCategories";

export function CategoriesPage() {
	const { data: categories, isLoading } = useCategories();
	const deleteCategory = useDeleteCategory();
	const [editingCategory, setEditingCategory] = useState<Category | null>(null);

	const expenses = categories?.filter((category) => category.type === "expense") ?? [];
	const incomes = categories?.filter((category) => category.type === "income") ?? [];

	return (
		<div className="h-full overflow-y-auto overflow-x-hidden p-4 sm:p-8">
			<h1 className="mb-6 text-xl font-medium">Categorías</h1>

			{isLoading ? (
				<p className="text-sm text-neutral-600">Cargando...</p>
			) : (
				<div className="grid gap-8 md:grid-cols-2">
					<div className="order-2 space-y-6 md:order-1">
						<CategoryGroup
							title="Gastos"
							categories={expenses}
							onDelete={deleteCategory.mutate}
							onEdit={setEditingCategory}
						/>
						<CategoryGroup
							title="Ingresos"
							categories={incomes}
							onDelete={deleteCategory.mutate}
							onEdit={setEditingCategory}
						/>
					</div>
					<div className="order-1 md:order-2">
						<CategoryForm editingCategory={editingCategory} onDone={() => setEditingCategory(null)} />
					</div>
				</div>
			)}
		</div>
	);
}

interface CategoryGroupProps {
	title: string;
	categories: Category[];
	onDelete: (id: string) => void;
	onEdit: (category: Category) => void;
}

function CategoryGroup({ title, categories, onDelete, onEdit }: CategoryGroupProps) {
	const confirm = useConfirm();

	return (
		<div>
			<h2 className="mb-3 text-sm font-medium text-neutral-400">{title}</h2>
			<div className="space-y-2">
				{categories.map((category) => (
					<div
						key={category.id}
						className="flex items-center justify-between rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2"
					>
						<div className="flex min-w-0 flex-1 items-center gap-2">
							<CategoryIcon icon={category.icon} color={category.color} className="h-4 w-4 shrink-0" />
							<span className="truncate text-sm">{category.name}</span>
						</div>
						<div className="flex shrink-0 items-center gap-3">
							<button type="button" onClick={() => onEdit(category)} className="text-neutral-600 hover:text-neutral-300">
								<Pencil className="h-4 w-4" />
							</button>
							<button
								type="button"
								onClick={async () => {
									if (await confirm(`¿Seguro que quieres borrar "${category.name}"?`)) {
										onDelete(category.id);
									}
								}}
								className="text-neutral-600 hover:text-red-400"
							>
								<Trash2 className="h-4 w-4" />
							</button>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
