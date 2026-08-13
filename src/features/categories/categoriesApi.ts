import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { Category } from "../../types/finance";
import { DEFAULT_CATEGORIES } from "./defaultCategories";

const categoriesRef = collection(db, "categories");

export async function fetchCategories(uid: string): Promise<Category[]> {
	const q = query(categoriesRef, where("uid", "==", uid));
	const snapshot = await getDocs(q);
	return snapshot.docs.map((docSnapshot) => ({
		id: docSnapshot.id,
		...docSnapshot.data(),
	})) as Category[];
}

export async function seedDefaultCategories(uid: string): Promise<void> {
	const batch = writeBatch(db);
	for (const category of DEFAULT_CATEGORIES) {
		const ref = doc(categoriesRef);
		batch.set(ref, { ...category, uid });
	}
	await batch.commit();
}

export async function createCategory(uid: string, data: Omit<Category, "id" | "uid">): Promise<void> {
	await addDoc(categoriesRef, { ...data, uid });
}

export async function updateCategory(id: string, data: Partial<Omit<Category, "id" | "uid">>): Promise<void> {
	await updateDoc(doc(db, "categories", id), data);
}

export async function deleteCategory(id: string): Promise<void> {
	await deleteDoc(doc(db, "categories", id));
}
