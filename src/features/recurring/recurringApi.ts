import { api } from "../../lib/api";
import type { RecurringPayment } from "../../types/finance";

export async function fetchRecurring(_uid: string): Promise<RecurringPayment[]> {
	return api.get<RecurringPayment[]>("/recurring");
}

export async function createRecurring(_uid: string, data: Omit<RecurringPayment, "id" | "uid">): Promise<void> {
	await api.post("/recurring", data);
}

export async function updateRecurring(id: string, data: Partial<Omit<RecurringPayment, "id" | "uid">>): Promise<void> {
	await api.patch(`/recurring/${id}`, data);
}

export async function deleteRecurring(id: string): Promise<void> {
	await api.delete(`/recurring/${id}`);
}

// Genera en el servidor las transacciones de los recurrentes vencidos. Devuelve cuántas creó.
export async function syncRecurring(): Promise<number> {
	const { created } = await api.post<{ created: number }>("/recurring/sync");
	return created;
}
