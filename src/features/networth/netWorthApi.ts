import { api } from "../../lib/api";
import type { NetWorthEntry } from "../../types/finance";

export async function fetchNetWorthEntries(_uid: string): Promise<NetWorthEntry[]> {
	return api.get<NetWorthEntry[]>("/networth");
}

export async function createNetWorthEntry(_uid: string, data: Omit<NetWorthEntry, "id" | "uid">): Promise<void> {
	await api.post("/networth", data);
}

export async function updateNetWorthEntry(id: string, data: Partial<Omit<NetWorthEntry, "id" | "uid">>): Promise<void> {
	await api.patch(`/networth/${id}`, data);
}

export async function deleteNetWorthEntry(id: string): Promise<void> {
	await api.delete(`/networth/${id}`);
}
