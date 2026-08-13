import { useQueryClient } from "@tanstack/react-query";
import { collection, doc, writeBatch } from "firebase/firestore";
import { useEffect, useRef } from "react";
import { db } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";
import { advanceDate } from "./recurringDates";
import { useRecurring } from "./useRecurring";

const MAX_CATCH_UP_ITERATIONS = 24;

function todayKey(): string {
	return new Date().toISOString().slice(0, 10);
}

export function useRecurringSync() {
	const uid = useAuthStore((state) => state.user?.uid);
	const { data: recurring } = useRecurring();
	const queryClient = useQueryClient();
	const hasSynced = useRef(false);

	useEffect(() => {
		if (!uid || !recurring || hasSynced.current) return;
		hasSynced.current = true;

		const today = todayKey();
		const due = recurring.filter((entry) => entry.active && entry.nextDate <= today);
		if (due.length === 0) return;

		const batch = writeBatch(db);
		const transactionsRef = collection(db, "transactions");
		let wrote = false;

		for (const entry of due) {
			let nextDate = entry.nextDate;
			let iterations = 0;
			while (nextDate <= today && iterations < MAX_CATCH_UP_ITERATIONS) {
				const transactionRef = doc(transactionsRef);
				batch.set(transactionRef, {
					uid,
					type: entry.type,
					amount: entry.amount,
					categoryId: entry.categoryId,
					date: nextDate,
					note: entry.note,
					receiptUrl: null,
					recurringId: entry.id,
					createdAt: new Date().toISOString(),
				});
				nextDate = advanceDate(nextDate, entry.frequency);
				iterations += 1;
				wrote = true;
			}
			batch.update(doc(db, "recurring", entry.id), { nextDate });
		}

		if (!wrote) return;

		batch.commit().then(() => {
			queryClient.invalidateQueries({ queryKey: ["transactions", uid] });
			queryClient.invalidateQueries({ queryKey: ["recurring", uid] });
		});
	}, [uid, recurring, queryClient]);
}
