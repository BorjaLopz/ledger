import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useAuthStore } from "../../store/authStore";
import { syncRecurring } from "./recurringApi";

export function useRecurringSync() {
	const uid = useAuthStore((state) => state.user?.uid);
	const queryClient = useQueryClient();
	const hasSynced = useRef(false);

	useEffect(() => {
		if (!uid || hasSynced.current) return;
		hasSynced.current = true;

		// La lógica (fechas vencidas, transacciones a crear) vive ahora en el backend y es atómica.
		syncRecurring()
			.then((created) => {
				if (created === 0) return;
				queryClient.invalidateQueries({ queryKey: ["transactions", uid] });
				queryClient.invalidateQueries({ queryKey: ["recurring", uid] });
			})
			.catch(() => {
				// se reintentará en la próxima carga; no bloquea la app
				hasSynced.current = false;
			});
	}, [uid, queryClient]);
}
