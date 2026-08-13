import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../store/authStore";
import type { NetWorthEntry } from "../../types/finance";
import { createNetWorthEntry, deleteNetWorthEntry, fetchNetWorthEntries, updateNetWorthEntry } from "./netWorthApi";

export function useNetWorthEntries() {
	const uid = useAuthStore((state) => state.user?.uid);

	return useQuery({
		queryKey: ["netWorth", uid],
		queryFn: () => fetchNetWorthEntries(uid as string),
		enabled: !!uid,
	});
}

export function useCreateNetWorthEntry() {
	const uid = useAuthStore((state) => state.user?.uid);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: Omit<NetWorthEntry, "id" | "uid">) => {
			if (!uid) throw new Error("No autenticado");
			return createNetWorthEntry(uid, data);
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["netWorth", uid] }),
	});
}

export function useUpdateNetWorthEntry() {
	const uid = useAuthStore((state) => state.user?.uid);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: Partial<Omit<NetWorthEntry, "id" | "uid">> }) => updateNetWorthEntry(id, data),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["netWorth", uid] }),
	});
}

export function useDeleteNetWorthEntry() {
	const uid = useAuthStore((state) => state.user?.uid);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => deleteNetWorthEntry(id),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["netWorth", uid] }),
	});
}
