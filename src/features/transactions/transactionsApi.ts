import { api } from "../../lib/api";
import type { Transaction } from "../../types/finance";

// El uid ya no se envía: el backend lo obtiene del token de Firebase.
export async function fetchTransactions(_uid: string): Promise<Transaction[]> {
	return api.get<Transaction[]>("/transactions");
}

export async function createTransaction(_uid: string, data: Omit<Transaction, "id" | "uid" | "createdAt">): Promise<void> {
	await api.post("/transactions", data);
}

export async function updateTransaction(id: string, data: Partial<Omit<Transaction, "id" | "uid" | "createdAt">>): Promise<void> {
	await api.patch(`/transactions/${id}`, data);
}

// El backend borra también el ticket asociado.
export async function deleteTransaction(transaction: Transaction): Promise<void> {
	await api.delete(`/transactions/${transaction.id}`);
}

export async function deleteTransactions(transactions: Transaction[]): Promise<void> {
	await Promise.all(transactions.map((transaction) => deleteTransaction(transaction)));
}
