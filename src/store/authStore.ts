import type { User } from "firebase/auth";
import { create } from "zustand";

interface AuthState {
	user: User | null;
	initializing: boolean;
	setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
	user: null,
	initializing: true,
	setUser: (user) => set({ user, initializing: false }),
}));
