import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "../../lib/firebase";

export async function uploadReceipt(uid: string, file: File): Promise<string> {
	const path = `receipts/${uid}/${Date.now()}-${file.name}`;
	const fileRef = ref(storage, path);
	await uploadBytes(fileRef, file);
	return getDownloadURL(fileRef);
}

export async function deleteReceipt(url: string): Promise<void> {
	try {
		await deleteObject(ref(storage, url));
	} catch {
		// ya no existe o la URL no resuelve; nada que limpiar
	}
}
