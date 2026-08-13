import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { NetWorthEntry } from "../../types/finance";

const netWorthRef = collection(db, "netWorth");

export async function fetchNetWorthEntries(uid: string): Promise<NetWorthEntry[]> {
	const q = query(netWorthRef, where("uid", "==", uid));
	const snapshot = await getDocs(q);
	const entries = snapshot.docs.map((docSnapshot) => ({
		id: docSnapshot.id,
		...docSnapshot.data(),
	})) as NetWorthEntry[];
	return entries.sort((a, b) => a.date.localeCompare(b.date));
}

export async function createNetWorthEntry(uid: string, data: Omit<NetWorthEntry, "id" | "uid">): Promise<void> {
	await addDoc(netWorthRef, { ...data, uid });
}

export async function updateNetWorthEntry(id: string, data: Partial<Omit<NetWorthEntry, "id" | "uid">>): Promise<void> {
	await updateDoc(doc(db, "netWorth", id), data);
}

export async function deleteNetWorthEntry(id: string): Promise<void> {
	await deleteDoc(doc(db, "netWorth", id));
}
