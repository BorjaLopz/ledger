import { api } from "../../lib/api";
import type { Category } from "../../types/finance";
import { DEFAULT_CATEGORIES } from "./defaultCategories";

export async function fetchCategories(_uid: string): Promise<Category[]> {
	return api.get<Category[]>("/categories");
}

// Idempotente: el backend solo crea las categorías si el usuario no tiene ninguna.
export async function seedDefaultCategories(_uid: string): Promise<void> {
	await api.post("/categories/bulk", DEFAULT_CATEGORIES);
}

export async function createCategory(_uid: string, data: Omit<Category, "id" | "uid">): Promise<void> {
	await api.post("/categories", data);
}

export async function updateCategory(id: string, data: Partial<Omit<Category, "id" | "uid">>): Promise<void> {
	await api.patch(`/categories/${id}`, data);
}

export async function deleteCategory(id: string): Promise<void> {
	await api.delete(`/categories/${id}`);
}
