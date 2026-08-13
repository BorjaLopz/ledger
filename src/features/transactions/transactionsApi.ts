import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { Transaction } from "../../types/finance";
import { deleteReceipt } from "./receiptsApi";

const transactionsRef = collection(db, "transactions");

export async function fetchTransactions(uid: string): Promise<Transaction[]> {
	const q = query(transactionsRef, where("uid", "==", uid));
	const snapshot = await getDocs(q);
	const transactions = snapshot.docs.map((docSnapshot) => ({
		id: docSnapshot.id,
		...docSnapshot.data(),
	})) as Transaction[];
	return transactions.sort((a, b) => b.date.localeCompare(a.date));
}

export async function createTransaction(uid: string, data: Omit<Transaction, "id" | "uid" | "createdAt">): Promise<void> {
	await addDoc(transactionsRef, { ...data, uid, createdAt: new Date().toISOString() });
}

export async function updateTransaction(id: string, data: Partial<Omit<Transaction, "id" | "uid" | "createdAt">>): Promise<void> {
	await updateDoc(doc(db, "transactions", id), data);
}

export async function deleteTransaction(transaction: Transaction): Promise<void> {
	if (transaction.receiptUrl) {
		await deleteReceipt(transaction.receiptUrl);
	}
	await deleteDoc(doc(db, "transactions", transaction.id));
}

export async function deleteTransactions(transactions: Transaction[]): Promise<void> {
	await Promise.all(transactions.map((transaction) => deleteTransaction(transaction)));
}
