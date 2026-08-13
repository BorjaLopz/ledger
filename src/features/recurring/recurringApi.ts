import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { RecurringPayment } from "../../types/finance";

const recurringRef = collection(db, "recurring");

export async function fetchRecurring(uid: string): Promise<RecurringPayment[]> {
	const q = query(recurringRef, where("uid", "==", uid));
	const snapshot = await getDocs(q);
	return snapshot.docs.map((docSnapshot) => ({
		id: docSnapshot.id,
		...docSnapshot.data(),
	})) as RecurringPayment[];
}

export async function createRecurring(uid: string, data: Omit<RecurringPayment, "id" | "uid">): Promise<void> {
	await addDoc(recurringRef, { ...data, uid });
}

export async function updateRecurring(id: string, data: Partial<Omit<RecurringPayment, "id" | "uid">>): Promise<void> {
	await updateDoc(doc(db, "recurring", id), data);
}

export async function deleteRecurring(id: string): Promise<void> {
	await deleteDoc(doc(db, "recurring", id));
}
