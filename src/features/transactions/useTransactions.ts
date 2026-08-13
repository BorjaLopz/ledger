import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../store/authStore";
import type { Transaction } from "../../types/finance";
import { createTransaction, deleteTransaction, deleteTransactions, fetchTransactions, updateTransaction } from "./transactionsApi";

export function useTransactions() {
	const uid = useAuthStore((state) => state.user?.uid);

	return useQuery({
		queryKey: ["transactions", uid],
		queryFn: () => fetchTransactions(uid as string),
		enabled: !!uid,
	});
}

export function useCreateTransaction() {
	const uid = useAuthStore((state) => state.user?.uid);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: Omit<Transaction, "id" | "uid" | "createdAt">) => {
			if (!uid) throw new Error("No autenticado");
			return createTransaction(uid, data);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["transactions", uid] });
		},
	});
}

export function useUpdateTransaction() {
	const uid = useAuthStore((state) => state.user?.uid);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: Partial<Omit<Transaction, "id" | "uid" | "createdAt">> }) =>
			updateTransaction(id, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["transactions", uid] });
		},
	});
}

export function useDeleteTransaction() {
	const uid = useAuthStore((state) => state.user?.uid);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (transaction: Transaction) => deleteTransaction(transaction),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["transactions", uid] });
		},
	});
}

export function useDeleteTransactions() {
	const uid = useAuthStore((state) => state.user?.uid);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (transactions: Transaction[]) => deleteTransactions(transactions),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["transactions", uid] });
		},
	});
}
