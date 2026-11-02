import { api } from "../../lib/api";

// Devuelve la URL firmada y temporal del ticket; el backend la guarda en la transacción.
export async function uploadReceipt(_uid: string, file: File): Promise<string> {
	const form = new FormData();
	form.append("file", file);
	const { url } = await api.post<{ url: string }>("/receipts", form);
	return url;
}
