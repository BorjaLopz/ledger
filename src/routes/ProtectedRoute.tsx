import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export function ProtectedRoute() {
	const user = useAuthStore((state) => state.user);
	const initializing = useAuthStore((state) => state.initializing);

	if (initializing) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
				Cargando...
			</div>
		);
	}

	if (!user) {
		return <Navigate to="/login" replace />;
	}

	return <Outlet />;
}
