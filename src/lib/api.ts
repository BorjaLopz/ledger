import { auth } from "./firebase";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

export class ApiError extends Error {
	status: number;

	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

async function authHeader(): Promise<Record<string, string>> {
	const user = auth.currentUser;
	if (!user) throw new ApiError(401, "No autenticado");
	// getIdToken renueva el token automáticamente si ha caducado
	return { Authorization: `Bearer ${await user.getIdToken()}` };
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
	const headers: Record<string, string> = { ...(await authHeader()) };
	if (init.body && !(init.body instanceof FormData)) {
		headers["Content-Type"] = "application/json";
	}
	const response = await fetch(`${API_URL}${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } });
	if (!response.ok) {
		let message = response.statusText;
		try {
			const body = await response.json();
			message = body.error ?? body.message ?? message;
		} catch {
			// sin cuerpo JSON
		}
		throw new ApiError(response.status, message);
	}
	if (response.status === 204) return undefined as T;
	return (await response.json()) as T;
}

export const api = {
	get: <T>(path: string) => apiFetch<T>(path),
	post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
	patch: <T>(path: string, body: unknown) => apiFetch<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
	delete: (path: string) => apiFetch<void>(path, { method: "DELETE" }),
};
