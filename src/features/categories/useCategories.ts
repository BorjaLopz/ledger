import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuthStore } from "../../store/authStore";
import type { Category } from "../../types/finance";
import { createCategory, deleteCategory, fetchCategories, seedDefaultCategories, updateCategory } from "./categoriesApi";

export function useCategories() {
	const uid = useAuthStore((state) => state.user?.uid);
	const queryClient = useQueryClient();

	const categoriesQuery = useQuery({
		queryKey: ["categories", uid],
		queryFn: () => fetchCategories(uid as string),
		enabled: !!uid,
	});

	useEffect(() => {
		if (!uid || !categoriesQuery.data || categoriesQuery.data.length > 0) return;
		seedDefaultCategories(uid).then(() => {
			queryClient.invalidateQueries({ queryKey: ["categories", uid] });
		});
	}, [uid, categoriesQuery.data, queryClient]);

	return categoriesQuery;
}

export function useCreateCategory() {
	const uid = useAuthStore((state) => state.user?.uid);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: Omit<Category, "id" | "uid">) => {
			if (!uid) throw new Error("No autenticado");
			return createCategory(uid, data);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["categories", uid] });
		},
	});
}

export function useUpdateCategory() {
	const uid = useAuthStore((state) => state.user?.uid);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: Partial<Omit<Category, "id" | "uid">> }) => updateCategory(id, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["categories", uid] });
		},
	});
}

export function useDeleteCategory() {
	const uid = useAuthStore((state) => state.user?.uid);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => deleteCategory(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["categories", uid] });
		},
	});
}
