import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../store/authStore";
import type { RecurringPayment } from "../../types/finance";
import { createRecurring, deleteRecurring, fetchRecurring, updateRecurring } from "./recurringApi";

export function useRecurring() {
	const uid = useAuthStore((state) => state.user?.uid);

	return useQuery({
		queryKey: ["recurring", uid],
		queryFn: () => fetchRecurring(uid as string),
		enabled: !!uid,
	});
}

export function useCreateRecurring() {
	const uid = useAuthStore((state) => state.user?.uid);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: Omit<RecurringPayment, "id" | "uid">) => {
			if (!uid) throw new Error("No autenticado");
			return createRecurring(uid, data);
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring", uid] }),
	});
}

export function useToggleRecurring() {
	const uid = useAuthStore((state) => state.user?.uid);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, active }: { id: string; active: boolean }) => updateRecurring(id, { active }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring", uid] }),
	});
}

export function useUpdateRecurring() {
	const uid = useAuthStore((state) => state.user?.uid);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: Partial<Omit<RecurringPayment, "id" | "uid">> }) => updateRecurring(id, data),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring", uid] }),
	});
}

export function useDeleteRecurring() {
	const uid = useAuthStore((state) => state.user?.uid);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => deleteRecurring(id),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring", uid] }),
	});
}
